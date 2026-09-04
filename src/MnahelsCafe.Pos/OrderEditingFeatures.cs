/*
 * Mnahel's Cafe POS · booked-order editing and running-order amendments
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
using System.Data;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class OrderEditingFeatures
{
    public static void ApplySchema(PosDb db)
    {
        var columns = Columns(db, "OrderItems");
        if (columns.Add("VariantId"))
            db.Database.ExecuteSqlRaw("ALTER TABLE \"OrderItems\" ADD COLUMN \"VariantId\" INTEGER NULL;");

        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "OrderAmendments" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_OrderAmendments" PRIMARY KEY AUTOINCREMENT,
                "OrderId" INTEGER NOT NULL,
                "Kind" TEXT NOT NULL,
                "PayloadJson" TEXT NOT NULL,
                "OldTotal" TEXT NOT NULL,
                "NewTotal" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                "UserId" INTEGER NULL,
                "UserName" TEXT NOT NULL,
                FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_OrderAmendments_OrderId\" ON \"OrderAmendments\" (\"OrderId\", \"Id\");");
        db.Database.ExecuteSqlRaw("""
            UPDATE "OrderItems"
            SET "VariantId" = (
                SELECT v."Id"
                FROM "ProductVariants" v
                JOIN "Products" p ON p."Id" = v."ProductId"
                WHERE p."Name" = "OrderItems"."ProductName" COLLATE NOCASE
                  AND v."Name" = "OrderItems"."VariantName" COLLATE NOCASE
                ORDER BY v."Id"
                LIMIT 1
            )
            WHERE "VariantId" IS NULL;
            """);
    }

    public static void MapApi(RouteGroupBuilder api)
    {
        api.MapGet("/orders/{id:long}/edit", LoadOrder);
        api.MapPut("/orders/{id:long}", UpdateOrder);
        api.MapGet("/orders/{id:long}/amendments", LoadAmendments);
    }

    private static async Task<IResult> LoadOrder(long id, PosDb db)
    {
        var order = await db.Orders.Include(x => x.Items).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        if (order is null) return Results.NotFound(new { message = "Order not found." });
        var catalog = await LoadCatalog(db);
        return Results.Ok(EditableView(order, catalog));
    }

    private static async Task<IResult> UpdateOrder(long id, UpdateBookedOrderRequest request, PosDb db, ClaimsPrincipal principal)
    {
        var order = await db.Orders.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id);
        if (order is null) return Results.NotFound(new { message = "Order not found." });
        if (order.Status is "Completed" or "Cancelled")
            return Results.Conflict(new { message = "Completed ya cancelled order edit nahi ho sakta." });
        if (string.Equals(order.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase))
            return Results.Conflict(new { message = "Paid order locked hai. Items change karne se pehle refund/void workflow required hai." });
        if (request.Items is null || request.Items.Count == 0)
            return Results.BadRequest(new { message = "Updated cart empty nahi ho sakta." });

        var requestedLines = request.Items
            .Where(x => x.VariantId > 0)
            .Select(x => new
            {
                x.VariantId,
                Quantity = Math.Clamp(x.Quantity, 1, 99),
                Notes = CleanNotes(x.Notes)
            })
            .GroupBy(x => RunningOrderDelta.KeyFor(x.VariantId, x.Notes), StringComparer.Ordinal)
            .Select(g => new
            {
                g.First().VariantId,
                Quantity = Math.Clamp(g.Sum(x => x.Quantity), 1, 99),
                Notes = g.First().Notes
            })
            .ToList();
        if (requestedLines.Count == 0)
            return Results.BadRequest(new { message = "Updated cart empty nahi ho sakta." });

        var requestedIds = requestedLines.Select(x => x.VariantId).Distinct().ToList();
        var variants = await db.ProductVariants.Include(x => x.Product)
            .Where(x => requestedIds.Contains(x.Id) && x.Product!.IsActive && x.Product.IsAvailable)
            .ToDictionaryAsync(x => x.Id);
        if (variants.Count != requestedIds.Count)
            return Results.BadRequest(new { message = "Ek ya zyada selected items ab available nahi hain." });

        var catalog = await LoadCatalog(db);
        var oldTotal = order.Total;
        var original = new List<RunningOrderSnapshotLine>();
        var existingByKey = new Dictionary<string, List<OrderItem>>(StringComparer.Ordinal);
        foreach (var item in order.Items)
        {
            var variantId = ResolveVariantId(item, catalog);
            if (!variantId.HasValue) continue;
            item.VariantId = variantId.Value;
            var key = RunningOrderDelta.KeyFor(variantId.Value, item.Notes);
            if (!existingByKey.TryGetValue(key, out var matches)) existingByKey[key] = matches = [];
            matches.Add(item);
            original.Add(new RunningOrderSnapshotLine(variantId.Value, item.ProductName, item.VariantName,
                item.Quantity, item.UnitPrice, item.Notes));
        }

        var updated = requestedLines.Select(line =>
        {
            var variant = variants[line.VariantId];
            return new RunningOrderSnapshotLine(variant.Id, variant.Product!.Name, variant.Name,
                line.Quantity, variant.Price, line.Notes);
        }).ToList();
        var delta = RunningOrderDelta.Calculate(original, updated);
        var existingItems = order.Items.ToList();
        var claimed = new HashSet<OrderItem>();

        foreach (var line in updated)
        {
            var key = RunningOrderDelta.KeyFor(line.VariantId, line.Notes);
            OrderItem item;
            if (existingByKey.TryGetValue(key, out var matches) && matches.Count > 0)
            {
                item = matches[0];
                claimed.Add(item);
            }
            else
            {
                item = new OrderItem();
                order.Items.Add(item);
            }
            item.VariantId = line.VariantId;
            item.ProductName = line.ProductName;
            item.VariantName = line.VariantName;
            item.Quantity = line.Quantity;
            item.UnitPrice = line.UnitPrice;
            item.LineTotal = line.UnitPrice * line.Quantity;
            item.Notes = line.Notes;
        }

        foreach (var item in existingItems.Where(x => !claimed.Contains(x)))
        {
            order.Items.Remove(item);
            db.OrderItems.Remove(item);
        }

        order.Subtotal = order.Items.Sum(x => x.LineTotal);
        order.Discount = Math.Clamp(request.Discount, 0, order.Subtotal);
        order.Total = order.Subtotal - order.Discount;
        order.Notes = CleanNotes(request.Notes);

        var kind = delta.Additions.Count > 0 && delta.Cancellations.Count > 0 ? "Mixed"
            : delta.Additions.Count > 0 ? "Addition"
            : delta.Cancellations.Count > 0 ? "Cancellation"
            : "DetailsOnly";
        var summary = string.Join(" · ", new[]
        {
            delta.Additions.Count > 0 ? "+ " + string.Join(", ", delta.Additions.Select(x => $"{x.Quantity} {x.ProductName}")) : null,
            delta.Cancellations.Count > 0 ? "- " + string.Join(", ", delta.Cancellations.Select(x => $"{x.Quantity} {x.ProductName}")) : null,
            $"Rs {oldTotal:0.##}->{order.Total:0.##}"
        }.Where(x => x is not null));
        ShiftFeatures.Audit(db, principal, "RunningOrderAmended", $"MC-{order.TokenNumber} · {kind} · {summary}");

        var payload = JsonSerializer.Serialize(new
        {
            additions = delta.Additions,
            cancellations = delta.Cancellations,
            previousTotal = oldTotal,
            updatedTotal = order.Total
        });
        var now = DateTimeOffset.Now;
        var userName = principal.Identity?.Name ?? "Cashier";
        int? userId = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var parsedUserId) ? parsedUserId : null;

        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "OrderAmendments" ("OrderId", "Kind", "PayloadJson", "OldTotal", "NewTotal", "CreatedAt", "UserId", "UserName")
            VALUES ({order.Id}, {kind}, {payload}, {oldTotal.ToString(CultureInfo.InvariantCulture)}, {order.Total.ToString(CultureInfo.InvariantCulture)}, {now.ToString("O", CultureInfo.InvariantCulture)}, {userId}, {userName});
            """);
        await transaction.CommitAsync();

        return Results.Ok(new
        {
            order = OrderView.From(order),
            additions = delta.Additions,
            cancellations = delta.Cancellations,
            amendmentKind = kind,
            amendedAt = now
        });
    }

    private static async Task<IResult> LoadAmendments(long id, PosDb db)
    {
        if (!await db.Orders.AnyAsync(x => x.Id == id))
            return Results.NotFound(new { message = "Order not found." });

        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State == ConnectionState.Closed;
        if (shouldClose) await connection.OpenAsync();
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT "Id", "Kind", "PayloadJson", "OldTotal", "NewTotal", "CreatedAt", "UserId", "UserName"
                FROM "OrderAmendments" WHERE "OrderId" = $orderId ORDER BY "Id" DESC;
                """;
            var parameter = command.CreateParameter();
            parameter.ParameterName = "$orderId";
            parameter.Value = id;
            command.Parameters.Add(parameter);
            var rows = new List<object>();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var payload = JsonDocument.Parse(reader.GetString(2)).RootElement.Clone();
                rows.Add(new
                {
                    id = reader.GetInt64(0),
                    kind = reader.GetString(1),
                    payload,
                    oldTotal = decimal.Parse(reader.GetString(3), CultureInfo.InvariantCulture),
                    newTotal = decimal.Parse(reader.GetString(4), CultureInfo.InvariantCulture),
                    createdAt = DateTimeOffset.Parse(reader.GetString(5), CultureInfo.InvariantCulture),
                    userId = reader.IsDBNull(6) ? (int?)null : reader.GetInt32(6),
                    userName = reader.GetString(7)
                });
            }
            return Results.Ok(rows);
        }
        finally
        {
            if (shouldClose) await connection.CloseAsync();
        }
    }

    private static object EditableView(Order order, IReadOnlyDictionary<int, ProductVariant> catalog) => new
    {
        order.Id,
        order.ReceiptNumber,
        order.TokenNumber,
        order.OrderType,
        order.PaymentMethod,
        order.PaymentStatus,
        order.CashierName,
        order.Status,
        order.KitchenStatus,
        order.Subtotal,
        order.Discount,
        order.Total,
        order.Notes,
        order.CreatedAt,
        order.CustomerId,
        order.CustomerName,
        order.CustomerPhone,
        order.DeliveryAddress,
        order.TableNumber,
        order.TableId,
        order.TableName,
        order.RiderId,
        order.RiderName,
        order.WaiterId,
        order.WaiterName,
        items = order.Items.Select(item => new
        {
            item.Id,
            variantId = ResolveVariantId(item, catalog),
            item.ProductName,
            item.VariantName,
            item.Quantity,
            item.UnitPrice,
            item.LineTotal,
            item.Notes
        }).ToList()
    };

    private static async Task<Dictionary<int, ProductVariant>> LoadCatalog(PosDb db) =>
        await db.ProductVariants.Include(x => x.Product).AsNoTracking().ToDictionaryAsync(x => x.Id);

    private static int? ResolveVariantId(OrderItem item, IReadOnlyDictionary<int, ProductVariant> catalog)
    {
        if (item.VariantId.HasValue && catalog.ContainsKey(item.VariantId.Value)) return item.VariantId.Value;
        return catalog.Values.FirstOrDefault(variant =>
            string.Equals(variant.Product?.Name, item.ProductName, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(variant.Name, item.VariantName, StringComparison.OrdinalIgnoreCase))?.Id;
    }

    private static HashSet<string> Columns(PosDb db, string table)
    {
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State == ConnectionState.Closed;
        if (shouldClose) connection.Open();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info(\"{table}\");";
            using var reader = command.ExecuteReader();
            while (reader.Read()) columns.Add(reader.GetString(1));
        }
        finally
        {
            if (shouldClose) connection.Close();
        }
        return columns;
    }

    private static string? CleanNotes(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

record UpdateBookedOrderRequest(List<CreateOrderLine> Items, decimal Discount, string? Notes);
