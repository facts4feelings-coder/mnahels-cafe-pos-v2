/* Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

// Runs inside BookingGate: application writes cannot race this check and the save.
// Legacy clients without these headers retain their existing API contract.
static class CheckoutSafety
{
    public static async Task<IResult?> Validate(EndpointFilterInvocationContext context)
    {
        var request = context.HttpContext.Request;
        var path = (request.Path.Value ?? "").TrimEnd('/').ToLowerInvariant();
        if (request.Method is "GET" or "HEAD" || !path.StartsWith("/api/orders", StringComparison.Ordinal)) return null;
        var epoch = request.Headers["X-Cafe-Epoch"].ToString();
        var expected = request.Headers["X-Cafe-Cart"].ToString();
        if (epoch.Length == 0 && expected.Length == 0) return null;
        var db = context.HttpContext.RequestServices.GetRequiredService<PosDb>();
        if (epoch.Length == 0 || epoch != MenuCatalog.Stamp(db).Epoch)
            return Results.Conflict(new { code = "DATABASE_CHANGED", message = "Database reset/restore hua hai. Screen reload karein; purana order dobara submit na karein." });
        var lines = context.Arguments.OfType<CreateOrderRequest>().FirstOrDefault()?.Items
            ?? context.Arguments.OfType<BookOrderRequest>().FirstOrDefault()?.Items
            ?? context.Arguments.OfType<UpdateBookedOrderRequest>().FirstOrDefault()?.Items;
        if (lines is null) return null; // Later payment/status use the saved bill, not live menu pricing.
        if (expected.Length == 0 || expected.Length > 16384) return Invalid();
        List<ExpectedLine>? prices;
        try { prices = JsonSerializer.Deserialize<List<ExpectedLine>>(expected, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
        catch (JsonException) { return Invalid(); }
        var active = lines.Where(x => x.Quantity > 0).ToList();
        if (prices is null || prices.Count != active.Count || active.Count == 0) return Invalid();
        var ids = active.Select(x => x.VariantId).Distinct().ToList();
        var variants = await db.ProductVariants.AsNoTracking().Include(x => x.Product)
            .Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id);
        for (var i = 0; i < active.Count; i++)
        {
            var line = active[i]; var price = prices[i];
            if (price is null || price.VariantId != line.VariantId || price.Quantity != line.Quantity || line.Quantity > 99 || price.UnitPrice < 0) return Invalid();
            if (!variants.TryGetValue(line.VariantId, out var variant) || variant.Product is not { IsActive: true, IsAvailable: true })
                return Results.Conflict(new { code = "ITEM_UNAVAILABLE", message = "Cart ka item ab available nahi. Cart review karke unavailable item remove karein." });
            if (price.UnitPrice != variant.Price)
                return Results.Conflict(new { code = "CART_PRICE_CHANGED", message = "Menu price badal gayi hai. Order save nahi hua. Cart review karein; changed item remove karke nayi price par add karein (running order ho to edit dobara kholein)." });
        }
        return null;
    }
    static IResult Invalid() => Results.BadRequest(new { code = "CART_REVIEW_REQUIRED", message = "Cart verify nahi hua. Screen aur quantities review karein; order save nahi hua." });
    sealed record ExpectedLine(int VariantId, int Quantity, decimal UnitPrice);
}
