/* Mnahel's Cafe POS · Shift Closing / Z-Report
 * Owner: TechMint Software Solutions · https://techmint.org
 * A product by TechMint Software Solutions. */
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

static class ShiftFeatures
{
    public const string MainCounter="Main Counter";
    public static void MapApi(RouteGroupBuilder api){
        api.MapGet("/shifts/current",Current);api.MapPost("/shifts/open",Open);api.MapPost("/shifts/movements",Movement);api.MapPost("/shifts/close",Close);api.MapGet("/shifts/history",History);api.MapGet("/shifts/{id:long}",Detail);api.MapGet("/shifts/{id:long}/z-report.pdf",Pdf);
    }
    internal static Task<PosShift?> GetOpenShiftAsync(PosDb db)=>db.Shifts.FirstOrDefaultAsync(x=>x.CounterName==MainCounter&&x.Status=="Open");
    internal static IResult ShiftRequired()=>Results.Conflict(new{code="SHIFT_REQUIRED",message="Paid order ke liye Main Counter shift start karein. Unpaid booking allowed hai."});
    static int? Uid(ClaimsPrincipal p)=>int.TryParse(p.FindFirstValue(ClaimTypes.NameIdentifier),out var id)?id:null;
    static string Name(ClaimsPrincipal p)=>p.Identity?.Name??"Cafe staff";
    static string Role(ClaimsPrincipal p)=>p.FindFirstValue(ClaimTypes.Role)??"Staff";
    internal static void StampCreated(Order o,ClaimsPrincipal p){o.CreatedByUserId=Uid(p);o.CreatedByName=Name(p);o.CreatedByRole=Role(p);}
    internal static void StampPayment(Order o,PosShift s,ClaimsPrincipal p){o.ShiftId=s.Id;o.Shift=s;o.CashierName=s.CashierName;o.PaidBy=Name(p);o.PaidByUserId=Uid(p);o.PaidByRole=Role(p);}
    internal static void Audit(PosDb db,ClaimsPrincipal p,string action,string details){if(Uid(p)is int id)db.AuditLogs.Add(new AuditLog{UserId=id,Action=action,Details=details});}
    static async Task<IResult> Current(PosDb db){var s=await GetOpenShiftAsync(db);return s is null?Results.Ok(new{open=false,counterName=MainCounter}):Results.Ok(await Summary(db,s));}
    static async Task<IResult> Open(OpenShiftRequest r,PosDb db,ClaimsPrincipal p){
        if(r.OpeningCash<0||r.OpeningCash>100000000)return Results.BadRequest(new{message="Opening cash valid amount honi chahiye."});
        if(await GetOpenShiftAsync(db)is not null)return Results.Conflict(new{message="Main Counter ki shift pehle se open hai."});
        var uid=Uid(p);var role=Role(p);AppUser? cashier=null;
        if(uid.HasValue&&role.Equals("Cashier",StringComparison.OrdinalIgnoreCase))cashier=await db.Users.FirstOrDefaultAsync(x=>x.Id==uid&&x.IsActive);
        cashier??=await db.Users.OrderBy(x=>x.Id).FirstOrDefaultAsync(x=>x.IsActive&&x.Role=="Cashier");
        if(cashier is null)return Results.BadRequest(new{message="Active cashier account nahi mila."});
        var now=DateTimeOffset.Now;var n=(await db.Shifts.MaxAsync(x=>(long?)x.Id)??0)+1;
        var s=new PosShift{ShiftNumber=$"Z-{now:yyyyMMdd}-{n:0000}",CounterName=MainCounter,CashierUserId=cashier.Id,CashierName=cashier.DisplayName,OpeningCash=r.OpeningCash,OpenedAt=now,OpenedByUserId=uid??cashier.Id,OpenedByName=Name(p),OpenedByRole=role,Status="Open"};
        db.Shifts.Add(s);Audit(db,p,"ShiftOpened",$"{s.ShiftNumber} · Cashier {s.CashierName} · Opening Rs {s.OpeningCash:0.##}");
        try{await db.SaveChangesAsync();}catch(DbUpdateException){return Results.Conflict(new{message="Shift kisi aur session ne start kar di hai. Refresh karein."});}
        return Results.Ok(await Summary(db,s));
    }
    static async Task<IResult> Movement(ShiftMovementRequest r,PosDb db,ClaimsPrincipal p){
        var s=await GetOpenShiftAsync(db);if(s is null)return ShiftRequired();if(r.Amount<=0||r.Amount>100000000)return Results.BadRequest(new{message="Valid cash amount enter karein."});
        var type=r.Type?.Trim().ToLowerInvariant() switch{"cashin" or "in" or "add"=>"CashIn","cashout" or "out" or "expense" or "withdrawal"=>"CashOut",_=>null};if(type is null)return Results.BadRequest(new{message="Cash In ya Cash Out select karein."});
        var reason=r.Purpose?.Trim();if(string.IsNullOrWhiteSpace(reason))return Results.BadRequest(new{message="Cash movement ka purpose required hai."});if(reason.Length>200)reason=reason[..200];
        db.ShiftCashMovements.Add(new ShiftCashMovement{ShiftId=s.Id,Shift=s,Type=type,Amount=r.Amount,Purpose=reason,CreatedAt=DateTimeOffset.Now,CreatedByUserId=Uid(p),CreatedByName=Name(p),CreatedByRole=Role(p)});Audit(db,p,type=="CashIn"?"ShiftCashAdded":"ShiftCashGiven",$"{s.ShiftNumber} · Rs {r.Amount:0.##} · {reason}");await db.SaveChangesAsync();return Results.Ok(await Summary(db,s));
    }
    static async Task<IResult> Close(CloseShiftRequest r,PosDb db,ClaimsPrincipal p){
        var s=await GetOpenShiftAsync(db);if(s is null)return Results.Conflict(new{message="Koi open Main Counter shift nahi hai."});var uid=Uid(p);if(!uid.HasValue)return Results.Unauthorized();var u=await db.Users.SingleOrDefaultAsync(x=>x.Id==uid&&x.IsActive);
        if(u is null||string.IsNullOrWhiteSpace(r.Password)||!PasswordHash.Verify(r.Password,u.PasswordHash))return Results.BadRequest(new{message="Sign-off password/PIN sahi nahi hai."});var role=Role(p);if(role=="Cashier"&&s.CashierUserId!=u.Id)return Results.Json(new{message="Assigned cashier hi shift close kar sakta hai."},statusCode:403);
        var live=await Summary(db,s);var diff=r.ActualCash-live.ExpectedCash;var dr=r.DifferenceReason?.Trim();if(Math.Abs(diff)>=.01m&&string.IsNullOrWhiteSpace(dr))return Results.BadRequest(new{message="Shortage/extra ka reason required hai."});
        s.Status="Closed";s.ClosedAt=DateTimeOffset.Now;s.ExpectedCash=live.ExpectedCash;s.ActualCash=r.ActualCash;s.Difference=diff;s.DifferenceReason=string.IsNullOrWhiteSpace(dr)?null:dr;s.ClosedByUserId=u.Id;s.ClosedByName=u.DisplayName;s.ClosedByRole=u.Role;s.AdminOverrideReason=null;Audit(db,p,role=="Admin"?"ShiftClosedByAdmin":"ShiftClosed",$"{s.ShiftNumber} · Expected Rs {live.ExpectedCash:0.##} · Actual Rs {r.ActualCash:0.##} · Difference Rs {diff:0.##}");await db.SaveChangesAsync();return Results.Ok(await Summary(db,s));
    }
    static async Task<IResult> Detail(long id,PosDb db){var s=await db.Shifts.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==id);return s is null?Results.NotFound(new{message="Shift not found."}):Results.Ok(await Summary(db,s));}
    static async Task<IResult> History(PosDb db,int take=30){
        take=Math.Clamp(take,1,100);var shifts=(await db.Shifts.AsNoTracking().ToListAsync()).OrderByDescending(x=>x.OpenedAt).Take(take).ToList();var ids=shifts.Select(x=>x.Id).ToHashSet();var orders=(await db.Orders.AsNoTracking().Where(x=>x.ShiftId!=null).ToListAsync()).Where(x=>x.ShiftId.HasValue&&ids.Contains(x.ShiftId.Value)&&x.PaymentStatus=="Paid"&&x.Status!="Cancelled").ToList();var moves=(await db.ShiftCashMovements.AsNoTracking().ToListAsync()).Where(x=>ids.Contains(x.ShiftId)).ToList();
        return Results.Ok(shifts.Select(s=>{var p=orders.Where(x=>x.ShiftId==s.Id).ToList();var m=moves.Where(x=>x.ShiftId==s.Id).ToList();var cash=p.Where(x=>x.PaymentMethod=="Cash").Sum(x=>x.Total);var ci=m.Where(x=>x.Type=="CashIn").Sum(x=>x.Amount);var co=m.Where(x=>x.Type=="CashOut").Sum(x=>x.Amount);return new{s.Id,s.ShiftNumber,s.CounterName,s.CashierName,s.Status,s.OpenedAt,s.ClosedAt,s.OpeningCash,totalPaidSales=p.Sum(x=>x.Total),paidOrders=p.Count,cashSales=cash,cardSales=p.Where(x=>x.PaymentMethod=="Card").Sum(x=>x.Total),onlineSales=p.Where(x=>x.PaymentMethod=="Online").Sum(x=>x.Total),cashAdded=ci,cashOut=co,expectedCash=s.ExpectedCash??s.OpeningCash+cash+ci-co,s.ActualCash,difference=s.Difference};}));
    }
    static async Task<IResult> Pdf(long id,PosDb db){var s=await db.Shifts.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==id);if(s is null)return Results.NotFound();if(s.Status!="Closed")return Results.Conflict(new{message="Z-report ke liye pehle shift close karein."});var b=ZPdf.Create(await Summary(db,s));return Results.File(b,"application/pdf",$"Mnahels-{s.ShiftNumber}-Z-Report.pdf");}
    static async Task<ShiftSummary> Summary(PosDb db,PosShift s){
        var paid=(await db.Orders.Include(x=>x.Items).AsNoTracking().Where(x=>x.ShiftId==s.Id).ToListAsync()).Where(x=>x.PaymentStatus=="Paid"&&x.Status!="Cancelled").ToList();var end=s.ClosedAt??DateTimeOffset.Now;var window=(await db.Orders.AsNoTracking().Where(x=>x.PaymentStatus!="Paid"||x.Status=="Cancelled").ToListAsync()).Where(x=>x.CreatedAt>=s.OpenedAt&&x.CreatedAt<=end).ToList();var outstanding=window.Where(x=>x.PaymentStatus!="Paid"&&x.Status!="Cancelled").ToList();var moves=(await db.ShiftCashMovements.AsNoTracking().Where(x=>x.ShiftId==s.Id).ToListAsync()).OrderByDescending(x=>x.CreatedAt).ToList();
        var cash=paid.Where(x=>x.PaymentMethod=="Cash").Sum(x=>x.Total);var card=paid.Where(x=>x.PaymentMethod=="Card").Sum(x=>x.Total);var online=paid.Where(x=>x.PaymentMethod=="Online").Sum(x=>x.Total);var ci=moves.Where(x=>x.Type=="CashIn").Sum(x=>x.Amount);var co=moves.Where(x=>x.Type=="CashOut").Sum(x=>x.Amount);var expected=s.Status=="Closed"&&s.ExpectedCash.HasValue?s.ExpectedCash.Value:s.OpeningCash+cash+ci-co;
        return new ShiftSummary{Open=s.Status=="Open",Id=s.Id,ShiftNumber=s.ShiftNumber,CounterName=s.CounterName,CashierName=s.CashierName,Status=s.Status,OpenedAt=s.OpenedAt,OpenedByName=s.OpenedByName,OpenedByRole=s.OpenedByRole,ClosedAt=s.ClosedAt,ClosedByName=s.ClosedByName,ClosedByRole=s.ClosedByRole,OpeningCash=s.OpeningCash,GrossSales=paid.Sum(x=>x.Subtotal),Discounts=paid.Sum(x=>x.Discount),TotalPaidSales=paid.Sum(x=>x.Total),PaidOrders=paid.Count,CashSales=cash,CardSales=card,OnlineSales=online,OutstandingOrders=outstanding.Count,OutstandingAmount=outstanding.Sum(x=>x.Total),CancelledOrders=window.Count(x=>x.Status=="Cancelled"),CashAdded=ci,CashOut=co,ExpectedCash=expected,ActualCash=s.ActualCash,Difference=s.Difference,DifferenceReason=s.DifferenceReason,AdminOverrideReason=s.AdminOverrideReason,Operators=paid.GroupBy(x=>new{Name=x.PaidBy??"Unknown",Role=x.PaidByRole??"Cashier"}).Select(g=>new ShiftOperator{Name=g.Key.Name,Role=g.Key.Role,Orders=g.Count(),Cash=g.Where(x=>x.PaymentMethod=="Cash").Sum(x=>x.Total),Card=g.Where(x=>x.PaymentMethod=="Card").Sum(x=>x.Total),Online=g.Where(x=>x.PaymentMethod=="Online").Sum(x=>x.Total),Total=g.Sum(x=>x.Total)}).OrderByDescending(x=>x.Total).ToList(),RecentPayments=paid.OrderByDescending(x=>x.PaidAt).Take(20).Select(x=>new ShiftPayment{TokenNumber=x.TokenNumber,OrderType=x.OrderType,PaymentMethod=x.PaymentMethod,Total=x.Total,PaidAt=x.PaidAt??x.CreatedAt,CreatedByName=x.CreatedByName??x.CashierName,CreatedByRole=x.CreatedByRole??"Cashier",PaidByName=x.PaidBy??x.CashierName,PaidByRole=x.PaidByRole??"Cashier"}).ToList(),Movements=moves.Select(x=>new ShiftMove{Id=x.Id,Type=x.Type,Amount=x.Amount,Purpose=x.Purpose,CreatedAt=x.CreatedAt,CreatedByName=x.CreatedByName,CreatedByRole=x.CreatedByRole}).ToList(),TopItems=paid.SelectMany(x=>x.Items).GroupBy(x=>x.ProductName).Select(g=>new ShiftTop{Name=g.Key,Quantity=g.Sum(x=>x.Quantity),Sales=g.Sum(x=>x.LineTotal)}).OrderByDescending(x=>x.Quantity).Take(8).ToList()};
    }
    static class ZPdf
    {
        public static byte[] Create(ShiftSummary s)
        {
            var c=new StringBuilder();
            void Text(int x,int y,int size,string value,bool bold=false,bool white=false)
            {
                c.Append(white?"1 1 1 rg\n":"0 0 0 rg\n");
                c.Append($"BT /{(bold?"F2":"F1")} {size} Tf {x} {y} Td ({Esc(Ascii(value))}) Tj ET\n");
            }
            void Fill(int x,int y,int width,int height,string gray)
            {
                c.Append($"{gray} g {x} {y} {width} {height} re f 0 g\n");
            }
            void Box(int x,int y,int width,int height)
            {
                c.Append($"0.68 G 0.8 w {x} {y} {width} {height} re S 0 G\n");
            }
            void Line(int x1,int y1,int x2,int y2)
            {
                c.Append($"0.78 G 0.6 w {x1} {y1} m {x2} {y2} l S 0 G\n");
            }
            void Section(int y,string title)
            {
                Fill(45,y-3,505,22,"0.91");Box(45,y-3,505,22);Text(55,y+4,10,title,true);
            }
            void MoneyRow(ref int y,string label,decimal value,bool strong=false)
            {
                Text(58,y,9,label,strong);Text(452,y,9,Money(value),true);Line(55,y-5,540,y-5);y-=18;
            }

            Fill(35,760,525,62,"0.08");
            Text(52,798,22,"MNAHEL'S CAFE",true,true);
            Text(52,779,9,"THE WORLD OF TASTE",true,true);
            Text(365,796,11,"SHIFT CLOSING",true,true);
            Text(405,780,10,"Z-REPORT",true,true);

            Box(45,712,505,36);
            Text(55,735,11,$"REPORT  {s.ShiftNumber}",true);
            Text(330,735,9,$"COUNTER  {s.CounterName}",true);
            Text(55,719,8,$"Opened  {s.OpenedAt.LocalDateTime:dd MMM yyyy, hh:mm:ss tt}");
            Text(330,719,8,$"Closed  {s.ClosedAt?.LocalDateTime:dd MMM yyyy, hh:mm:ss tt}");

            Section(688,"SALES & DRAWER RECONCILIATION");
            var y=665;
            MoneyRow(ref y,"Opening cash",s.OpeningCash);
            MoneyRow(ref y,"Gross sales",s.GrossSales);
            MoneyRow(ref y,"Discounts",s.Discounts);
            MoneyRow(ref y,"Net paid sales",s.TotalPaidSales,true);
            MoneyRow(ref y,"Cash sales",s.CashSales);
            MoneyRow(ref y,"Card sales",s.CardSales);
            MoneyRow(ref y,"Online sales",s.OnlineSales);
            MoneyRow(ref y,"Cash added",s.CashAdded);
            MoneyRow(ref y,"Cash given / expenses",s.CashOut);
            MoneyRow(ref y,"Outstanding amount",s.OutstandingAmount);
            MoneyRow(ref y,"Expected drawer cash",s.ExpectedCash,true);
            MoneyRow(ref y,"Actual cash counted",s.ActualCash??0,true);

            var difference=s.Difference??0;
            Fill(45,419,505,43,difference==0?"0.88":"0.94");Box(45,419,505,43);
            Text(58,446,10,difference<0?"CASH SHORTAGE":difference>0?"CASH EXTRA":"DRAWER MATCHED",true);
            Text(445,443,14,Money(Math.Abs(difference)),true);
            Text(58,428,8,$"Paid orders {s.PaidOrders}   |   Outstanding {s.OutstandingOrders}   |   Cancelled {s.CancelledOrders}");

            Fill(45,380,245,24,"0.91");Box(45,380,245,24);Text(55,388,9,"OPERATOR BREAKDOWN",true);
            Fill(305,380,245,24,"0.91");Box(305,380,245,24);Text(315,388,9,"TOP SELLING ITEMS",true);
            var leftY=363;var rightY=363;
            if(s.Operators.Count==0)Text(55,leftY,8,"No operator sales.");
            foreach(var op in s.Operators.Take(7))
            {
                Text(55,leftY,8,Cut(op.Name,22),true);Text(190,leftY,7,$"{op.Orders} orders");Text(240,leftY,8,Money(op.Total),true);leftY-=16;
            }
            if(s.TopItems.Count==0)Text(315,rightY,8,"No sold items.");
            foreach(var item in s.TopItems.Take(7))
            {
                Text(315,rightY,8,Cut(item.Name,27),true);Text(458,rightY,7,$"Qty {item.Quantity}");Text(500,rightY,8,Money(item.Sales),true);rightY-=16;
            }

            Fill(45,239,505,24,"0.91");Box(45,239,505,24);Text(55,247,9,"CASH MOVEMENTS",true);
            var moveY=221;
            if(s.Movements.Count==0)Text(55,moveY,8,"No cash movements recorded.");
            foreach(var move in s.Movements.Take(6))
            {
                Text(55,moveY,8,$"{move.CreatedAt.LocalDateTime:hh:mm tt}  {(move.Type=="CashIn"?"CASH IN":"CASH OUT")}",true);
                Text(190,moveY,8,Money(move.Amount),true);
                Text(275,moveY,8,Cut(move.Purpose,34));
                Text(470,moveY,7,Cut(move.CreatedByName,14));
                moveY-=16;
            }

            Box(45,92,505,72);
            Text(55,148,9,$"Shift cashier: {Cut(s.CashierName,28)}",true);
            Text(315,148,9,$"Closed by: {Cut(s.ClosedByName,24)} [{s.ClosedByRole}]",true);
            Text(55,128,8,$"Difference reason: {Cut(s.DifferenceReason,72)}");
            Text(55,108,8,"This closed shift is read-only and retained for audit.");

            Fill(35,35,525,38,"0.08");
            Text(52,57,8,"A product by TechMint Software Solutions",true,true);
            Text(399,57,8,"CONFIDENTIAL Z-REPORT",true,true);
            Text(52,43,7,$"Generated {DateTimeOffset.Now.LocalDateTime:dd MMM yyyy, hh:mm:ss tt}",false,true);
            return Make(c.ToString());
        }

        static string Money(decimal value)=>$"Rs {value:N0}";
        static string Cut(string? value,int max)=>string.IsNullOrWhiteSpace(value)?"-":value.Length<=max?value:value[..(max-3)]+"...";
        static string Ascii(string value)=>new(value.Select(x=>x is>=' 'and<='~'?x:' ').ToArray());
        static string Esc(string value)=>value.Replace("\\","\\\\").Replace("(","\\(").Replace(")","\\)");
        static byte[] Make(string stream)
        {
            var objects=new[]{
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
                $"<< /Length {Encoding.ASCII.GetByteCount(stream)} >>\nstream\n{stream}endstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
            };
            var pdf=new StringBuilder("%PDF-1.4\n");var offsets=new List<int>{0};
            for(var i=0;i<objects.Length;i++){offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));pdf.Append($"{i+1} 0 obj\n{objects[i]}\nendobj\n");}
            var xref=Encoding.ASCII.GetByteCount(pdf.ToString());pdf.Append($"xref\n0 {objects.Length+1}\n0000000000 65535 f \n");
            for(var i=1;i<offsets.Count;i++)pdf.Append($"{offsets[i]:0000000000} 00000 n \n");
            pdf.Append($"trailer\n<< /Size {objects.Length+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
            return Encoding.ASCII.GetBytes(pdf.ToString());
        }
    }

}
record OpenShiftRequest(decimal OpeningCash);record ShiftMovementRequest(string? Type,decimal Amount,string? Purpose);record CloseShiftRequest(decimal ActualCash,string? Password,string? DifferenceReason,string? AdminOverrideReason);
sealed class ShiftSummary{public bool Open{get;set;}public long Id{get;set;}public string ShiftNumber{get;set;}="";public string CounterName{get;set;}="";public string CashierName{get;set;}="";public string Status{get;set;}="";public DateTimeOffset OpenedAt{get;set;}public string OpenedByName{get;set;}="";public string OpenedByRole{get;set;}="";public DateTimeOffset? ClosedAt{get;set;}public string? ClosedByName{get;set;}public string? ClosedByRole{get;set;}public decimal OpeningCash{get;set;}public decimal GrossSales{get;set;}public decimal Discounts{get;set;}public decimal TotalPaidSales{get;set;}public int PaidOrders{get;set;}public decimal CashSales{get;set;}public decimal CardSales{get;set;}public decimal OnlineSales{get;set;}public int OutstandingOrders{get;set;}public decimal OutstandingAmount{get;set;}public int CancelledOrders{get;set;}public decimal CashAdded{get;set;}public decimal CashOut{get;set;}public decimal ExpectedCash{get;set;}public decimal? ActualCash{get;set;}public decimal? Difference{get;set;}public string? DifferenceReason{get;set;}public string? AdminOverrideReason{get;set;}public List<ShiftOperator> Operators{get;set;}=[];public List<ShiftPayment> RecentPayments{get;set;}=[];public List<ShiftMove> Movements{get;set;}=[];public List<ShiftTop> TopItems{get;set;}=[];}
sealed class ShiftOperator{public string Name{get;set;}="";public string Role{get;set;}="";public int Orders{get;set;}public decimal Cash{get;set;}public decimal Card{get;set;}public decimal Online{get;set;}public decimal Total{get;set;}}sealed class ShiftPayment{public int TokenNumber{get;set;}public string OrderType{get;set;}="";public string PaymentMethod{get;set;}="";public decimal Total{get;set;}public DateTimeOffset PaidAt{get;set;}public string CreatedByName{get;set;}="";public string CreatedByRole{get;set;}="";public string PaidByName{get;set;}="";public string PaidByRole{get;set;}="";}sealed class ShiftMove{public long Id{get;set;}public string Type{get;set;}="";public decimal Amount{get;set;}public string Purpose{get;set;}="";public DateTimeOffset CreatedAt{get;set;}public string CreatedByName{get;set;}="";public string CreatedByRole{get;set;}="";}sealed class ShiftTop{public string Name{get;set;}="";public int Quantity{get;set;}public decimal Sales{get;set;}}
