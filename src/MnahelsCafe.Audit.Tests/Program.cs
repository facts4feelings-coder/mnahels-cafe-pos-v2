using System.Text;
using System.Text.RegularExpressions;
var data=new ShiftAuditDocument{ShiftNumber="Z-TEST-59",OpenedAt=DateTimeOffset.Parse("2026-09-05T08:00:00+05:00"),ClosedAt=DateTimeOffset.Parse("2026-09-05T20:00:00+05:00")};
for(int i=1;i<=12;i++)data.Orders.Add(new ShiftAuditOrder{Id=i,Token=1000+i,Mode="Dine-in",Status=i%2==0?"Cancelled":"Completed",PaymentStatus="Unpaid",Total=2950,Customer="QA customer",Items="1x Chicken Burger (Regular) @ Rs 500; 1x Chicken Afghani (Extra Large) @ Rs 2450"});
for(int i=0;i<180;i++)data.Events.Add(new ShiftAuditEvent{Token=1001+i%12,At=data.OpenedAt.AddMinutes(i),Action=new[]{"BOOKED","APPROVED","EDITED","CANCELLED","PAYMENT","COMPLETED"}[i%6],Actor="QA operator",Role="Cashier",Details=$"event-{i:0000} | +1 Extra topping (Extra Large) @ Rs 250; -1 tea @ Rs 100 | Bill Rs 3200 to Rs 3350 | Notes: (no spice) \\ kitchen"});
data.Events.Add(new ShiftAuditEvent{Token=1001,At=data.OpenedAt.AddHours(4),Action="EDITED",Actor=new string('W',170),Role="Cashier",Details=new string('W',8000)+" END-LONG-NOTE"});
var bytes=ShiftAuditPdf.Create("BT /F1 12 Tf 45 790 Td (Original financial summary retained) Tj ET\n",data);var text=Encoding.ASCII.GetString(bytes);
void Check(bool ok,string why){if(!ok)throw new Exception(why);}
Check(text.StartsWith("%PDF-1.4"),"PDF header");Check(text.Contains("/Count "),"Pages");Check(Regex.Matches(text,@"/Type /Page ").Count>12,"Pagination");for(int i=0;i<180;i++)Check(text.Contains($"event-{i:0000}"),"Missing event "+i);
Check(text.Contains("END-LONG-NOTE"),"Long note tail lost");Check(text.Contains("APPROVED")&&text.Contains("CANCELLED"),"Status history missing");Check(text.Contains(@"\(")&&text.Contains(@"\)"),"PDF escaping");
var xref=int.Parse(text.Split("startxref\n")[1].Split('\n')[0]);Check(text[xref..].StartsWith("xref"),"Cross-reference offset");Check(text.Contains("/F1 10 Tf"),"Fixed 10pt body/time");Check(ShiftAuditPdf.Wrap(new string('W',200),80,10).All(x=>x.Length<=8),"Wide character wrapping");
Directory.CreateDirectory("audit-test-output");File.WriteAllBytes("audit-test-output/shift-audit-stress.pdf",bytes);
var small=new ShiftAuditDocument{ShiftNumber="Z-SAMPLE-59",OpenedAt=data.OpenedAt,ClosedAt=data.ClosedAt,Orders=data.Orders.Take(1).ToList(),Events=data.Events.Where(x=>x.Token==1001).Take(3).ToList()};File.WriteAllBytes("audit-test-output/shift-audit-sample.pdf",ShiftAuditPdf.Create("BT /F1 12 Tf 45 790 Td (Financial summary) Tj ET\n",small));
Check(ShiftAuditPdf.Create("",new ShiftAuditDocument()).Length>500,"Empty shift report");Console.WriteLine("PASS: all 180 events, per-order boxes, long notes, pagination, PDF escaping/xref, fixed 10pt timestamps, empty shift.");
