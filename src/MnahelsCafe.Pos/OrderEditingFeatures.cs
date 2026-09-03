/*
 * Mnahel's Cafe POS · booked-order editing
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
using System.Security.Claims;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class OrderEditingFeatures
{
    public static void MapApi(RouteGroupBuilder api)
    {
        api.MapGet("/orders/{id:long}/edit", LoadOrder);
        api.MapPut("/orders/{id:long}", UpdateOrder);
    }

    private static async Task<IResult> LoadOrder(long id, PosDb db)
    {
        var order = await db.Orders.Include(x => x.Items).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        return order is null
            ? Results.NotFound(new { message = "Order not found." })
            : Results.Ok(OrderView.From(order));
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

        var variantIds = request.Items.Select(x => x.VariantId).Distinct().ToList();
        var variants = await db.ProductVariants.Include(x => x.Product)
            .Where(x => variantIds.Contains(x.Id) && x.Product!.IsActive && x.Product.IsAvailable)
            .ToDictionaryAsync(x => x.Id);
        if (variants.Count != variantIds.Count)
            return Results.BadRequest(new { message = "Ek ya zyada selected items ab available nahi hain." });

        var oldTotal = order.Total;
        var oldUnits = order.Items.Sum(x => x.Quantity);
        await using var transaction = await db.Database.BeginTransactionAsync();

        db.OrderItems.RemoveRange(order.Items.ToList());
        order.Items.Clear();
        foreach (var line in request.Items)
        {
            var variant = variants[line.VariantId];
            var quantity = Math.Clamp(line.Quantity, 1, 99);
            order.Items.Add(new OrderItem
            {
                ProductName = variant.Product!.Name,
                VariantName = variant.Name,
                Quantity = quantity,
                UnitPrice = variant.Price,
                LineTotal = variant.Price * quantity,
                Notes = string.IsNullOrWhiteSpace(line.Notes) ? null : line.Notes.Trim()
            });
        }

        order.Subtotal = order.Items.Sum(x => x.LineTotal);
        order.Discount = Math.Clamp(request.Discount, 0, order.Subtotal);
        order.Total = order.Subtotal - order.Discount;
        order.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        order.Status = "New";
        order.KitchenStatus = "Pending";

        var newUnits = order.Items.Sum(x => x.Quantity);
        ShiftFeatures.Audit(db, principal, "OrderEdited", $"MC-{order.TokenNumber} · items {oldUnits}->{newUnits} · Rs {oldTotal:0.##}->{order.Total:0.##}");
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(OrderView.From(order));
    }
}

record UpdateBookedOrderRequest(List<CreateOrderLine> Items, decimal Discount, string? Notes);
