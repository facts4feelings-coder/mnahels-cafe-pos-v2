/* Mnahel's Cafe POS v0.15.57 · targeted fixes after the existing build patches.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),web='src/MnahelsCafe.Pos/wwwroot/';
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');
function replace(s,a,b,label){if(s.includes(b))return s;if(!s.includes(a))throw Error(label+' source not found');return s.replace(a,b);}
function patch(file,a,b,label){write(file,replace(read(file),a,b,label));}
function guard(file,marker,code){patch(file,marker,marker+code,file+' guard');}
if(process.argv[2]==='desktop'){
 const file='src/MnahelsCafe.Desktop/Program.cs';let s=read(file);
 // Undo RAW-first for the approved HTML templates. No new printer/installer technology.
 s=s.replace('if (_printers.RawTextPrint)','if (_printers.RawTextPrint && !exactHtmlDesign)');
 s=s.replace(/BuildTag = "[^"]+"/,'BuildTag = "0.15.57"').replace(/var uiRevision = "[^"]+"/,'var uiRevision = "20260905-receipt-consistency-57"');
 const marker='                var known = message is "mnahels-print-customer" or "mnahels-print-kitchen" or "mnahels-silent-print";';
 const job=`                if (message.StartsWith("mnahels-print-job:", StringComparison.Ordinal))
                {
                    using var job = JsonDocument.Parse(message[18..]);
                    var jobId = job.RootElement.GetProperty("id").GetString() ?? "";
                    var jobType = job.RootElement.GetProperty("type").GetString() == "kitchen" ? "kitchen" : "customer";
                    var printed = await PrintReceiptAsync(core, jobType);
                    core.PostWebMessageAsString("mnahels-print-result:" + jobId + (printed ? ":done" : ":cancelled"));
                    return;
                }
`;
 if(!s.includes('using var job = JsonDocument.Parse'))s=replace(s,marker,job+marker,'correlated bridge');
 s=replace(s,"window.print=function(){try{window.chrome.webview.postMessage('mnahels-silent-print')}catch(e){}};","window.print=function(){if(window.mnahelsV63){window.mnahelsV63.printStaged();return;}try{window.chrome.webview.postMessage('mnahels-silent-print')}catch(e){}};",'legacy print bridge delegation');
 const installer='installer/MnahelsCafePOS.iss';let iss=read(installer);iss=iss.replace(/#define MyAppVersion "[^"]+"/,'#define MyAppVersion "0.15.57"').replace(/VersionInfoVersion=[^\n]+/,'VersionInfoVersion=0.15.57.0');write(installer,iss);
 write(file,s);console.log('v0.15.57 HTML-first desktop printing and correlated acknowledgements ready.');return;
}
// One automatic booking owner: v41. Keep the v36 success UI/resource cleanup.
patch(web+'v36.js','setTimeout(()=>autoPrintDine(order),260)','/* v57: booking prints are owned by v41.postBookingPrint */','duplicate Dine-in trigger');
// One automatic amendment owner: v58 -> v62. Keep v61 manual slips and audit UI.
patch(web+'v61.js','try{handleAmendment(result)}catch(e){}','/* v57: completion handler owns amendment printing */','duplicate amendment trigger');
// All routes retain their own HTML generator but share a serialized immutable print snapshot.
guard(web+'v36.js',"async function printSlip(order,kind='customer',quiet=false){","if(window.mnahelsV63)return window.mnahelsV63.printHtml(receiptHtml(order,kind),kind==='kitchen'?'kitchen':'customer');");
guard(web+'v41.js','async function printCustomerBillNow(order,paid=isPaid(order)){',"if(window.mnahelsV63)return window.mnahelsV63.printHtml(billHtml(order,paid),'customer');");
guard(web+'v61.js','async function printSlip(order,lines,type,result){',"if(window.mnahelsV63){if(!lines?.length)return true;return window.mnahelsV63.printHtml(slipHtml(order,lines,type,result),'kitchen');}");
guard(web+'v62.js','async function printHtml(html,type,quiet=false){',"if(window.mnahelsV63)return window.mnahelsV63.printHtml(html,type);");
// Booking action guard wraps the original print sequence, not the booking/payment operation.
let v41=read(web+'v41.js');
const booking="async function postBookingPrint(order){return enqueuePrint(async()=>{";
v41=replace(v41,booking,booking+"if(window.mnahelsV63&&!window.mnahelsV63.claim('booking:'+order.id))return;",'booking once');
v41=replace(v41,' event.preventDefault();if(!paymentTarget)return;',' event.preventDefault();if(!paymentTarget||q(\'#v41-confirm-payment\')?.disabled)return;','payment double submit');
v41=replace(v41,'await printCustomerBill(paid,true);toast(',"await window.mnahelsV63.once('payment:'+paid.id,()=>printCustomerBill(paid,true));toast(",'payment print once');
write(web+'v41.js',v41);
// A duplicate completion callback must not print again; manual buttons still work.
guard(web+'v58.js','async function completeRunningOrder(order,result){',"if(window.mnahelsV63&&!result?.__v57Printing)return window.mnahelsV63.once(window.mnahelsV63.amendmentKey(order,result)+':kitchen',()=>completeRunningOrder(order,{...result,__v57Printing:true}));");
guard(web+'v62.js',"order=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(order)||!result)return false;", "if(automatic&&window.mnahelsV63&&!result?.__v57Printing)return window.mnahelsV63.once(window.mnahelsV63.amendmentKey(order,result)+':customer',()=>printUpdatedReceipt(order,{...result,__v57Printing:true},true));");
// JPG: use the same rendered HTML, never the separate hand-painted approximation.
guard(web+'v45.js','async function renderJpg(source,name){',"if(window.mnahelsV63)return window.mnahelsV63.downloadHtml(source,name);");
guard(web+'v45.js','function watchPrintSheet(){','return;/* v57: automatic JPG is emitted once for the accepted print snapshot */');
// Remove time-window download suppression: distinct edits can share a token/kind.
guard(web+'v59.js','function installPrintDedupe(){','return;/* v57: job ownership replaces token/time suppression */');
// Preserve item notes and the existing percentage-discount UI in edit mode.
let v56=read(web+'v56.js');
v56=replace(v56,'quantity: Math.max(0, Number(item.quantity ?? 0)) }))','quantity: Math.max(0, Number(item.quantity ?? 0)), notes: item.notes || null }))','amendment item notes');
v56=replace(v56,"discount: Number(q('#discount')?.value || 0), notes:","discount: window.mnahelsV39?.discountAmount?.() ?? Number(q('#discount')?.value || 0), notes:",'edit percent discount');
write(web+'v56.js',v56);
let v60=read(web+'v60.js');
v60=replace(v60,"const discount=q('#discount');if(discount)discount.value=Number(order.discount||0);","const discount=q('#discount');if(discount){const percent=Number(order.subtotal)>0?Number(order.discount||0)*100/Number(order.subtotal):0;discount.value=String(percent);discount.dataset.v39Percent=String(percent);}",'restore percent discount');
v60=replace(v60,'  applyEdit(order);',"  if(!canEdit(order))throw new Error('Paid, completed ya cancelled order locked hai.');\n  applyEdit(order);",'edit eligibility');
v60=replace(v60,' }).filter(line=>line.variantId>0);'," }).map(line=>{if(!line.variantId)throw new Error(line.productName+' is not mapped to the menu; no items were removed.');return line;});",'prevent silently dropped items');
write(web+'v60.js',v60);
// Store immutable before/after snapshots alongside the existing delta/audit transaction.
const server='src/MnahelsCafe.Pos/OrderEditingFeatures.cs';let s=read(server);
s=replace(s,'        var oldTotal = order.Total;','        var oldTotal = order.Total;\n        var previousOrder = JsonSerializer.SerializeToElement(OrderView.From(order));','original history snapshot');
s=replace(s,'            additions = delta.Additions,\n            cancellations = delta.Cancellations,\n            previousTotal = oldTotal,', '            previousOrder,\n            updatedOrder = JsonSerializer.SerializeToElement(OrderView.From(order)),\n            additions = delta.Additions,\n            cancellations = delta.Cancellations,\n            previousTotal = oldTotal,','audit before and after');
write(server,s);
// Explicit payment/removal labels, keeping the original HTML grid/masthead/footer.
patch(web+'v43.js',"return{label:'TEMPORARY',sub:'SLIP'}","return{label:'UNPAID',sub:'PAYMENT DUE'}",'unpaid label');
let v61=read(web+'v61.js');
v61=replace(v61,'<b>RUNNING ORDER</b><small>',"<b>'+(cancellation?'RUNNING ORDER — REMOVAL/CANCELLED':'RUNNING ORDER')+'</b><small>",'removal label');write(web+'v61.js',v61);
let index=read(web+'index.html');
if(!index.includes('/v63.js'))index=index.replace('</body>','<script src="/v63.js?v=20260905-receipt-consistency-57"></script>\n</body>');
index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="0.15.57">');write(web+'index.html',index);
for(const f of ['v56.js','v57.js','v58.js','v59.js','v60.js','v61.js','v62.js'])write(web+f,read(web+f).replace(/(const (?:BUILD|RELEASE)\s*=\s*)'[^']+'/,'$1\'0.15.57\''));
for(const f of ['v36.js','v41.js','v45.js','v56.js','v58.js','v59.js','v60.js','v61.js','v62.js','v63.js'])new Function(read(web+f));
console.log('v0.15.57 targeted receipt consistency fixes applied.');
