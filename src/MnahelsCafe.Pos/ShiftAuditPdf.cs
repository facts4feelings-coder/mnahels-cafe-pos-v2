/* Same lightweight PDF 1.4 writer as the existing Z-report, now paginated.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using System.Globalization;
using System.Text;
static class ShiftAuditPdf
{
 public static byte[] Create(string financialPage,ShiftAuditDocument data)
 {
  var pages=new List<string>{financialPage};var c=new StringBuilder();int y=744;string section="SHIFT ORDER LOG";
  void Text(int x,int yy,int size,string text,bool bold=false,bool white=false)=>c.Append($"{(white?"1 1 1":"0 0 0")} rg BT /{(bold?"F2":"F1")} {size} Tf {x} {yy} Td ({Escape(text)}) Tj ET\n");
  void Box(int x,int yy,int width,int height,bool black=false)=>c.Append($"{(black?"0 g":"0.72 G 0.6 w")} {x} {yy} {width} {height} re {(black?"f":"S")} 0 G\n");
  void NewPage(){if(c.Length>0)pages.Add(c.ToString());c.Clear();y=744;Box(45,766,505,54,true);Text(57,799,16,"MNAHEL'S CAFE",true,true);Text(57,779,10,data.ShiftNumber+" | "+section,true,true);Text(45,42,9,"CONFIDENTIAL | Eastern Cross Technology | Times: UTC+05:00");}
  void Need(int height){if(y-height<64)NewPage();}
  void Paragraph(string value,bool bold=false){foreach(var line in Wrap(value,483,10)){Need(18);Box(45,y-17,505,18);Text(56,y-12,10,line,bold);y-=18;}}
  void Bar(string value){Need(28);Box(45,y-24,505,24,true);Text(56,y-16,10,value,true,true);y-=24;}
  void TableHead(){Need(30);Box(45,y-24,505,24,true);Text(51,y-16,9,"DATE / TIME",true,true);Text(140,y-16,9,"ACTION",true,true);Text(232,y-16,9,"OPERATOR",true,true);Text(340,y-16,9,"DETAILS",true,true);y-=24;}
  void Event(ShiftAuditEvent item,bool showToken){
   var when=item.At.ToOffset(TimeSpan.FromHours(5));
   var cells=new[]{new List<string>{when.ToString("dd MMM yyyy",CultureInfo.InvariantCulture),when.ToString("hh:mm:ss tt",CultureInfo.InvariantCulture)},Wrap((showToken?$"MC-{item.Token} | ":"")+item.Action,80,10),Wrap(item.Actor+" ["+item.Role+"]",98,10),Wrap(item.Details,204,10)};
   int count=cells.Max(x=>x.Count),offset=0;
   while(offset<count){if(y<120){NewPage();TableHead();}var lines=Math.Min(count-offset,Math.Max(1,(y-76)/14));int height=lines*14+12;int[] xs=[45,134,226,334],widths=[89,92,108,216];for(int col=0;col<4;col++){Box(xs[col],y-height,widths[col],height);for(int row=0;row<lines;row++)if(offset+row<cells[col].Count)Text(xs[col]+6,y-16-row*14,10,cells[col][offset+row],col==1);}y-=height;offset+=lines;}
  }
  NewPage();foreach(var line in Wrap(data.Note,505,10)){Text(45,y,10,line);y-=14;}y-=10;
  var shiftEvents=data.Events.Where(e=>e.At>=data.OpenedAt&&e.At<=data.ClosedAt).OrderBy(e=>e.At).ToList();Bar($"{data.Orders.Count} ORDERS | {shiftEvents.Count} ACTIONS DURING THIS SHIFT");TableHead();
  if(shiftEvents.Count==0)Paragraph("No order activity recorded during this shift.");foreach(var item in shiftEvents)Event(item,true);
  foreach(var order in data.Orders.OrderBy(x=>x.Token)){
   section=$"ORDER MC-{order.Token} | DETAILED HISTORY";if(y<260)NewPage();else y-=18;
   Bar($"MC-{order.Token} | {order.Mode} | {order.Status} | {order.PaymentStatus}");
   Paragraph($"Customer: {order.Customer} | Closing total: Rs {order.Total.ToString("0.##",CultureInfo.InvariantCulture)}",true);
   Paragraph("ITEMS AT CLOSING SNAPSHOT: "+(string.IsNullOrWhiteSpace(order.Items)?"No item detail available.":order.Items));Paragraph("Recorded history through this shift close (includes earlier activity for carried orders).");TableHead();
   foreach(var item in data.Events.Where(x=>x.Token==order.Token&&x.At<=data.ClosedAt).OrderBy(x=>x.At))Event(item,false);
  }
  if(c.Length>0)pages.Add(c.ToString());for(int i=0;i<pages.Count;i++)pages[i]+=$"0 g BT /F1 9 Tf 487 23 Td (Page {i+1} / {pages.Count}) Tj ET\n";return Make(pages);
 }
 internal static List<string> Wrap(string value,int width,int size){
  var lines=new List<string>();var current=new StringBuilder();double used=0;
  foreach(char ch in Plain(value)){
   if(ch=='\n'){lines.Add(current.ToString());current.Clear();used=0;continue;}
   var advance=size*("MW@%".Contains(ch)?1.0:"ilI.,:; !'|".Contains(ch)?0.30:char.IsUpper(ch)?0.74:0.61);
   if(used+advance>width&&current.Length>0){var cut=current.ToString().LastIndexOf(' ');if(cut>current.Length/2){var carry=current.ToString()[(cut+1)..];lines.Add(current.ToString()[..cut]);current.Clear();current.Append(carry);used=carry.Sum(x=>size*("MW@%".Contains(x)?1.0:"ilI.,:; !'|".Contains(x)?0.30:char.IsUpper(x)?0.74:0.61));}else{lines.Add(current.ToString());current.Clear();used=0;}}
   current.Append(ch);used+=advance;
  }
  if(current.Length>0||lines.Count==0)lines.Add(current.ToString());return lines;
 }
 static string Plain(string value)=>new(value.Replace("→"," to ").Replace("·"," | ").Replace("—","-").Replace("−","-").Select(x=>x=='\n'||x is >= ' ' and <= '~'?x:'?').ToArray());
 static string Escape(string value)=>Plain(value).Replace("\\","\\\\").Replace("(","\\(").Replace(")","\\)");
 internal static byte[] Make(IReadOnlyList<string> pages){
  var objects=new List<string>{"<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids ["+string.Join(" ",Enumerable.Range(0,pages.Count).Select(i=>$"{5+i*2} 0 R"))+$"] /Count {pages.Count} >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"};
  for(int i=0;i<pages.Count;i++){objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {6+i*2} 0 R >>");objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(pages[i])} >>\nstream\n{pages[i]}endstream");}
  var pdf=new StringBuilder("%PDF-1.4\n");var offsets=new List<int>{0};for(int i=0;i<objects.Count;i++){offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));pdf.Append($"{i+1} 0 obj\n{objects[i]}\nendobj\n");}
  var xref=Encoding.ASCII.GetByteCount(pdf.ToString());pdf.Append($"xref\n0 {objects.Count+1}\n0000000000 65535 f \n");for(int i=1;i<offsets.Count;i++)pdf.Append($"{offsets[i]:0000000000} 00000 n \n");pdf.Append($"trailer\n<< /Size {objects.Count+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");return Encoding.ASCII.GetBytes(pdf.ToString());
 }
}
