/* Mnahel's Cafe POS v0.15.46 · complete shift and closing order audit
 * Owner: Eastern Cross Technology · https://techmint.org
 * A product by Eastern Cross Technology. */
using System.Data.Common;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class OrderLogFeatures
{
    public static void MapApi(RouteGroupBuilder api)
    {
        api.MapGet("/shifts/current/order-log", Current);
        api.MapGet("/shifts/{id:long}/order-log", ByShift);
    }

    private static async Task<IResult> Current(PosDb db)
    {
        var shift = await ShiftFeatures.GetOpenShiftAsync(db);
        return Results.Ok(shift is null ? new OrderLogResponse() : await Build(db, shift));
    }

    private static async Task<IResult> ByShift(long id, PosDb db)
    {
        var shift = await db.Shifts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return shift is null ? Results.NotFound(new { message = "Shift not found." }) : Results.Ok(await Build(db, shift));
    }

    internal static async Task<OrderLogResponse> Build(PosDb db, PosShift shift)
    {
        var end = shift.ClosedAt ?? DateTimeOffset.Now;
        var users = (await db.Users.AsNoTracking().ToListAsync())
            .ToDictionary(x => x.Id, x => (Name: x.DisplayName, Role: x.Role));
        var orders = (await db.Orders.Include(x => x.Items).AsNoTracking().ToListAsync())
            .Where(x => x.CreatedAt >= shift.OpenedAt && x.CreatedAt <= end)
            .OrderByDescending(x => x.CreatedAt).ToList();
        var amendments = await LoadAmendments(db, shift.OpenedAt, end, users);
        var audit = (await db.AuditLogs.AsNoTracking().ToListAsync())
            .Where(x => x.CreatedAt >= shift.OpenedAt && x.CreatedAt <= end &&
                (x.Action == "OrderStatusUpdated" || x.Action == "PaymentAddedAndCompleted" || x.Action == "PaymentAdded"))
            .OrderByDescending(x => x.CreatedAt).ToList();

        var events = new List<OrderLogEvent>();
        events.AddRange(orders.Select(x => new OrderLogEvent
        {
            TokenNumber = x.TokenNumber, Action = "Started",
            Actor = x.CreatedByName ?? x.CashierName, Role = x.CreatedByRole ?? "Cashier",
            Details = $"{x.OrderType} · {Items(x)} · {x.PaymentStatus}", At = x.CreatedAt
        }));
        events.AddRange(amendments.Select(x => new OrderLogEvent
        {
            TokenNumber = x.TokenNumber, Action = "Edited", Actor = x.UserName,
            Role = x.UserRole, Details = x.Summary, At = x.CreatedAt
        }));
        foreach (var row in audit)
        {
            var token = Token(row.Details); if (token <= 0) continue;
            var details = CleanDetails(row.Details);
            var action = row.Action == "PaymentAddedAndCompleted" || details.Contains("Completed", StringComparison.OrdinalIgnoreCase) ? "Completed"
                : details.Contains("Cancelled", StringComparison.OrdinalIgnoreCase) ? "Cancelled"
                : details.Contains("Preparing", StringComparison.OrdinalIgnoreCase) ? "Prepared"
                : details.Contains("Ready", StringComparison.OrdinalIgnoreCase) ? "Ready"
                : row.Action == "PaymentAdded" ? "Payment" : "Updated";
            var user = users.GetValueOrDefault(row.UserId);
            events.Add(new OrderLogEvent { TokenNumber = token, Action = action,
                Actor = string.IsNullOrWhiteSpace(user.Name) ? "Cafe staff" : user.Name,
                Role = string.IsNullOrWhiteSpace(user.Role) ? "Staff" : user.Role,
                Details = details, At = row.CreatedAt });
        }

        var names = orders.Select(x => new { Name = x.CreatedByName ?? x.CashierName, Role = x.CreatedByRole ?? "Cashier" })
            .Concat(amendments.Select(x => new { Name = x.UserName, Role = x.UserRole }))
            .Concat(events.Select(x => new { Name = x.Actor, Role = x.Role }))
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .DistinctBy(x => $"{x.Name}|{x.Role}", StringComparer.OrdinalIgnoreCase).ToList();
        var orderEvents = events.OrderByDescending(x => x.At).ToList();
        var userRows = names.Select(x => new OrderLogUser
        {
            Name = x.Name, Role = x.Role,
            OrdersStarted = orders.Count(o => string.Equals(o.CreatedByName ?? o.CashierName, x.Name, StringComparison.OrdinalIgnoreCase)),
            Successful = orderEvents.Count(e => e.Action == "Completed" && string.Equals(e.Actor, x.Name, StringComparison.OrdinalIgnoreCase)),
            Edits = amendments.Count(a => string.Equals(a.UserName, x.Name, StringComparison.OrdinalIgnoreCase)),
            Cancelled = orderEvents.Count(e => e.Action == "Cancelled" && string.Equals(e.Actor, x.Name, StringComparison.OrdinalIgnoreCase))
        }).OrderByDescending(x => x.OrdersStarted).ThenByDescending(x => x.Edits).ToList();

        return new OrderLogResponse
        {
            Open = shift.Status == "Open", ShiftNumber = shift.ShiftNumber,
            TotalOrders = orders.Count, SuccessfulOrders = orders.Count(x => x.Status == "Completed"),
            ActiveOrders = orders.Count(x => x.Status != "Completed" && x.Status != "Cancelled"),
            CancelledOrders = orders.Count(x => x.Status == "Cancelled"),
            EditedOrders = amendments.Select(x => x.OrderId).Distinct().Count(),
            Users = userRows, Events = orderEvents.Take(100).ToList()
        };
    }

    private static string Items(Order order)
    {
        var text = string.Join(", ", order.Items.Select(x => $"{x.Quantity}x {x.ProductName}"));
        return string.IsNullOrWhiteSpace(text) ? "No item detail" : text;
    }
    private static int Token(string? details)
    {
        var match = Regex.Match(details ?? string.Empty, @"MC-(\d+)", RegexOptions.IgnoreCase);
        return match.Success && int.TryParse(match.Groups[1].Value, out var token) ? token : 0;
    }
    private static string CleanDetails(string? value)
    {
        var text = Regex.Replace(value ?? string.Empty, @"^MC-\d+\s*[·|-]?\s*", string.Empty).Trim();
        return string.IsNullOrWhiteSpace(text) ? "Order activity" : text;
    }

    private static async Task<List<OrderLogAmendment>> LoadAmendments(PosDb db, DateTimeOffset start, DateTimeOffset end,
        IReadOnlyDictionary<int, (string Name, string Role)> users)
    {
        var rows = new List<OrderLogAmendment>();
        DbConnection connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;
        try
        {
            if (shouldClose) await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT a."OrderId", o."TokenNumber", a."UserId", a."UserName", a."Kind",
                       a."PayloadJson", a."OldTotal", a."NewTotal", a."CreatedAt"
                FROM "OrderAmendments" a
                JOIN "Orders" o ON o."Id" = a."OrderId"
                ORDER BY a."Id" DESC
                """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                if (!DateTimeOffset.TryParse(reader.GetString(8), out var at) || at < start || at > end) continue;
                int? userId = reader.IsDBNull(2) ? null : reader.GetInt32(2);
                var account = userId.HasValue ? users.GetValueOrDefault(userId.Value) : default;
                var oldTotal = ParseMoney(reader.GetString(6)); var newTotal = ParseMoney(reader.GetString(7));
                var kind = reader.GetString(4); var payload = reader.GetString(5);
                rows.Add(new OrderLogAmendment
                {
                    OrderId = reader.GetInt64(0), TokenNumber = reader.GetInt32(1),
                    UserName = reader.IsDBNull(3) ? account.Name ?? "Cafe staff" : reader.GetString(3),
                    UserRole = string.IsNullOrWhiteSpace(account.Role) ? "Staff" : account.Role,
                    Summary = AmendmentSummary(kind, payload, oldTotal, newTotal), CreatedAt = at
                });
            }
        }
        catch { }
        finally { if (shouldClose && connection.State == System.Data.ConnectionState.Open) await connection.CloseAsync(); }
        return rows;
    }

    private static decimal ParseMoney(string value) => decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var result) ? result : 0;
    private static string AmendmentSummary(string kind, string payload, decimal oldTotal, decimal newTotal)
    {
        var parts = new List<string>();
        try
        {
            using var document = JsonDocument.Parse(payload); var root = document.RootElement;
            var additions = Delta(root, "additions", "+"); if (!string.IsNullOrWhiteSpace(additions)) parts.Add(additions);
            var cancellations = Delta(root, "cancellations", "-"); if (!string.IsNullOrWhiteSpace(cancellations)) parts.Add(cancellations);
        }
        catch { }
        parts.Add($"Bill Rs {oldTotal:0.##} → Rs {newTotal:0.##}");
        return $"{kind} · {string.Join(" · ", parts)}";
    }
    private static string Delta(JsonElement root, string property, string sign)
    {
        if (!TryProperty(root, property, out var array) || array.ValueKind != JsonValueKind.Array) return "";
        var values = new List<string>();
        foreach (var item in array.EnumerateArray())
        {
            TryProperty(item, "quantity", out var quantity); TryProperty(item, "productName", out var name);
            values.Add($"{sign}{(quantity.ValueKind == JsonValueKind.Number ? quantity.GetInt32() : 0)} {name.GetString() ?? "Item"}");
        }
        return string.Join(", ", values);
    }
    private static bool TryProperty(JsonElement element, string name, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject()) if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) { value = property.Value; return true; }
        value = default; return false;
    }
}

sealed class OrderLogResponse
{
    public bool Open { get; set; }
    public string ShiftNumber { get; set; } = "";
    public int TotalOrders { get; set; }
    public int SuccessfulOrders { get; set; }
    public int ActiveOrders { get; set; }
    public int CancelledOrders { get; set; }
    public int EditedOrders { get; set; }
    public List<OrderLogUser> Users { get; set; } = [];
    public List<OrderLogEvent> Events { get; set; } = [];
}
sealed class OrderLogUser
{
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public int OrdersStarted { get; set; }
    public int Successful { get; set; }
    public int Edits { get; set; }
    public int Cancelled { get; set; }
}
sealed class OrderLogEvent
{
    public int TokenNumber { get; set; }
    public string Action { get; set; } = "";
    public string Actor { get; set; } = "";
    public string Role { get; set; } = "";
    public string Details { get; set; } = "";
    public DateTimeOffset At { get; set; }
}
sealed class OrderLogAmendment
{
    public long OrderId { get; set; }
    public int TokenNumber { get; set; }
    public string UserName { get; set; } = "";
    public string UserRole { get; set; } = "";
    public string Summary { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}
