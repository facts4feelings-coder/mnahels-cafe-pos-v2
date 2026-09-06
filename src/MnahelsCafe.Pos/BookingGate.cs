/* Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using Microsoft.AspNetCore.Http;
static class BookingGate
{
    static readonly SemaphoreSlim Gate = new(1, 1);
    public const string Message = "Pehle shift shuru karein. Shift band hai; order book nahi ho sakta.";
    public static bool IsBooking(string method, string path) => method == "POST" && (path == "/api/orders" || path == "/api/orders/book" || System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/orders/\d+/payment$"));
    public static async Task Run(HttpContext context, Func<Task> next, Func<Task<bool>> open)
    {
        var path = (context.Request.Path.Value ?? "").TrimEnd('/').ToLowerInvariant();
        var booking = IsBooking(context.Request.Method, path);
        // Serialize application mutations, including menu edits and order amendments,
        // with reset/restore and checkout. Reads and authentication remain independent.
        var mutation = (context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE")
            && path.StartsWith("/api/", StringComparison.Ordinal) && !path.StartsWith("/api/auth/", StringComparison.Ordinal);
        if (!mutation) { await next(); return; }
        await Gate.WaitAsync(context.RequestAborted);
        try
        {
            if (booking && !await open())
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(new { code = "SHIFT_REQUIRED", message = Message });
                return;
            }
            await next();
        }
        finally { Gate.Release(); }
    }
}
