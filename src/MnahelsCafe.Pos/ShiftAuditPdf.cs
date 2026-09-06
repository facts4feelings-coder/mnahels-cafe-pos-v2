/* Paginated report using the existing PDF 1.4 technique.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
static class ShiftAuditPdf
{
 const string Brown="0.231 0.157 0.094",Yellow="0.929 0.733 0.094",Cream="1 0.976 0.902",Ink="0.15 0.14 0.12";
 internal static string ActionName(string action,string details="")=>action switch{
 "OrderBookedUnpaid"=>"BOOKED - UNPAID","OrderBookedPaid" or "OrderCreatedPaid"=>"BOOKED - PAID","PaymentAddedAndCompleted"=>"PAID + COMPLETED","PaymentAdded" or "PAYMENT"=>"PAYMENT RECEIVED","OrderEdited" or "EDITED"=>"ITEMS UPDATED","OrderStatusUpdated"=>"STATUS UPDATED",_=>Regex.Replace(action??"",@"(?<=[a-z])(?=[A-Z])"," ").ToUpperInvariant()};
 internal static List<ShiftAuditEvent> Events(ShiftAuditDocument data){var rows=data.Events.Where(e=>e.At<=data.ClosedAt).OrderBy(e=>e.At).ToList();return rows.Where(e=>!(e.Action=="BOOKED"&&rows.Any(r=>r!=e&&r.Token==e.Token&&new[]{"OrderBookedUnpaid","OrderBookedPaid","OrderCreatedPaid"}.Contains(r.Action)&&Math.Abs((r.At-e.At).TotalSeconds)<3))).DistinctBy(e=>(e.Token,e.At,e.Action,e.Actor,e.Role,e.Details)).ToList();}
 public static byte[] Create(string financialPage,ShiftAuditDocument data)
 {
 var pages=new List<string>{financialPage};var c=new StringBuilder();int y=716;string title="SHIFT ACTIVITY LOG";
 void Text(int x,int yy,int size,string value,bool bold=false,string? color=null)=>c.Append($"{color??Ink} rg BT /{(bold?"F2":"F1")} {size} Tf {x} {yy} Td ({Escape(value)}) Tj ET\n");
 void Fill(int x,int yy,int w,int h,string color)=>c.Append($"{color} rg {x} {yy} {w} {h} re f\n");
 void Line(int yy)=>c.Append($"0.86 0.81 0.73 RG 0.5 w 45 {yy} m 550 {yy} l S\n");
 void NewPage(){if(c.Length>0)pages.Add(c.ToString());c.Clear();y=716;Text(45,802,13,"MNAHEL'S CAFE",true,Brown);Text(390,802,10,"THE WORLD OF TASTE",false,Brown);Fill(45,781,505,4,Yellow);Text(45,750,21,title,true,Brown);Text(45,728,10,data.ShiftNumber+"  |  Pakistan Standard Time (UTC+05:00)");Text(45,39,9,"CONFIDENTIAL  |  Eastern Cross Technology",false,Brown);}
 void Need(int h){if(y-h<64)NewPage();}
 void Para(string value,int size=11,bool bold=false,string? color=null){foreach(var line in Wrap(value,481,size)){Need(16);Text(57,y-12,size,line,bold,color);y-=16;}y-=4;}
 void Heading(string value){Need(44);y-=10;Fill(45,y-25,505,28,Brown);Text(57,y-16,12,value,true,"1 1 1");y-=35;}
 void LogHeader(){Need(28);Fill(45,y-25,505,25,Brown);Text(53,y-16,10,"DATE / TIME",true,"1 1 1");Text(163,y-16,10,"ORDER",true,"1 1 1");Text(239,y-16,10,"ACTION",true,"1 1 1");Text(392,y-16,10,"OPERATOR",true,"1 1 1");y-=25;}
 var events=Events(data);var shiftEvents=events.Where(e=>e.At>=data.OpenedAt).ToList();NewPage();y-=6;Para($"{data.Orders.Count} orders  /  {shiftEvents.Count} recorded actions",12,true,Brown);Para("One row per action. Item changes and full operator details appear in Order Details.",10);if(data.Note.StartsWith("Historical",StringComparison.OrdinalIgnoreCase))Para(data.Note,10);y-=8;LogHeader();int row=0;
 foreach(var e in shiftEvents){if(y-27<64){NewPage();y-=12;LogHeader();}if(row++%2==0)Fill(45,y-26,505,26,Cream);Text(53,y-17,10,e.At.ToOffset(TimeSpan.FromHours(5)).ToString("dd MMM HH:mm:ss",CultureInfo.InvariantCulture));Text(163,y-17,10,$"MC-{e.Token}",true);Text(239,y-17,10,Short(ActionName(e.Action),142,10),true);Text(392,y-17,10,Short(e.Actor,148,10));Line(y-26);y-=26;}if(shiftEvents.Count==0)Para("No order activity was recorded during this shift.");
 foreach(var o in data.Orders.OrderBy(x=>x.Token)){
 title=$"ORDER DETAILS / MC-{o.Token}";NewPage();y-=6;Fill(45,y-60,505,60,Cream);Fill(45,y-60,4,60,Yellow);Text(58,y-25,20,$"MC-{o.Token}",true,Brown);Text(58,y-46,11,$"{o.Mode}  |  {o.Status}  |  {o.PaymentStatus}",true);Text(386,y-27,12,$"Rs {o.Total.ToString("#,0.##",CultureInfo.InvariantCulture)}",true,Brown);Text(386,y-46,10,"TOTAL AT SHIFT CLOSE");y-=76;
 if(o.Subtotal.HasValue)Para($"Subtotal: Rs {o.Subtotal:0.##}  |  Discount: Rs {o.Discount.GetValueOrDefault():0.##}",11,true);else Para("Line item values are before any recorded bill discount.",10);
 if(o.Mode!="Dine-in"&&!string.IsNullOrWhiteSpace(o.Customer))Para("Customer: "+o.Customer);
 Heading("ITEMS AT SHIFT CLOSE");var items=(o.Items??"").Split(';',StringSplitOptions.RemoveEmptyEntries|StringSplitOptions.TrimEntries);if(items.Length==0)Para("No item detail available.");foreach(var item in items){Para(item);Line(y+3);y-=5;}
 Heading("ORDER HISTORY / CHANGE DETAILS");Para("Recorded history up to this shift close. Earlier actions are retained for carried orders.",10);
 foreach(var e in events.Where(x=>x.Token==o.Token)){Need(96);y-=6;Fill(45,y-23,505,23,Cream);Text(57,y-15,11,ActionName(e.Action),true,Brown);Text(354,y-15,10,e.At.ToOffset(TimeSpan.FromHours(5)).ToString("dd MMM yyyy HH:mm:ss",CultureInfo.InvariantCulture));y-=32;Para("Operator: "+e.Actor+" ["+e.Role+"]",10);var detail=Regex.Replace(e.Details??"",@"^(Mixed|Addition|Cancellation)\s*\|\s*","",RegexOptions.IgnoreCase);foreach(var part in detail.Split(" | ",StringSplitOptions.RemoveEmptyEntries|StringSplitOptions.TrimEntries))Para(part);Line(y);y-=10;}
 }
 if(c.Length>0)pages.Add(c.ToString());for(int i=0;i<pages.Count;i++)pages[i]+=$"0 g BT /F1 9 Tf 485 23 Td (Page {i+1} / {pages.Count}) Tj ET\n";return Make(pages);
 }
 internal static string Short(string value,int width,int size){var lines=Wrap(value,width,size);return lines.Count<2?lines[0]:Wrap(value,width-14,size)[0].TrimEnd().TrimEnd('.')+"...";}
 internal static List<string> Wrap(string value,int width,int size){var lines=new List<string>();var current=new StringBuilder();double used=0;double Advance(char ch)=>size*("MW@%".Contains(ch)?1.0:"ilI.,:; !'|".Contains(ch)?0.30:char.IsUpper(ch)?0.74:0.61);foreach(char ch in Plain(value)){if(ch=='\n'){lines.Add(current.ToString());current.Clear();used=0;continue;}var advance=Advance(ch);if(used+advance>width&&current.Length>0){var cut=current.ToString().LastIndexOf(' ');if(cut>current.Length/2){var carry=current.ToString()[(cut+1)..];lines.Add(current.ToString()[..cut]);current.Clear();current.Append(carry);used=carry.Sum(Advance);}else{lines.Add(current.ToString());current.Clear();used=0;}}current.Append(ch);used+=advance;}if(current.Length>0||lines.Count==0)lines.Add(current.ToString());return lines;}
 static string Plain(string value)=>new((value??"").Replace("→"," to ").Replace("·"," | ").Replace("—","-").Replace("−","-").Select(x=>x=='\n'||x is >= ' ' and <= '~'?x:'?').ToArray());
 static string Escape(string value)=>Plain(value).Replace("\\","\\\\").Replace("(","\\(").Replace(")","\\)");
 internal static byte[] Make(IReadOnlyList<string> pages){var objects=new List<string>{"<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids ["+string.Join(" ",Enumerable.Range(0,pages.Count).Select(i=>$"{5+i*2} 0 R"))+$"] /Count {pages.Count} >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"};for(int i=0;i<pages.Count;i++){objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {6+i*2} 0 R >>");objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(pages[i])} >>\nstream\n{pages[i]}endstream");}var pdf=new StringBuilder("%PDF-1.4\n");var offsets=new List<int>{0};for(int i=0;i<objects.Count;i++){offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));pdf.Append($"{i+1} 0 obj\n{objects[i]}\nendobj\n");}var xref=Encoding.ASCII.GetByteCount(pdf.ToString());pdf.Append($"xref\n0 {objects.Count+1}\n0000000000 65535 f \n");for(int i=1;i<offsets.Count;i++)pdf.Append($"{offsets[i]:0000000000} 00000 n \n");pdf.Append($"trailer\n<< /Size {objects.Count+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");return Encoding.ASCII.GetBytes(pdf.ToString());}
}
