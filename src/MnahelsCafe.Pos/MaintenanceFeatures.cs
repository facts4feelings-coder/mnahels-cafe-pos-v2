using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class MaintenanceFeatures
{
    public const string DatabaseWipePhrase = "mnahel’s_cafe_wipe_db";

    public static void MapApi(RouteGroupBuilder api)
    {
        api.MapPost("/admin/database/wipe", async (DatabaseWipeRequest request, PosDb db) =>
        {
            if (!string.Equals(request.Confirmation?.Trim(), DatabaseWipePhrase, StringComparison.Ordinal))
                return Results.BadRequest(new { message = $"Type {DatabaseWipePhrase} exactly before wiping the database." });

            await using var transaction = await db.Database.BeginTransactionAsync();
            try
            {
                // Factory-reset business data only. Accounts, licensing/activation and backup files
                // are deliberately outside this destructive operation.
                foreach (var table in new[]
                {
                    "ShiftCashMovements", "OrderItems", "Orders", "Shifts", "Customers", "MenuSearchCodes", "ProductVariants",
                    "Products", "Categories", "ServicePeople", "CafeTables", "AuditLogs"
                })
                    await db.Database.ExecuteSqlRawAsync($"DELETE FROM \"{table}\";");

                await db.Database.ExecuteSqlRawAsync(
                    "DELETE FROM \"sqlite_sequence\" WHERE \"name\" IN " +
                    "('ShiftCashMovements','OrderItems','Orders','Shifts','Customers','ProductVariants','Products','Categories','ServicePeople','CafeTables','AuditLogs');");

                db.ChangeTracker.Clear();
                SeedData.Apply(db); // restore the photographed menu and the four default tables
                await transaction.CommitAsync();

                return Results.Ok(new
                {
                    reset = true,
                    message = "Database flash complete. Orders, customers and operational records were wiped; the default menu was restored.",
                    preserved = new[] { "user accounts", "licensing and activation", "backup files" }
                });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }).RequireAuthorization(policy => policy.RequireRole("Admin"));
    }
}

record DatabaseWipeRequest(string? Confirmation);
