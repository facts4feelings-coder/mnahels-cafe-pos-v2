using System.Security.Claims;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class PaymentFeatures
{
    private static readonly string[] Methods = ["Cash", "Card", "Online"];

    public static void MapApi(RouteGroupBuilder api)
    {
        api.MapPost("/orders/book", BookOrder);
        api.MapPost("/orders/{id:long}/payment", AddPayment);
        api.MapPut("/orders/{id:long}/workflow-status", UpdateWorkflowStatus);
        api.MapGet("/dashboard/payment-aware", Dashboard);
        api.MapGet("/insights/payment-aware", Insights).RequireAuthorization(p => p.RequireRole("Admin"));
        api.MapGet("/customers/payment-aware", Customers).RequireAuthorization(p => p.RequireRole("Admin"));
        api.MapGet("/customers/{id:int}/payment-aware", CustomerDetail).RequireAuthorization(p => p.RequireRole("Admin"));
    }

    private static async Task<IResult> BookOrder(BookOrderRequest request, PosDb db, ClaimsPrincipal principal)
    {
        if (request.Items is null || request.Items.Count == 0)
            return Results.BadRequest(new { message = "Cart is empty." });
        var type = string.IsNullOrWhiteSpace(request.OrderType) ? "Takeaway" : request.OrderType.Trim();
        if (!new[] { "Takeaway", "Dine-in", "Delivery" }.Contains(type))
            return Results.BadRequest(new { message = "Order mode invalid." });

        var tableId = type == "Dine-in" ? request.TableId ?? request.TableNumber : null;
        var waiterId = type == "Dine-in" ? request.WaiterId : null;
        var riderId = type == "Delivery" ? request.RiderId : null;
        var name = request.CustomerName?.Trim();
        var phone = CustomerPhone.Normalize(request.CustomerPhone);
        var address = request.DeliveryAddress?.Trim();
        CafeTable? table = null;
        ServicePerson? waiter = null;
        ServicePerson? rider = null;

        if (type == "Delivery" && (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(address)))
            return Results.BadRequest(new { message = "Delivery order ke liye customer name, phone aur address lazmi hain." });
        if (type == "Delivery")
        {
            if (!riderId.HasValue) return Results.BadRequest(new { message = "Delivery order ke liye available rider select karein." });
            rider = await db.ServicePeople.FirstOrDefaultAsync(x => x.Id == riderId && x.Type == "Rider" && x.IsActive);
            if (rider is null) return Results.BadRequest(new { message = "Selected rider available nahi hai." });
            if (await db.Orders.AnyAsync(x => x.RiderId == riderId && x.Status != "Completed" && x.Status != "Cancelled" && x.Status != "Ready"))
                return Results.BadRequest(new { message = $"{rider.Name} already booked hai." });
        }
        if (type == "Dine-in")
        {
            if (!tableId.HasValue) return Results.BadRequest(new { message = "Dine-in order ke liye table select karein." });
            table = await db.CafeTables.FirstOrDefaultAsync(x => x.Id == tableId && x.IsActive);
            if (table is null) return Results.BadRequest(new { message = "Selected table available nahi hai." });
            if (await db.Orders.AnyAsync(x => x.TableId == tableId && x.Status != "Completed" && x.Status != "Cancelled"))
                return Results.BadRequest(new { message = $"{table.Name} already booked hai." });
            if (!waiterId.HasValue) return Results.BadRequest(new { message = "Dine-in order ke liye available waiter select karein." });
            waiter = await db.ServicePeople.FirstOrDefaultAsync(x => x.Id == waiterId && x.Type == "Waiter" && x.IsActive);
            if (waiter is null) return Results.BadRequest(new { message = "Selected waiter available nahi hai." });
            if (await db.Orders.AnyAsync(x => x.WaiterId == waiterId && x.Status != "Completed" && x.Status != "Cancelled"))
                return Results.BadRequest(new { message = $"{waiter.Name} already booked hai." });
        }

        var variantIds = request.Items.Select(x => x.VariantId).Distinct().ToList();
        var variants = await db.ProductVariants.Include(x => x.Product)
            .Where(x => variantIds.Contains(x.Id) && x.Product!.IsActive && x.Product.IsAvailable)
            .ToDictionaryAsync(x => x.Id);
        if (variants.Count != variantIds.Count) return Results.BadRequest(new { message = "One or more items are unavailable." });

        var now = DateTimeOffset.Now;
        Customer? customer = null;
        if (!string.IsNullOrWhiteSpace(phone))
        {
            customer = await db.Customers.SingleOrDefaultAsync(x => x.Phone == phone);
            if (customer is null)
            {
                customer = new Customer { Name = name ?? $"Customer {phone}", Phone = phone, Address = address };
                db.Customers.Add(customer);
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(name)) customer.Name = name;
                if (!string.IsNullOrWhiteSpace(address)) customer.Address = address;
                customer.LastSeenAt = now;
            }
        }

        var highestToken = await db.Orders.MaxAsync(x => (int?)x.TokenNumber) ?? 999;
        var token = Math.Max(1000, highestToken + 1);
        var serial = (await db.Orders.MaxAsync(x => (long?)x.Id) ?? 0) + 1;
        var order = new Order
        {
            ReceiptNumber = $"MC-{now:yyMMdd}-{serial:0000}", TokenNumber = token, OrderType = type,
            CashierName = principal.Identity?.Name ?? "Cashier", Notes = request.Notes?.Trim(), CreatedAt = now,
            Customer = customer, CustomerName = name, CustomerPhone = phone, DeliveryAddress = address,
            TableNumber = tableId, TableId = tableId, TableName = table?.Name,
            RiderId = riderId, RiderName = rider?.Name, WaiterId = waiterId, WaiterName = waiter?.Name,
            Status = "New", KitchenStatus = "Pending", PaymentStatus = "Unpaid", PaymentMethod = ""
        };
        foreach (var line in request.Items)
        {
            var variant = variants[line.VariantId];
            var quantity = Math.Clamp(line.Quantity, 1, 99);
            order.Items.Add(new OrderItem { ProductName = variant.Product!.Name, VariantName = variant.Name,
                Quantity = quantity, UnitPrice = variant.Price, LineTotal = variant.Price * quantity, Notes = line.Notes });
        }
        order.Subtotal = order.Items.Sum(x => x.LineTotal);
        order.Discount = Math.Clamp(request.Discount, 0, order.Subtotal);
        order.Total = order.Subtotal - order.Discount;
        if (request.PayNow)
        {
            var method = NormalMethod(request.PaymentMethod);
            if (method is null) return Results.BadRequest(new { message = "Cash, Card ya Online payment method select karein." });
            var paymentError = ApplyPayment(order, method, request.CashReceived, request.PaymentReference, now, principal.Identity?.Name);
            if (paymentError is not null) return paymentError;
        }
        db.Orders.Add(order);
        AddAudit(db, principal, request.PayNow ? "OrderBookedPaid" : "OrderBookedUnpaid", $"MC-{token} · {type} · Rs {order.Total:0.##}");
        await db.SaveChangesAsync();
        return Results.Ok(OrderView.From(order));
    }

    private static async Task<IResult> AddPayment(long id, OrderPaymentRequest request, PosDb db, ClaimsPrincipal principal)
    {
        var order = await db.Orders.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id);
        if (order is null) return Results.NotFound(new { message = "Order not found." });
        if (order.Status == "Cancelled") return Results.BadRequest(new { message = "Cancelled order par payment add nahi ho sakti." });
        if (order.PaymentStatus == "Paid") return Results.Conflict(new { message = "Order already paid hai." });
        var method = NormalMethod(request.PaymentMethod);
        if (method is null) return Results.BadRequest(new { message = "Cash, Card ya Online payment method select karein." });
        var error = ApplyPayment(order, method, request.CashReceived, request.Reference, DateTimeOffset.Now, principal.Identity?.Name);
        if (error is not null) return error;
        if (request.CompleteOrder) { order.Status = "Completed"; order.KitchenStatus = "Served"; }
        AddAudit(db, principal, request.CompleteOrder ? "PaymentAddedAndCompleted" : "PaymentAdded", $"MC-{order.TokenNumber} · {method} · Rs {order.Total:0.##}");
        await db.SaveChangesAsync();
        return Results.Ok(OrderView.From(order));
    }

    private static async Task<IResult> UpdateWorkflowStatus(long id, StatusRequest request, PosDb db, ClaimsPrincipal principal)
    {
        var order = await db.Orders.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id);
        if (order is null) return Results.NotFound(new { message = "Order not found." });
        var allowed = order.OrderType == "Delivery" ? new[] { "New", "Preparing", "Ready", "Completed", "Cancelled" } : new[] { "New", "Ready", "Completed", "Cancelled" };
        if (!allowed.Contains(request.Status)) return Results.BadRequest(new { message = "This status is not valid for the selected order mode." });
        if (request.Status == "Completed" && order.PaymentStatus != "Paid") return Results.Conflict(new { requiresPayment = true, message = "Payment required before order completion." });
        if (request.Status == "Cancelled" && order.PaymentStatus == "Paid") return Results.Conflict(new { message = "Paid order cancel nahi ho sakta. Refund/Void workflow future update mein hoga." });
        order.Status = request.Status;
        order.KitchenStatus = request.Status switch { "New" => "Pending", "Preparing" => "Preparing", "Ready" => "Ready", "Completed" => "Served", "Cancelled" => "Cancelled", _ => order.KitchenStatus };
        AddAudit(db, principal, "OrderStatusUpdated", $"MC-{order.TokenNumber} · {request.Status}");
        await db.SaveChangesAsync();
        return Results.Ok(OrderView.From(order));
    }

    private static async Task<IResult> Dashboard(PosDb db)
    {
        var today = (await db.Orders.Include(x => x.Items).AsNoTracking().ToListAsync()).Where(x => x.CreatedAt.LocalDateTime.Date == DateTime.Now.Date).ToList();
        var valid = today.Where(x => x.Status != "Cancelled").ToList();
        var paid = valid.Where(x => x.PaymentStatus == "Paid").ToList();
        var active = valid.Where(x => x.Status is "New" or "Preparing" or "Ready").ToList();
        var outstanding = valid.Where(x => x.PaymentStatus != "Paid").Sum(x => x.Total);
        return Results.Ok(new { sales = paid.Sum(x => x.Total), orderCount = active.Count, bookedOrders = active.Count,
            paidOrders = paid.Count, outstanding, averageOrder = outstanding,
            cashSales = paid.Where(x => x.PaymentMethod == "Cash").Sum(x => x.Total), activeOrders = active.Count,
            topItems = paid.SelectMany(x => x.Items).GroupBy(x => x.ProductName)
                .Select(g => new { name = g.Key, quantity = g.Sum(x => x.Quantity), sales = g.Sum(x => x.LineTotal) })
                .OrderByDescending(x => x.quantity).Take(5) });
    }

    private static async Task<IResult> Insights(PosDb db)
    {
        var valid = (await db.Orders.Include(x => x.Items).AsNoTracking().ToListAsync()).Where(x => x.Status != "Cancelled" && x.PaymentStatus == "Paid").ToList();
        var sales = valid.SelectMany(x => x.Items).GroupBy(x => x.ProductName).ToDictionary(g => g.Key, g => new { quantity = g.Sum(x => x.Quantity), sales = g.Sum(x => x.LineTotal) });
        var names = await db.Products.Where(x => x.IsActive).Select(x => x.Name).ToListAsync();
        var products = names.Select(name => new { name, quantity = sales.TryGetValue(name, out var a) ? a.quantity : 0, sales = sales.TryGetValue(name, out var b) ? b.sales : 0 }).ToList();
        return Results.Ok(new { peakHours = valid.GroupBy(x => x.CreatedAt.LocalDateTime.Hour).Select(g => new { hour = g.Key, orders = g.Count(), sales = g.Sum(x => x.Total) }).OrderByDescending(x => x.orders), bestItems = products.OrderByDescending(x => x.quantity).Take(8), slowItems = products.OrderBy(x => x.quantity).Take(8) });
    }

    private static async Task<IResult> Customers(PosDb db)
    {
        var rows = await db.Customers.Include(x => x.Orders).ThenInclude(x => x.Items).AsNoTracking().ToListAsync();
        return Results.Ok(rows.Select(customer => { var paid = customer.Orders.Where(x => x.Status != "Cancelled" && x.PaymentStatus == "Paid").ToList(); var favourite = paid.SelectMany(x => x.Items).GroupBy(x => x.ProductName).OrderByDescending(g => g.Sum(x => x.Quantity)).FirstOrDefault(); return new { customer.Id, customer.Name, customer.Phone, customer.Address, customer.CreatedAt, customer.LastSeenAt, orderCount = paid.Count, totalSpent = paid.Sum(x => x.Total), averageOrder = paid.Count == 0 ? 0 : paid.Average(x => x.Total), favouriteItem = favourite?.Key }; }).OrderByDescending(x => x.LastSeenAt));
    }

    private static async Task<IResult> CustomerDetail(int id, PosDb db)
    {
        var customer = await db.Customers.Include(x => x.Orders).ThenInclude(x => x.Items).SingleOrDefaultAsync(x => x.Id == id);
        if (customer is null) return Results.NotFound();
        var paid = customer.Orders.Where(x => x.Status != "Cancelled" && x.PaymentStatus == "Paid").ToList();
        return Results.Ok(new { customer.Id, customer.Name, customer.Phone, customer.Address, customer.CreatedAt, customer.LastSeenAt,
            favourites = paid.SelectMany(x => x.Items).GroupBy(x => x.ProductName).Select(g => new { name = g.Key, quantity = g.Sum(x => x.Quantity), sales = g.Sum(x => x.LineTotal) }).OrderByDescending(x => x.quantity).Take(5),
            orders = paid.OrderByDescending(x => x.CreatedAt).Select(OrderView.From) });
    }

    private static IResult? ApplyPayment(Order order, string method, decimal? cashReceived, string? reference, DateTimeOffset paidAt, string? paidBy)
    {
        if (method == "Cash" && (!cashReceived.HasValue || cashReceived.Value < order.Total)) return Results.BadRequest(new { message = $"Cash received kam az kam Rs {order.Total:0} hona chahiye." });
        order.PaymentStatus = "Paid"; order.PaymentMethod = method; order.PaymentReference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        order.PaidAt = paidAt; order.PaidBy = paidBy; order.CashReceived = method == "Cash" ? cashReceived : null; order.ChangeDue = method == "Cash" ? cashReceived!.Value - order.Total : 0;
        return null;
    }

    private static string? NormalMethod(string? value) => Methods.FirstOrDefault(x => string.Equals(x, value?.Trim(), StringComparison.OrdinalIgnoreCase));
    private static void AddAudit(PosDb db, ClaimsPrincipal principal, string action, string details)
    {
        if (int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) db.AuditLogs.Add(new AuditLog { UserId = userId, Action = action, Details = details });
    }
}

record BookOrderRequest(List<CreateOrderLine> Items, string OrderType, string? PaymentMethod, decimal Discount,
    string? Notes, string? CustomerName, string? CustomerPhone, string? DeliveryAddress, int? TableNumber,
    int? TableId, int? RiderId, int? WaiterId, decimal? CashReceived, bool PayNow, string? PaymentReference);
record OrderPaymentRequest(string PaymentMethod, decimal? CashReceived, string? Reference, bool CompleteOrder = true);
