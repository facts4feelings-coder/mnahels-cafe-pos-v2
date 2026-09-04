/* Mnahel's Cafe POS v0.15.44 · shift order summary and audit log
 * Owner: Eastern Cross Technology · https://techmint.org
 * A product by Eastern Cross Technology. */
using System.Data.Common;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class OrderLogFeatures
{
    public static void MapApi(RouteGroupBuilder api) => api.MapGet("/shifts/current/order-log", Current);

    private static async Task<IResult> Current(PosDb db)
    {
        var shift = await ShiftFeatures.GetOpenShiftAsync(db);
        if (shift is null) return Results.Ok(new OrderLogResponse());

        var end = shift.ClosedAt ?? DateTimeOffset.Now;
        var orders = (await db.Orders.AsNoTracking().ToListAsync())
            .Where(x => x.CreatedAt >= shift.OpenedAt && x.CreatedAt <= end)
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
        var amendments = await LoadAmendments(db, shift.OpenedAt, end);
        var audit = (await db.AuditLogs.AsNoTracking().ToListAsync())
            .Where(x => x.CreatedAt >= shift.OpenedAt && x.CreatedAt <= end &&
                (x.Action == "OrderStatusUpdated" || x.Action == "PaymentAddedAndCompleted" || x.Action == "PaymentAdded"))
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
        var userNames = (await db.Users.AsNoTracking().ToListAsync()).ToDictionary(x => x.Id, x => new { x.DisplayName, x.Role });

        var events = new List<OrderLogEvent>();
        events.AddRange(orders.Select(x => new OrderLogEvent
        {
            TokenNumber = x.TokenNumber,
            Action = "Started",
            Actor = x.CreatedByName ?? x.CashierName,
            Role = x.CreatedByRole ?? "Cashier",
            Details = $"{x.OrderType} · {x.PaymentStatus}",
            At = x.CreatedAt
        }));
        events.AddRange(amendments.Select(x => new OrderLogEvent
        {
            TokenNumber = x.TokenNumber,
            Action = "Edited",
            Actor = x.UserName,
            Role = x.UserRole,
            Details = x.Summary,
            At = x.CreatedAt
        }));
        foreach (var row in audit)
        {
            var token = Token(row.Details);
            if (token <= 0) continue;
            var action = row.Action == "PaymentAddedAndCompleted" || row.Details.Contains("Completed", StringComparison.OrdinalIgnoreCase)
                ? "Completed"
                : row.Details.Contains("Cancelled", StringComparison.OrdinalIgnoreCase)
                    ? "Cancelled"
                    : row.Action == "PaymentAdded" ? "Payment" : "Updated";
            var user = userNames.GetValueOrDefault(row.UserId);
            events.Add(new OrderLogEvent
            {
                TokenNumber = token,
                Action = action,
                Actor = user?.DisplayName ?? "Cafe staff",
                Role = user?.Role ?? "Staff",
                Details = CleanDetails(row.Details),
                At = row.CreatedAt
            });
        }

        var names = orders.Select(x => new { Name = x.CreatedByName ?? x.CashierName, Role = x.CreatedByRole ?? "Cashier" })
            .Concat(amendments.Select(x => new { Name = x.UserName, Role = x.UserRole }))
            .Concat(events.Where(x => x.Action is "Cancelled" or "Completed").Select(x => new { Name = x.Actor, Role = x.Role }))
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .DistinctBy(x => $"{x.Name}|{x.Role}", StringComparer.OrdinalIgnoreCase)
            .ToList();
        var users = names.Select(x => new OrderLogUser
        {
            Name = x.Name,
            Role = x.Role,
            OrdersStarted = orders.Count(o => string.Equals(o.CreatedByName ?? o.CashierName, x.Name, StringComparison.OrdinalIgnoreCase)),
            Successful = orders.Count(o => o.Status == "Completed" && string.Equals(o.CreatedByName ?? o.CashierName, x.Name, StringComparison.OrdinalIgnoreCase)),
            Edits = amendments.Count(a => string.Equals(a.UserName, x.Name, StringComparison.OrdinalIgnoreCase)),
            Cancelled = events.Count(e => e.Action == "Cancelled" && string.Equals(e.Actor, x.Name, StringComparison.OrdinalIgnoreCase))
        }).OrderByDescending(x => x.OrdersStarted).ThenByDescending(x => x.Edits).ToList();

        return Results.Ok(new OrderLogResponse
        {
            Open = true,
            ShiftNumber = shift.ShiftNumber,
            TotalOrders = orders.Count,
            SuccessfulOrders = orders.Count(x => x.Status == "Completed"),
            ActiveOrders = orders.Count(x => x.Status != "Completed" && x.Status != "Cancelled"),
            CancelledOrders = orders.Count(x => x.Status == "Cancelled"),
            EditedOrders = amendments.Select(x => x.OrderId).Distinct().Count(),
            Users = users,
            Events = events.OrderByDescending(x => x.At).Take(80).ToList()
        });
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

    private static async Task<List<OrderLogAmendment>> LoadAmendments(PosDb db, DateTimeOffset start, DateTimeOffset end)
    {
        var rows = new List<OrderLogAmendment>();
        DbConnection connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;
        try
        {
            if (shouldClose) await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT OrderId, TokenNumber, UserName, UserRole, Summary, CreatedAt FROM OrderAmendments ORDER BY Id DESC";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                if (!DateTimeOffset.TryParse(reader.GetString(5), out var at) || at < start || at > end) continue;
                rows.Add(new OrderLogAmendment
                {
                    OrderId = reader.GetInt64(0),
                    TokenNumber = reader.GetInt32(1),
                    UserName = reader.GetString(2),
                    UserRole = reader.GetString(3),
                    Summary = reader.GetString(4),
                    CreatedAt = at
                });
            }
        }
        catch { }
        finally { if (shouldClose && connection.State == System.Data.ConnectionState.Open) await connection.CloseAsync(); }
        return rows;
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