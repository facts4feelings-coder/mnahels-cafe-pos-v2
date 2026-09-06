/* Targeted fixes AFTER existing v57 patches. Same .NET/WebView2/Inno Setup build.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),web='src/MnahelsCafe.Pos/wwwroot/';
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
function replace(s,a,b,label){if(s.includes(b))return s;if(!s.includes(a))throw Error('v58 missing '+label);return s.replace(a,b)}
function patch(file,a,b,label){write(file,replace(read(file),a,b,label))}
function guard(file,marker,code){patch(file,marker,marker+code,file+' guard')}
if(process.argv[2]==='desktop'){
 const file='src/MnahelsCafe.Desktop/Program.cs';let s=read(file);
 s=s.replace(/\s*\/\/ v57-style-recovery:[^\n]*\n\s*if \(exactHtmlDesign && _printers.RawTextPrint && await RawTextPrintAsync\(core, type, widthMm\)\) return true;/,'\n                // No automatic RAW resend of an uncertain styled HTML job.');
 s=replace(s,'if (_printers.UseDriverPaper || exactHtmlDesign)','if (_printers.UseDriverPaper)','saved paper mode');
 s=replace(s,'if (textLength >= 0 && textLength < 20)','if (textLength < 20)','empty-sheet validation');
 s=s.replace(/BuildTag = "[^"]+"/,'BuildTag = "0.15.58"').replace(/var uiRevision = "[^"]+"/,'var uiRevision = "20260905-receipt-integrity-58"');
 if(!s.includes('window.__mnahelsPrintJobBridge=true;'))s=replace(s,'window.__mnahelsDualPrintBridge=true;','window.__mnahelsDualPrintBridge=true;window.__mnahelsPrintJobBridge=true;','job bridge flag');
 if(!s.includes('window.__mnahelsAfterPrintBridge'))s=replace(s,'window.__mnahelsPrintJobBridge=true;',"window.__mnahelsPrintJobBridge=true;if(!window.__mnahelsAfterPrintBridge){window.__mnahelsAfterPrintBridge=true;window.addEventListener('afterprint',function(){try{window.chrome.webview.postMessage('mnahels-print-dialog-closed')}catch(e){}});}",'one dialog listener');
 if(!s.includes('TaskCompletionSource<bool>? _interactivePrintCompletion'))s=s.replace(/private readonly SemaphoreSlim _printGate[^;]+;/,m=>m+'\n    private TaskCompletionSource<bool>? _interactivePrintCompletion;');
 const marker='                var known = message is';
 if(!s.includes('message == "mnahels-print-dialog-closed"'))s=replace(s,marker,`                if (message == "mnahels-print-dialog-closed")
                {
                    _interactivePrintCompletion?.TrySetResult(true);
                    return;
                }
                if (message.StartsWith("mnahels-print-job:", StringComparison.Ordinal))
                {
                    try
                    {
                        using var job = JsonDocument.Parse(message[18..]);
                        var jobId = job.RootElement.GetProperty("id").GetString() ?? "";
                        var jobType = job.RootElement.GetProperty("type").GetString() == "kitchen" ? "kitchen" : "customer";
                        var printed = await PrintReceiptAsync(core, jobType);
                        core.PostWebMessageAsString("mnahels-print-result:" + jobId + (printed ? ":done" : ":cancelled"));
                    }
                    catch (Exception error) { PrinterConfig.Log("Print job failed: " + error.Message); }
                    return;
                }
`+marker,'correlated print replies');
 if(!s.includes('var dialogCompleted = new TaskCompletionSource<bool>'))s=replace(s,'                    core.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);\n                    return true;',`                    var dialogCompleted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                    _interactivePrintCompletion = dialogCompleted;
                    try
                    {
                        core.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);
                        var finished = await Task.WhenAny(dialogCompleted.Task, Task.Delay(TimeSpan.FromMinutes(5)));
                        return finished == dialogCompleted.Task;
                    }
                    finally { if (ReferenceEquals(_interactivePrintCompletion, dialogCompleted)) _interactivePrintCompletion = null; }`,'interactive print lifetime');
 write(file,s);return;
}
patch(web+'v36.js','setTimeout(()=>autoPrintDine(order),260)','/* Booking printing is owned by v41 only. */','duplicate Dine-in printing');
patch(web+'v61.js','try{handleAmendment(result)}catch(e){}','/* Completion owns printing; watcher only refreshes audit. */setTimeout(()=>loadLog(true),700)','duplicate amendment watcher');
guard(web+'v36.js',"async function printSlip(order,kind='customer',quiet=false){","if(window.mnahelsV64)return window.mnahelsV64.printHtml(receiptHtml(order,kind),kind==='kitchen'?'kitchen':'customer');");
guard(web+'v41.js','async function printCustomerBillNow(order,paid=isPaid(order)){',"if(window.mnahelsV64)return window.mnahelsV64.printHtml(billHtml(order,paid),'customer');");
guard(web+'v61.js','async function printSlip(order,lines,type,result){',"if(window.mnahelsV64){if(!lines?.length)return true;return window.mnahelsV64.printHtml(slipHtml(order,lines,type,result),'kitchen');}");
guard(web+'v62.js','async function printHtml(html,type,quiet=false){',"if(window.mnahelsV64)return window.mnahelsV64.printHtml(html,type);");
guard(web+'v31.js',"async function output(html,note){","if(window.mnahelsV64)return window.mnahelsV64.printHtml(html,'customer');");
patch(web+'v31.js','setInterval(()=>{if(!hold)return;',"document.addEventListener('mnahels-print-stage',()=>{hold=null});\nsetInterval(()=>{if(!hold)return;",'stale receipt hold timer');
guard(web+'v41.js','async function postBookingPrint(order){return enqueuePrint(async()=>{',"if(window.mnahelsV64&&!window.mnahelsV64.claim('booking:'+order.id))return;");
patch(web+'v41.js','event.preventDefault();if(!paymentTarget)return;',"event.preventDefault();if(!paymentTarget||q('#v41-confirm-payment')?.disabled)return;",'payment double submit');
patch(web+'v41.js','await printCustomerBill(paid,true);toast(',"await window.mnahelsV64.once('payment:'+paid.id,()=>printCustomerBill(paid,true));toast(",'payment print once');
guard(web+'v58.js','async function completeRunningOrder(order,result){',"if(window.mnahelsV64&&!result?.__v58Printing)return window.mnahelsV64.once(window.mnahelsV64.amendmentKey(order,result)+':kitchen',()=>completeRunningOrder(order,{...result,__v58Printing:true}));");
guard(web+'v62.js',"order=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(order)||!result)return false;","if(automatic&&window.mnahelsV64&&!result?.__v58Printing)return window.mnahelsV64.once(window.mnahelsV64.amendmentKey(order,result)+':customer',()=>printUpdatedReceipt(order,{...result,__v58Printing:true},true));");
patch(web+'v56.js','quantity: Math.max(0, Number(item.quantity ?? 0)) }))','quantity: Math.max(0, Number(item.quantity ?? 0)), notes: item.notes || null }))','item notes');
patch(web+'v56.js',"discount: Number(q('#discount')?.value || 0), notes:","discount: window.mnahelsV39?.discountAmount?.() ?? Number(q('#discount')?.value || 0), notes:",'percentage discount');
patch(web+'v60.js',"const discount=q('#discount');if(discount)discount.value=Number(order.discount||0);","const discount=q('#discount');if(discount){const percent=Number(order.subtotal)>0?Number(order.discount||0)*100/Number(order.subtotal):0;discount.value=String(percent);discount.dataset.v39Percent=String(percent);}",'restore percentage');
patch(web+'v60.js',' }).filter(line=>line.variantId>0);'," }).map(line=>{if(!line.variantId)throw new Error(line.productName+' is not mapped to the menu; no items were removed.');return line;});",'unmapped item safety');
patch(web+'v60.js','  applyEdit(order);',"  if(!canEdit(order))throw new Error('Paid, completed ya cancelled order locked hai.');\n  applyEdit(order);",'edit eligibility');
const server='src/MnahelsCafe.Pos/OrderEditingFeatures.cs';let s=read(server);
s=replace(s,'        var oldTotal = order.Total;','        var oldTotal = order.Total;\n        var previousOrder = JsonSerializer.SerializeToElement(OrderView.From(order));','immutable original snapshot');
s=replace(s,'            additions = delta.Additions,\n            cancellations = delta.Cancellations,\n            previousTotal = oldTotal,','            previousOrder,\n            updatedOrder = JsonSerializer.SerializeToElement(OrderView.From(order)),\n            additions = delta.Additions,\n            cancellations = delta.Cancellations,\n            previousTotal = oldTotal,','before and after audit');write(server,s);
patch(web+'v61.js','<b>RUNNING ORDER</b><small>',"<b>'+(cancellation?'RUNNING ORDER — REMOVAL/CANCELLED':'RUNNING ORDER')+'</b><small>",'removal label');
patch(web+'v63.js',"rule(' .v43-brand-logo','width:28px!important;min-width:28px!important;flex:0 0 28px!important;');","rule(' .v43-brand-logo','width:40px!important;height:40px!important;min-width:40px!important;flex:0 0 40px!important;');\n rule(' .v43-brand-logo svg','width:40px!important;height:40px!important;');",'larger logo');
patch(web+'v63.js',"rule(' .v43-brand-line>b',`font-size:${f}px!important;white-space:normal!important;`);","rule(' .v43-brand-line>b',`font-size:${Math.max(18,f+4)}px!important;white-space:normal!important;`);",'cafe name hierarchy');
patch(web+'v63.js',"const markup=new XMLSerializer().serializeToString(clone)","[['.v43-brand','1 / 1 / 2 / 3'],['.v43-mode','2 / 1 / 3 / 2'],['.v43-seal','2 / 2 / 3 / 3']].forEach(([selector,area])=>clone.querySelector(selector)?.style.setProperty('grid-area',area,'important'));\n  const markup=new XMLSerializer().serializeToString(clone)",'JPG named grid');
let index=read(web+'index.html');if(!index.includes('/v64.js'))index=index.replace('</body>','<script src="/v64.js?v=20260905-receipt-integrity-58"></script>\n</body>');
index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="0.15.58">');write(web+'index.html',index);
for(const file of ['v56.js','v57.js','v58.js','v59.js','v60.js','v61.js','v62.js'])write(web+file,read(web+file).replace(/(const (?:BUILD|RELEASE)\s*=\s*)'[^']+'/,'$1\'0.15.58\''));
let iss=read('installer/MnahelsCafePOS.iss').replace(/#define MyAppVersion "[^"]+"/,'#define MyAppVersion "0.15.58"').replace(/VersionInfoVersion=[^\n]+/,'VersionInfoVersion=0.15.58.0');write('installer/MnahelsCafePOS.iss',iss);
for(const file of ['v36.js','v41.js','v56.js','v58.js','v60.js','v61.js','v62.js','v63.js','v64.js'])new Function(read(web+file));
console.log('v58 current receipt layout preserved; duplicate sources removed; same installer pipeline.');
