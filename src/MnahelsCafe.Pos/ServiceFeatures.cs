using System.Security.Claims;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class ServiceFeatures
{
    public static void MapApi(RouteGroupBuilder api)
    {
        api.MapGet("/service-hub", Hub);
        api.MapGet("/tables", Tables);

        api.MapPost("/service/people", async (SaveServicePersonRequest request, PosDb db, ClaimsPrincipal principal) =>
        {
            var type = NormalType(request.Type);
            var name = request.Name?.Trim() ?? "";
            var phone = CustomerPhone.Normalize(request.Phone);
            if (type is null) return Results.BadRequest(new { message = "Type Rider ya Waiter hona chahiye." });
            if (name.Length < 2) return Results.BadRequest(new { message = $"{type} name required." });
            if (phone.Length < 7) return Results.BadRequest(new { message = $"{type} phone number required." });
            if (await db.ServicePeople.AnyAsync(x => x.Type == type && x.Phone == phone))
                return Results.BadRequest(new { message = $"Ye {type.ToLowerInvariant()} pehle se list mein hai." });
            var person = new ServicePerson { Type = type, Name = name, Phone = phone, IsActive = true };
            db.ServicePeople.Add(person);
            AddAudit(db, principal, $"{type}Created", $"{name} · {phone}");
            await db.SaveChangesAsync();
            return Results.Ok(new { person.Id, person.Type, person.Name, person.Phone, person.IsActive });
        }).RequireAuthorization(p => p.RequireRole("Admin"));

        api.MapPut("/service/people/{id:int}", async (int id, UpdateServicePersonRequest request, PosDb db, ClaimsPrincipal principal) =>
        {
            var person = await db.ServicePeople.FindAsync(id);
            if (person is null) return Results.NotFound(new { message = "Team member not found." });
            var name = request.Name?.Trim() ?? "";
            var phone = CustomerPhone.Normalize(request.Phone);
            if (name.Length < 2 || phone.Length < 7) return Results.BadRequest(new { message = "Name aur valid phone required hain." });
            if (!request.IsActive && await PersonBusy(db, person))
                return Results.BadRequest(new { message = $"{person.Name} active order par booked hai; order complete/cancel karein." });
            if (await db.ServicePeople.AnyAsync(x => x.Id != id && x.Type == person.Type && x.Phone == phone))
                return Results.BadRequest(new { message = "Ye phone isi list mein pehle se maujood hai." });
            person.Name = name; person.Phone = phone; person.IsActive = request.IsActive;
            AddAudit(db, principal, $"{person.Type}Updated", $"{name} · active={request.IsActive}");
            await db.SaveChangesAsync();
            return Results.Ok(new { person.Id, person.Type, person.Name, person.Phone, person.IsActive });
        }).RequireAuthorization(p => p.RequireRole("Admin"));

        api.MapPost("/service/tables", async (SaveCafeTableRequest request, PosDb db, ClaimsPrincipal principal) =>
        {
            var name = request.Name?.Trim() ?? "";
            if (name.Length < 2) return Results.BadRequest(new { message = "Table name required." });
            var key = name.ToLower();
            if (await db.CafeTables.AnyAsync(x => x.Name.ToLower() == key))
                return Results.BadRequest(new { message = "Ye table name pehle se maujood hai." });
            var table = new CafeTable { Name = name, IsActive = true };
            db.CafeTables.Add(table);
            AddAudit(db, principal, "TableCreated", name);
            await db.SaveChangesAsync();
            return Results.Ok(new { table.Id, table.Name, table.IsActive });
        }).RequireAuthorization(p => p.RequireRole("Admin"));

        api.MapPut("/service/tables/{id:int}", async (int id, UpdateCafeTableRequest request, PosDb db, ClaimsPrincipal principal) =>
        {
            var table = await db.CafeTables.FindAsync(id);
            if (table is null) return Results.NotFound(new { message = "Table not found." });
            var name = request.Name?.Trim() ?? "";
            if (name.Length < 2) return Results.BadRequest(new { message = "Table name required." });
            if (!request.IsActive && await db.Orders.AnyAsync(x => x.TableId == id && x.Status != "Completed" && x.Status != "Cancelled"))
                return Results.BadRequest(new { message = $"{table.Name} booked hai; order complete/cancel karein." });
            var key = name.ToLower();
            if (await db.CafeTables.AnyAsync(x => x.Id != id && x.Name.ToLower() == key))
                return Results.BadRequest(new { message = "Ye table name pehle se maujood hai." });
            table.Name = name; table.IsActive = request.IsActive;
            AddAudit(db, principal, "TableUpdated", $"{name} · active={request.IsActive}");
            await db.SaveChangesAsync();
            return Results.Ok(new { table.Id, table.Name, table.IsActive });
        }).RequireAuthorization(p => p.RequireRole("Admin"));
    }

    private static async Task<IResult> Hub(PosDb db)
    {
        var active = await db.Orders.AsNoTracking()
            .Where(x => x.Status != "Completed" && x.Status != "Cancelled")
            .Select(x => new { x.Id, x.TokenNumber, x.OrderType, x.Status, x.RiderId, x.WaiterId, x.TableId })
            .ToListAsync();
        var people = await db.ServicePeople.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
        var tables = await db.CafeTables.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        var riders = people.Where(x => x.Type == "Rider").Select(x =>
        {
            var order = active.FirstOrDefault(o => o.RiderId == x.Id && !(o.OrderType == "Delivery" && o.Status == "Ready"));
            return new { x.Id, x.Name, x.Phone, x.IsActive, booked = order is not null, tokenNumber = order?.TokenNumber, orderId = order?.Id };
        });
        var waiters = people.Where(x => x.Type == "Waiter").Select(x =>
        {
            var order = active.FirstOrDefault(o => o.WaiterId == x.Id);
            return new { x.Id, x.Name, x.Phone, x.IsActive, booked = order is not null, tokenNumber = order?.TokenNumber, orderId = order?.Id };
        });
        var tableRows = tables.Select(x =>
        {
            var order = active.FirstOrDefault(o => o.TableId == x.Id);
            return new { x.Id, x.Name, x.IsActive, booked = order is not null, occupied = order is not null, tokenNumber = order?.TokenNumber, orderId = order?.Id };
        });
        return Results.Ok(new { riders, waiters, tables = tableRows });
    }

    private static async Task<IResult> Tables(PosDb db)
    {
        var active = await db.Orders.AsNoTracking()
            .Where(x => x.OrderType == "Dine-in" && x.TableId != null && x.Status != "Completed" && x.Status != "Cancelled")
            .Select(x => new { x.TableId, x.Id, x.TokenNumber }).ToListAsync();
        var tables = await db.CafeTables.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Id).ToListAsync();
        return Results.Ok(tables.Select(x =>
        {
            var order = active.FirstOrDefault(o => o.TableId == x.Id);
            return new { number = x.Id, id = x.Id, name = x.Name, occupied = order is not null, orderId = order?.Id, tokenNumber = order?.TokenNumber };
        }));
    }

    private static string? NormalType(string? value)
    {
        var type = value?.Trim();
        if (string.Equals(type, "Rider", StringComparison.OrdinalIgnoreCase)) return "Rider";
        if (string.Equals(type, "Waiter", StringComparison.OrdinalIgnoreCase)) return "Waiter";
        return null;
    }

    private static Task<bool> PersonBusy(PosDb db, ServicePerson person) => person.Type == "Rider"
        ? db.Orders.AnyAsync(x => x.RiderId == person.Id && x.Status != "Completed" && x.Status != "Cancelled" && x.Status != "Ready")
        : db.Orders.AnyAsync(x => x.WaiterId == person.Id && x.Status != "Completed" && x.Status != "Cancelled");

    private static void AddAudit(PosDb db, ClaimsPrincipal principal, string action, string details)
    {
        if (int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            db.AuditLogs.Add(new AuditLog { UserId = userId, Action = action, Details = details });
    }
}

record SaveServicePersonRequest(string Type, string Name, string Phone);
record UpdateServicePersonRequest(string Name, string Phone, bool IsActive);
record SaveCafeTableRequest(string Name);
record UpdateCafeTableRequest(string Name, bool IsActive);

class ServicePerson
{
    public int Id { get; set; }
    public string Type { get; set; } = "Rider";
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

class CafeTable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
}
