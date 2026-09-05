/* Mnahel's Cafe POS v0.15.55 build patch
 * - keeps the existing order/cart/receipt/installer flow
 * - routes an edited order through the existing v56 update handler instead of
 *   letting the earlier v41 new-booking handler treat the amendment response as an order
 * - unwraps and validates saved-order data before any receipt can be staged
 * - verifies plain and wrapped order responses with a runtime receipt smoke test
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'src','MnahelsCafe.Pos','wwwroot');
const indexPath=path.join(web,'index.html');
const v41Path=path.join(web,'v41.js');
const v56Path=path.join(web,'v56.js');
const v61Path=path.join(web,'v61.js');
const v62Path=path.join(web,'v62.js');
const v62CssPath=path.join(web,'v62.css');
const RELEASE='0.15.55';
const REVISION='20260905-receipt-data-55';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const write=(file,value)=>fs.writeFileSync(file,value,'utf8');
function replaceRequired(value,oldText,newText,label){if(value.includes(newText))return value;if(!value.includes(oldText))throw new Error(label+' source was not found.');return value.replace(oldText,newText)}

/* The document-level v41 click listener was registered before v56 and calls
   stopImmediatePropagation(). In edit mode it therefore submitted through the
   new-order function. v61 rewrote that POST to PUT, but v41 then treated the
   amendment envelope ({order, additions, ...}) as the order itself. That is the
   exact MC-- / no-items / Rs 0 receipt seen for edited orders. Delegate first. */
let v41=read(v41Path);
const submitMarker='async function submitBooking(){';
const submitDelegate="async function submitBooking(){\n if(Number(state.v56EditingOrderId||0)>0&&typeof window.mnahelsV56?.updateEditingOrder==='function')return window.mnahelsV56.updateEditingOrder();";
v41=replaceRequired(v41,submitMarker,submitDelegate,'edit checkout delegation');
const oldBookingResponse="  const order=await window.api('/api/orders',{method:'POST',body:JSON.stringify(payload)});orderMap.set(String(order.id),order);state.lastOrder=order;state.cart=[];resetMenuSearch();";
const newBookingResponse="  const response=await window.api('/api/orders',{method:'POST',body:JSON.stringify(payload)});let order=response?.order||response;const receiptReady=value=>!!(value&&Number(value.id)>0&&value.tokenNumber!=null&&Array.isArray(value.items)&&value.items.length);const responseId=Number(order?.id||response?.orderId||0);if(!receiptReady(order)&&responseId)order=await window.api(`/api/orders/${responseId}/edit`);if(!receiptReady(order))throw new Error('Order save ho gaya lekin receipt data load nahi hua. Order Tracking se receipt dobara print karein.');orderMap.set(String(order.id),order);state.lastOrder=order;state.cart=[];resetMenuSearch();";
v41=replaceRequired(v41,oldBookingResponse,newBookingResponse,'new-order response normalization');
write(v41Path,v41);

/* v41 now calls the already-existing v56 update path, so expose only that
   existing function. The earlier build patches still own payloads, cart clearing,
   delta calculation, success UI and running-order printing. */
let v56=read(v56Path);
v56=replaceRequired(v56,
 "  window.mnahelsV56 = { beginEdit, clearEditForm, release: RELEASE };",
 "  window.mnahelsV56 = { beginEdit, clearEditForm, updateEditingOrder, release: RELEASE };",
 'existing update handler export');
write(v56Path,v56);

/* Defensive normalization at the final receipt layer. This also covers a plain
   order, {order: ...}, and nested data/result envelopes without inventing receipt
   values. If token/items are missing, return no markup rather than a fake empty slip. */
let v62=read(v62Path).replace(/const BUILD='[^']+',REV='[^']+';/,"const BUILD='"+RELEASE+"',REV='"+REVISION+"';");
const helperMarker="function say(message){if(typeof window.toast==='function')window.toast(message)}";
const helpers=helperMarker+"\nfunction orderFrom(value){let current=value;const seen=new Set();for(let depth=0;depth<5;depth++){if(!current||typeof current!=='object'||seen.has(current))return null;seen.add(current);if(Number(current.id)>0&&current.tokenNumber!=null&&Array.isArray(current.items))return current;current=current.order||current.data?.order||current.result?.order||current.value?.order||null}return null}\nfunction validOrder(value){const order=orderFrom(value);return!!(order&&Number(order.id)>0&&order.tokenNumber!=null&&Array.isArray(order.items)&&order.items.length>0)}";
v62=replaceRequired(v62,helperMarker,helpers,'receipt order normalizer');
v62=replaceRequired(v62,
 'function updatedReceiptHtml(order,result){',
 "function updatedReceiptHtml(order,result){\n order=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(order))return'';",
 'updated receipt order normalization');
v62=replaceRequired(v62,
 'function normalReceiptHtml(order,type){',
 "function normalReceiptHtml(order,type){\n order=orderFrom(order)||orderFrom(appState().lastOrder);if(!validOrder(order))return'';",
 'normal receipt order normalization');
v62=replaceRequired(v62,
 'async function printUpdatedReceipt(order,result,automatic=false){\n if(!order||!result)return false;',
 "async function printUpdatedReceipt(order,result,automatic=false){\n order=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(order)||!result)return false;",
 'updated receipt print normalization');
v62=replaceRequired(v62,
 " if(String(sheet.textContent||'').replace(/\\s+/g,' ').trim().length<20){if(!quiet)say('Receipt khali hai — dobara koshish karein.');return false}",
 " const receiptText=String(sheet.textContent||'').replace(/\\s+/g,' ').trim();if(receiptText.length<20||!/\\bMC-\\d+\\b/i.test(receiptText)){if(!quiet)say('Receipt data khali hai — order dobara load karein.');return false}",
 'staged receipt data guard');
const oldCompletion=" const wrapped=async function(order,result){const value=await original.apply(this,arguments);try{await printUpdatedReceipt(order,result,true)}catch(error){console.warn('[v62 updated receipt]',error)}return value};";
const newCompletion=" const wrapped=async function(order,result){const resolved=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(resolved)){say('Order update ho gaya lekin receipt data load nahi hua.');return false}const value=await original.call(this,resolved,result);try{await printUpdatedReceipt(resolved,result,true)}catch(error){console.warn('[v62 updated receipt]',error)}return value};";
v62=replaceRequired(v62,oldCompletion,newCompletion,'running-order completion normalization');
const oldCurrent="function currentReceipt(type){const state=appState(),order=state.lastOrder,result=state.v58RunningResult;return{order,result:type==='customer'?result:null,html:order?receiptHtml(order,type,type==='customer'?result:null):''}}";
const newCurrent="function currentReceipt(type){const state=appState(),order=orderFrom(state.lastOrder)||orderFrom(state.v56EditingOrder),result=state.v58RunningResult;if(order&&state.lastOrder!==order)state.lastOrder=order;return{order,result:type==='customer'?result:null,html:order?receiptHtml(order,type,type==='customer'?result:null):''}}";
v62=replaceRequired(v62,oldCurrent,newCurrent,'current receipt normalization');
v62=v62.replace('window.mnahelsV62={build:BUILD,uiRevision:REV,updatedReceiptHtml,normalReceiptHtml,receiptHtml,printHtml,printUpdatedReceipt,installCompletionHook};','window.mnahelsV62={build:BUILD,uiRevision:REV,orderFrom,validOrder,updatedReceiptHtml,normalReceiptHtml,receiptHtml,printHtml,printUpdatedReceipt,installCompletionHook};');
write(v62Path,v62);

let index=read(indexPath);
if(!index.includes('/v61.css')||!index.includes('/v61.js'))throw new Error('v61 order-edit assets must be installed before the receipt repair.');
if(!index.includes('/v62.css'))index=index.replace(/(<link rel="stylesheet" href="\/v61\.css\?v=[^"]+">)/,'$1\n<link rel="stylesheet" href="/v62.css?v='+REVISION+'">');
if(!index.includes('/v62.js'))index=index.replace(/(<script src="\/v61\.js\?v=[^"]+"><\/script>)/,'$1\n<script src="/v62.js?v='+REVISION+'"></script>');
index=index.replace(/<link rel="stylesheet" href="\/v62\.css\?v=[^"]+">/,'<link rel="stylesheet" href="/v62.css?v='+REVISION+'">');
index=index.replace(/<script src="\/v62\.js\?v=[^"]+"><\/script>/,'<script src="/v62.js?v='+REVISION+'"></script>');
index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="'+RELEASE+'">');
write(indexPath,index);
let v61=read(v61Path).replace(/const BUILD='[^']+',REV='[^']+';/,"const BUILD='"+RELEASE+"',REV='"+REVISION+"';");
write(v61Path,v61);

const v62css=read(v62CssPath),finalIndex=read(indexPath),finalV41=read(v41Path),finalV56=read(v56Path),finalV62=read(v62Path);
const checks=[
 ['v62 loaded after v61',finalIndex.indexOf('/v61.js')>=0&&finalIndex.indexOf('/v62.js')>finalIndex.indexOf('/v61.js')],
 ['edit checkout delegates before booking',finalV41.indexOf('mnahelsV56?.updateEditingOrder')>0&&finalV41.indexOf('mnahelsV56?.updateEditingOrder')<finalV41.indexOf('if(bookingBusy)return')],
 ['new-order response unwrapped',finalV41.includes('response?.order||response')&&finalV41.includes('receiptReady')],
 ['existing update handler exported',finalV56.includes('{ beginEdit, clearEditForm, updateEditingOrder, release: RELEASE }')],
 ['existing amendment response extracted',finalV56.includes('result?.order || result')],
 ['existing running-order completion preserved',finalV56.includes('mnahelsV58?.completeRunningOrder')],
 ['receipt envelope normalizer',finalV62.includes('function orderFrom')&&finalV62.includes('current.order||current.data?.order')],
 ['normal receipt validation',finalV62.includes('function normalReceiptHtml(order,type){\n order=orderFrom(order)')],
 ['updated receipt validation',finalV62.includes('function updatedReceiptHtml(order,result){\n order=orderFrom(order)')],
 ['empty token print blocked',finalV62.includes('MC-\\d+')&&finalV62.includes('Receipt data khali hai')],
 ['updated receipt sections',finalV62.includes('PREVIOUS ORDER')&&finalV62.includes('NEWLY ADDED ITEMS')&&finalV62.includes('CANCELLED / REMOVED ITEMS')&&finalV62.includes('FINAL ORDER TOTAL')],
 ['receipt styles present',v62css.includes('.v62-updated-receipt')],
 ['release stamped',finalIndex.includes('content="'+RELEASE+'"')&&finalV62.includes("const BUILD='"+RELEASE+"'")&&v61.includes("const BUILD='"+RELEASE+"'")]
];
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length)throw new Error('Receipt data repair v'+RELEASE+' verification failed: '+failed.join(', '));
new Function(finalV41);new Function(finalV56);new Function(finalV62);new Function(v61);

/* Runtime smoke test: both server response shapes must reach the existing receipt
   renderer as the same populated order, and a malformed envelope must render nothing. */
const sample={id:77,tokenNumber:1777,orderType:'Takeaway',paymentStatus:'Paid',items:[{productName:'Burger',variantName:'Regular',quantity:2,unitPrice:350,lineTotal:700}],subtotal:700,discount:0,total:700};
const sandbox={console,window:{state:{},mnahelsV43:{receiptHtml:order=>'MC-'+order.tokenNumber+'|'+order.items.map(item=>item.productName+' x'+item.quantity).join(',')+'|Rs '+order.total},mnahelsV58:{completeRunningOrder:async()=>true}},document:{readyState:'complete',documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}},setTimeout:fn=>{fn();return 1},setInterval:()=>1,clearTimeout:()=>{},Promise,Date,Number,String,Array,Set,Math,JSON};
sandbox.window.window=sandbox.window;vm.runInNewContext(finalV62,sandbox,{filename:'v62.js'});
const plain=sandbox.window.mnahelsV62.normalReceiptHtml(sample,'customer');
const wrapped=sandbox.window.mnahelsV62.normalReceiptHtml({order:sample},'customer');
const nested=sandbox.window.mnahelsV62.normalReceiptHtml({data:{order:sample}},'customer');
const malformed=sandbox.window.mnahelsV62.normalReceiptHtml({order:{}},'customer');
if(plain!=='MC-1777|Burger x2|Rs 700'||wrapped!==plain||nested!==plain||malformed!=='')throw new Error('Runtime receipt data smoke test failed.');
const edited=sandbox.window.mnahelsV62.updatedReceiptHtml({order:sample},{order:sample,previousTotal:350,updatedTotal:700,additions:[sample.items[0]],cancellations:[]});
if(!edited.includes('MC-1777')||!edited.includes('Burger')||!edited.includes('PREVIOUS ORDER')||!edited.includes('FINAL ORDER TOTAL')||edited.includes('MC-—'))throw new Error('Runtime edited-receipt smoke test failed.');
console.log('v'+RELEASE+' booked and edited order receipts receive populated order data; empty slips are blocked.');
