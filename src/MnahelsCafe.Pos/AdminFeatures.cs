using System.Security.Claims;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class AdminFeatures
{
    private const string AdminResetKey = "MNAHEL-ADMIN-RESET-26-9Q7K";

    public static void MapPublic(WebApplication app)
    {
        app.MapPost("/api/auth/reset-admin", async (ResetAdminPasswordRequest request, PosDb db) =>
        {
            if (!string.Equals(request.RecoveryKey?.Trim(), AdminResetKey, StringComparison.Ordinal))
                return Results.BadRequest(new { message = "Invalid admin recovery key." });
            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
                return Results.BadRequest(new { message = "New password must be at least 8 characters." });
            var admin = await db.Users.FirstOrDefaultAsync(x => x.Role == "Admin" && x.IsActive);
            if (admin is null) return Results.NotFound(new { message = "Active admin account not found." });
            admin.PasswordHash = PasswordHash.Create(request.NewPassword);
            db.AuditLogs.Add(new AuditLog { UserId = admin.Id, Action = "AdminPasswordRecovered", Details = "Admin password reset with recovery key" });
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Admin password reset successfully." });
        });
    }

    public static void MapApi(RouteGroupBuilder api)
    {
        api.MapPost("/auth/change-password", async (ChangePasswordRequest request, PosDb db, ClaimsPrincipal principal) =>
        {
            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
                return Results.BadRequest(new { message = "New password must be at least 8 characters." });
            var id = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await db.Users.FindAsync(id);
            if (user is null || !PasswordHash.Verify(request.OldPassword, user.PasswordHash))
                return Results.BadRequest(new { message = "Old password is incorrect." });
            user.PasswordHash = PasswordHash.Create(request.NewPassword);
            db.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "PasswordChanged", Details = "Admin changed password from settings" });
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Password changed successfully." });
        }).RequireAuthorization(p => p.RequireRole("Admin"));

        api.MapGet("/admin/menu", async (PosDb db) => Results.Ok(await db.Categories
            .OrderBy(x => x.SortOrder)
            .Select(c => new
            {
                c.Id, c.Name, c.Icon,
                products = c.Products.OrderBy(p => p.Name).Select(p => new
                {
                    p.Id, p.CategoryId, p.Name, p.Icon, p.Description, p.IsActive, p.IsAvailable,
                    variants = p.Variants.OrderBy(v => v.SortOrder).Select(v => new { v.Id, v.Name, v.Price, v.SortOrder })
                })
            }).ToListAsync())).RequireAuthorization(p => p.RequireRole("Admin"));

        api.MapPost("/products", async (SaveProductRequest request, PosDb db, ClaimsPrincipal principal) =>
        {
            var error = ValidateProduct(request);
            if (error is not null) return Results.BadRequest(new { message = error });
            if (!await db.Categories.AnyAsync(x => x.Id == request.CategoryId)) return Results.BadRequest(new { message = "Category not found." });
            var product = new Product
            {
                CategoryId = request.CategoryId, Name = request.Name.Trim(), Icon = NormalizeIcon(request.Icon), Description = request.Description?.Trim(),
                IsActive = request.IsActive, IsAvailable = request.IsAvailable
            };
            for (var i = 0; i < request.Variants!.Count; i++)
            {
                var v = request.Variants[i];
                product.Variants.Add(new ProductVariant { Name = v.Name.Trim(), Price = Math.Max(0, v.Price), SortOrder = i });
            }
            db.Products.Add(product);
            var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            db.AuditLogs.Add(new AuditLog { UserId = userId, Action = "ProductCreated", Details = product.Name });
            await db.SaveChangesAsync();
            return Results.Ok(new { product.Id });
        }).RequireAuthorization(p => p.RequireRole("Admin"));

        api.MapPut("/products/{id:int}", async (int id, SaveProductRequest request, PosDb db, ClaimsPrincipal principal) =>
        {
            var error = ValidateProduct(request);
            if (error is not null) return Results.BadRequest(new { message = error });
            var product = await db.Products.Include(x => x.Variants).SingleOrDefaultAsync(x => x.Id == id);
            if (product is null) return Results.NotFound(new { message = "Product not found." });
            if (!await db.Categories.AnyAsync(x => x.Id == request.CategoryId)) return Results.BadRequest(new { message = "Category not found." });
            product.CategoryId = request.CategoryId;
            product.Name = request.Name.Trim();
            if (request.Icon is not null) product.Icon = NormalizeIcon(request.Icon);
            product.Description = request.Description?.Trim();
            product.IsActive = request.IsActive;
            product.IsAvailable = request.IsAvailable;
            var keepIds = new HashSet<int>();
            for (var i = 0; i < request.Variants!.Count; i++)
            {
                var input = request.Variants[i];
                var variant = input.Id is > 0 ? product.Variants.FirstOrDefault(x => x.Id == input.Id) : null;
                if (variant is null)
                {
                    variant = new ProductVariant { ProductId = product.Id };
                    product.Variants.Add(variant);
                }
                variant.Name = input.Name.Trim(); variant.Price = Math.Max(0, input.Price); variant.SortOrder = i;
                if (variant.Id > 0) keepIds.Add(variant.Id);
            }
            var removed = product.Variants.Where(x => x.Id > 0 && !keepIds.Contains(x.Id)).ToList();
            db.ProductVariants.RemoveRange(removed);
            var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            db.AuditLogs.Add(new AuditLog { UserId = userId, Action = "ProductUpdated", Details = product.Name });
            await db.SaveChangesAsync();
            return Results.Ok(new { product.Id });
        }).RequireAuthorization(p => p.RequireRole("Admin"));

        api.MapDelete("/products/{id:int}", async (int id, PosDb db, ClaimsPrincipal principal) =>
        {
            var product = await db.Products.FindAsync(id);
            if (product is null) return Results.NotFound(new { message = "Product not found." });
            product.IsActive = false;
            var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            db.AuditLogs.Add(new AuditLog { UserId = userId, Action = "ProductArchived", Details = product.Name });
            await db.SaveChangesAsync();
            return Results.Ok(new { product.Id, product.IsActive });
        }).RequireAuthorization(p => p.RequireRole("Admin"));
    }

    private static string? ValidateProduct(SaveProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Product name is required.";
        if (request.Variants is null || request.Variants.Count == 0) return "At least one price variant is required.";
        if (request.Variants.Any(x => string.IsNullOrWhiteSpace(x.Name))) return "Every variant needs a name.";
        if (request.Variants.Any(x => x.Price < 0)) return "Price cannot be negative.";
        return null;
    }

    private static string? NormalizeIcon(string? value)
    {
        var icon = value?.Trim();
        if (string.IsNullOrWhiteSpace(icon)) return null;
        return icon.Length > 12 ? icon[..12] : icon;
    }
}

record ResetAdminPasswordRequest(string? RecoveryKey, string NewPassword);
record ChangePasswordRequest(string OldPassword, string NewPassword);
record SaveVariantRequest(int? Id, string Name, decimal Price);
record SaveProductRequest(int CategoryId, string Name, string? Icon, string? Description, bool IsActive, bool IsAvailable, List<SaveVariantRequest>? Variants);
