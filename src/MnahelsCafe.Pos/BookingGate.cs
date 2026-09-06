/* Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using Microsoft.AspNetCore.Http;
static class BookingGate
{
 static readonly SemaphoreSlim Gate=new(1,1);
 public const string Message="Pehle shift shuru karein. Shift band hai; order book nahi ho sakta.";
 public static bool IsBooking(string method,string path)=>method=="POST"&&(path=="/api/orders"||path=="/api/orders/book"||System.Text.RegularExpressions.Regex.IsMatch(path,@"^/api/orders/\d+/payment$"));
 public static async Task Run(HttpContext context,Func<Task> next,Func<Task<bool>> open){var path=(context.Request.Path.Value??"").TrimEnd('/').ToLowerInvariant();var booking=IsBooking(context.Request.Method,path);var closing=context.Request.Method=="POST"&&(path=="/api/shifts/close"||path=="/api/admin/database/wipe"||path=="/api/backup/restore");if(!booking&&!closing){await next();return;}await Gate.WaitAsync(context.RequestAborted);try{if(booking&&!await open()){context.Response.StatusCode=StatusCodes.Status409Conflict;await context.Response.WriteAsJsonAsync(new{code="SHIFT_REQUIRED",message=Message});return;}await next();}finally{Gate.Release();}}
}
