/* Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using Microsoft.AspNetCore.Http;
using System.Text.Json;
static class BookingGate
{
    static readonly SemaphoreSlim Gate = new(1, 1);
    public const string Message = "Pehle shift shuru karein. Shift band hai; order book nahi ho sakta.";
    public static bool IsBooking(string method, string path) => method == "POST" && (path == "/api/orders" || path == "/api/orders/book" || System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/orders/\d+/payment$"));

    // JSON binding to a non-nullable decimal otherwise turns an omitted count into zero.
    // Accept only an explicitly supplied JSON number; never derive it from expected cash.
    internal static bool ValidCashCount(JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object) return false;
        var values = body.EnumerateObject().Where(x => x.Name.Equals("actualCash", StringComparison.OrdinalIgnoreCase)).ToList();
        return values.Count == 1 && values[0].Value.ValueKind == JsonValueKind.Number
            && !values[0].Value.GetRawText().StartsWith("-", StringComparison.Ordinal)
            && values[0].Value.TryGetDecimal(out var amount) && amount >= 0 && amount <= 100000000m;
    }

    // Timer work must use the same gate as HTTP requests, but endpoint work already holds it.
    // Skip a busy timer tick instead of queuing backups during a restore or a checkout.
    internal static void TryMaintenance(Action action)
    {
        if (!Gate.Wait(0)) return;
        try { action(); } finally { Gate.Release(); }
    }

    public static async Task Run(HttpContext context, Func<Task> next, Func<Task<bool>> open)
    {
        var path = (context.Request.Path.Value ?? "").TrimEnd('/').ToLowerInvariant();
        if (!path.StartsWith("/api/", StringComparison.Ordinal)) { await next(); return; }
        // Preserve the existing mutation/close guard. Reads and login now participate too:
        // no request can retain a stale DB context across a restore. Single server process only.
        if (context.Request.Method == "POST" && path == "/api/backup/restore")
        {
            if (!await Gate.WaitAsync(0, context.RequestAborted))
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(new { message = "Another operation is active. Wait for it to finish, then confirm restore again." });
                return;
            }
        }
        else await Gate.WaitAsync(context.RequestAborted);
        try
        {
            if (context.Request.Method == "POST" && path == "/api/shifts/close")
            {
                context.Request.EnableBuffering();
                var valid = false;
                try
                {
                    using var body = await JsonDocument.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted);
                    valid = ValidCashCount(body.RootElement);
                }
                catch (JsonException) { }
                finally { context.Request.Body.Position = 0; }
                if (!valid)
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new { code = "CASH_COUNT_REQUIRED", message = "Physically counted cash manually enter karein (0 allowed). Amount must be a valid non-negative number." });
                    return;
                }
            }
            if (IsBooking(context.Request.Method, path) && !await open())
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
