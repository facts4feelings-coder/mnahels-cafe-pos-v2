/* Adds immutable closing audit data to the existing PDF. No sales/payment changes.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
static class ShiftAuditReport
{
 static Task Ensure(PosDb db)=>db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS ShiftOrderAuditSnapshots (ShiftId INTEGER PRIMARY KEY, PayloadJson TEXT NOT NULL)");
 public static async Task Capture(PosDb db,PosShift shift){await Ensure(db);var json=JsonSerializer.Serialize(await Build(db,shift));await db.Database.ExecuteSqlInterpolatedAsync($"INSERT OR IGNORE INTO ShiftOrderAuditSnapshots (ShiftId,PayloadJson) VALUES ({shift.Id},{json})");}
 public static async Task<ShiftAuditDocument> Read(PosDb db,PosShift shift)
 {
  await Ensure(db);var connection=db.Database.GetDbConnection();var close=connection.State!=System.Data.ConnectionState.Open;
  try{
   if(close)await connection.OpenAsync();await using var command=connection.CreateCommand();command.Transaction=db.Database.CurrentTransaction?.GetDbTransaction();command.CommandText="SELECT PayloadJson FROM ShiftOrderAuditSnapshots WHERE ShiftId=@id";
   var parameter=command.CreateParameter();parameter.ParameterName="@id";parameter.Value=shift.Id;command.Parameters.Add(parameter);
   if(await command.ExecuteScalarAsync() is string json)return JsonSerializer.Deserialize<ShiftAuditDocument>(json)??throw new InvalidOperationException("Saved shift audit is invalid.");
  }finally{if(close)await connection.CloseAsync();}
  var reconstructed=await Build(db,shift);reconstructed.Note="Historical reconstruction: events stop at shift close; item/status snapshot may reflect later changes. Times: UTC+05:00.";return reconstructed;
 }
 static async Task<ShiftAuditDocument> Build(PosDb db,PosShift shift)
 {
  var end=shift.ClosedAt??DateTimeOffset.Now;
  var users=(await db.Users.AsNoTracking().ToListAsync()).ToDictionary(x=>x.Id,x=>(Name:x.DisplayName,Role:x.Role));
  var all=(await db.Orders.Include(x=>x.Items).AsNoTracking().ToListAsync()).Where(x=>x.CreatedAt<=end).ToList();
  var edits=await OrderLogFeatures.LoadAmendments(db,DateTimeOffset.MinValue,end,users,true);
  var audit=(await db.AuditLogs.AsNoTracking().ToListAsync()).Where(x=>x.CreatedAt<=end&&(x.Action.StartsWith("Order",StringComparison.OrdinalIgnoreCase)||x.Action.StartsWith("Payment",StringComparison.OrdinalIgnoreCase))).ToList();
  var touched=edits.Where(x=>x.CreatedAt>=shift.OpenedAt).Select(x=>x.OrderId).ToHashSet();
  var tokens=audit.Where(x=>x.CreatedAt>=shift.OpenedAt).Select(x=>OrderLogFeatures.Token(x.Details)).Where(x=>x>0).ToHashSet();
  var orders=all.Where(x=>x.CreatedAt>=shift.OpenedAt||x.ShiftId==shift.Id||touched.Contains(x.Id)||tokens.Contains(x.TokenNumber)).ToList();
  var ids=orders.Select(x=>x.Id).ToHashSet();var included=orders.Select(x=>x.TokenNumber).ToHashSet();
  var result=new ShiftAuditDocument{ShiftNumber=shift.ShiftNumber,OpenedAt=shift.OpenedAt,ClosedAt=end};
  result.Orders=orders.OrderBy(x=>x.TokenNumber).Select(x=>new ShiftAuditOrder{Id=x.Id,Token=x.TokenNumber,Mode=x.OrderType,Status=x.Status,PaymentStatus=x.PaymentStatus,Total=x.Total,Customer=x.CustomerName??"Walk-in customer",Items=string.Join("; ",x.Items.Select(i=>$"{i.Quantity}x {i.ProductName} ({i.VariantName}) @ Rs {i.UnitPrice:0.##} = Rs {i.LineTotal:0.##}"+(string.IsNullOrWhiteSpace(i.Notes)?"":$" | {i.Notes}")))}).ToList();
  result.Events.AddRange(orders.Select(x=>new ShiftAuditEvent{Token=x.TokenNumber,At=x.CreatedAt,Action="BOOKED",Actor=x.CreatedByName??x.CashierName,Role=x.CreatedByRole??"Cashier",Details=$"{x.OrderType} order booked. See recorded amendments and closing item list below."}));
  result.Events.AddRange(edits.Where(x=>ids.Contains(x.OrderId)).Select(x=>new ShiftAuditEvent{Token=x.TokenNumber,At=x.CreatedAt,Action="EDITED",Actor=x.UserName,Role=x.UserRole,Details=x.Summary}));
  foreach(var row in audit){
   var token=OrderLogFeatures.Token(row.Details);if(!included.Contains(token))continue;
   if(row.Action.Equals("OrderEdited",StringComparison.OrdinalIgnoreCase)&&edits.Any(x=>x.TokenNumber==token&&Math.Abs((x.CreatedAt-row.CreatedAt).TotalSeconds)<2))continue;
   var user=users.GetValueOrDefault(row.UserId);var detail=OrderLogFeatures.CleanDetails(row.Details);
   var action=row.Action=="OrderStatusUpdated"?detail.Contains("Confirmed",StringComparison.OrdinalIgnoreCase)?"APPROVED":detail.Contains("Cancelled",StringComparison.OrdinalIgnoreCase)?"CANCELLED":detail.Contains("Completed",StringComparison.OrdinalIgnoreCase)?"COMPLETED":detail.Contains("Preparing",StringComparison.OrdinalIgnoreCase)?"PREPARING":detail.Contains("Ready",StringComparison.OrdinalIgnoreCase)?"READY":"STATUS UPDATED":row.Action;
   result.Events.Add(new ShiftAuditEvent{Token=token,At=row.CreatedAt,Action=action,Actor=user.Name??"Cafe staff",Role=user.Role??"Staff",Details=detail});
  }
  foreach(var order in orders.Where(x=>x.PaidAt.HasValue&&x.PaidAt.Value<=end)){
   if(result.Events.Any(x=>x.Token==order.TokenNumber&&x.Action.Contains("Payment",StringComparison.OrdinalIgnoreCase)))continue;
   result.Events.Add(new ShiftAuditEvent{Token=order.TokenNumber,At=order.PaidAt!.Value,Action="PAYMENT",Actor=order.PaidBy??order.CashierName,Role=order.PaidByRole??"Cashier",Details=$"{order.PaymentMethod} payment recorded. Rs {order.Total:0.##}"});
  }
  result.Events=result.Events.OrderBy(x=>x.At).ThenBy(x=>x.Token).ToList();return result;
 }
}
