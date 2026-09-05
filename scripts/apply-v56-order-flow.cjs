/* Mnahel's Cafe POS v0.15.56 build patch
 * - makes cart thumbnails use the exact menu image for every mapped product,
 *   including all tea / hot-drink items
 * - prints kitchen + paid/unpaid customer copies for every newly booked order
 * - keeps later payment to one paid customer copy only
 * - adds a compact previous-bill summary and clear payment state to edited bills
 * - preserves the existing running-order delta, printer bridge and attribution
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'src','MnahelsCafe.Pos','wwwroot');
const RELEASE='0.15.56';
const REVISION='20260905-menu-images-order-print-56';
const file=name=>path.join(web,name);
const read=target=>fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n');
const write=(target,value)=>fs.writeFileSync(target,value,'utf8');
function replaceRequired(value,oldText,newText,label){if(value.includes(newText))return value;if(!value.includes(oldText))throw new Error(label+' source was not found.');return value.replace(oldText,newText)}
function section(value,start,end,label){const a=value.indexOf(start),b=value.indexOf(end,a+start.length);if(a<0||b<0)throw new Error(label+' section was not found.');return value.slice(a,b)}

/* 1. Cart thumbnails: v37 falls back to a generic food image, while v50 owns
      the exact menu-photo map. Add the five current hot drinks to that same map
      and set img.src as well as the existing CSS image variable. */
const v50Path=file('v50.js');
let v50=read(v50Path);
const oldHot='"Coffee":"coffee.webp","Mint Margarita":"mint-margarita.webp"';
const newHot='"Coffee":"coffee.webp","Cardamom Tea":"cardamom-tea.webp","Karrak Tea":"karrak-tea.webp","Black Coffee":"black-coffee.webp","Green Tea":"green-tea.webp","Mint Margarita":"mint-margarita.webp"';
v50=replaceRequired(v50,oldHot,newHot,'hot-drink menu-photo map');
v50=replaceRequired(v50,"el.loading='lazy';el.decoding='async';el.dataset.v50Image=src;","el.loading='lazy';el.decoding='async';el.src=src;el.dataset.v50Image=src;",'cart image element source');
v50=v50.replace(/const BUILD='[^']+',REV='[^']+',P=/,"const BUILD='"+RELEASE+"',REV='"+REVISION+"',P=");
write(v50Path,v50);

/* 2. New bookings: the previous handler skipped automatic printing for Dine-in.
      All service modes now use the same existing queue: kitchen first, then the
      customer copy whose paid/unpaid kind comes from the saved order. */
const v41Path=file('v41.js');
let v41=read(v41Path);
v41=replaceRequired(v41,
 "async function postBookingPrint(order){if(order.orderType==='Dine-in')return;return enqueuePrint(async()=>{",
 "async function postBookingPrint(order){return enqueuePrint(async()=>{",
 'all-mode booking print flow');
v41=v41.replace(/const BUILD='[^']+',UI_REVISION='[^']+';/,"const BUILD='"+RELEASE+"',UI_REVISION='"+REVISION+"';");
write(v41Path,v41);

/* 3. Edited customer bill: reconstruct the compact previous cart from the final
      order plus precise additions/cancellations. No extra API or cart path is
      introduced; the existing amendment result remains the source of truth. */
const v62Path=file('v62.js');
let v62=read(v62Path).replace(/const BUILD='[^']+',REV='[^']+';/,"const BUILD='"+RELEASE+"',REV='"+REVISION+"';");
v62=replaceRequired(v62,
 "return{productName:line?.productName||'Item',variantName:",
 "return{variantId:Number(line?.variantId||0),productName:line?.productName||'Item',variantName:",
 'delta variant identity');
const amountMarker="function amount(lines){return delta(lines).reduce((total,line)=>total+Number(line.lineTotal||0),0)}";
const previousHelpers=amountMarker+`\nfunction lineKey(line){const id=Number(line?.variantId||0),notes=String(line?.notes||'').trim().toLowerCase();return id>0?'v:'+id+'|'+notes:'n:'+String(line?.productName||'').trim().toLowerCase()+'|'+String(line?.variantName||'').trim().toLowerCase()+'|'+notes}\nfunction previousRows(order,result){const rows=new Map();function apply(line,direction){const normalized=delta([line])[0],quantity=Math.max(0,Number(line?.quantity||0));if(!normalized||!quantity)return;const key=lineKey(normalized),current=rows.get(key)||{...normalized,quantity:0};current.quantity=Math.max(0,Number(current.quantity||0)+direction*quantity);current.lineTotal=current.unitPrice*current.quantity;if(current.quantity>0)rows.set(key,current);else rows.delete(key)};(Array.isArray(order?.items)?order.items:[]).forEach(line=>apply(line,1));(Array.isArray(result?.additions)?result.additions:[]).forEach(line=>apply(line,-1));(Array.isArray(result?.cancellations)?result.cancellations:[]).forEach(line=>apply(line,1));return[...rows.values()]}\nfunction previousSummaryHtml(order,result,previous){const rows=previousRows(order,result),units=rows.reduce((total,row)=>total+Number(row.quantity||0),0),preview=rows.slice(0,2).map(row=>Number(row.quantity||0)+'× '+esc(row.productName)).join(' · '),more=rows.length>2?' · +'+(rows.length-2)+' more item line'+(rows.length-2===1?'':'s'):'';return'<section class="v62-previous-summary"><div class="v62-section-title"><b>PREVIOUS BILL — SHORT VIEW</b><small>Before this edit</small></div><div class="v62-previous-preview">'+(preview||'Previous item detail unavailable')+more+'</div><div class="v62-previous-totals"><span>'+rows.length+' item line'+(rows.length===1?'':'s')+' · '+units+' total qty</span><b>'+money(previous)+'</b></div></section>'}`;
v62=replaceRequired(v62,amountMarker,previousHelpers,'previous-bill reconstruction');
const totalsMarker=" const previous=Number(result?.previousTotal??order?.total??0),updated=Number(result?.updatedTotal??order?.total??0);";
v62=replaceRequired(v62,totalsMarker,totalsMarker+"\n const previousView=previousSummaryHtml(order,result,previous);",'previous-bill view');
v62=replaceRequired(v62,
 '<div class="v43-seal"><strong>UPDATED BILL</strong><small>CUSTOMER COPY</small></div>',
 '<div class="v43-seal">${paid(order)?\'<strong>UPDATED PAID</strong><small>CUSTOMER COPY</small>\':\'<strong>PAYMENT DUE</strong><small>UPDATED UNPAID</small>\'}</div>',
 'edited receipt payment seal');
v62=replaceRequired(v62,
 '<div class="v62-update-banner"><b>ORDER UPDATE</b><small>Only changes made to the booked order</small></div><section class="v62-change-section additions">',
 '<div class="v62-update-banner"><b>ORDER UPDATE</b><small>Only changes made to the booked order</small></div>${previousView}<section class="v62-change-section additions ${additions.length?\'\':\'v62-empty-section\'}">',
 'compact previous bill placement');
v62=replaceRequired(v62,
 '<section class="v62-change-section cancellations">',
 '<section class="v62-change-section cancellations ${cancellations.length?\'\':\'v62-empty-section\'}">',
 'empty cancellation section state');
v62=replaceRequired(v62,
 '<div class="tp-total"><span>FINAL ORDER TOTAL</span><b>${money(updated)}</b></div></div><footer class="tp-foot v41-footer">',
 '<div class="tp-total"><span>FINAL ORDER TOTAL</span><b>${money(updated)}</b></div></div><div class="v62-payment-state ${paid(order)?\'paid\':\'unpaid\'}"><b>${paid(order)?\'PAID\':\'PAYMENT DUE\'}</b><span>${paid(order)?\'Updated paid receipt\':\'Updated unpaid bill · collect full payment later\'}</span></div><footer class="tp-foot v41-footer">',
 'edited receipt payment state');
write(v62Path,v62);

/* 4. Receipt-only styles; the existing POS/cart layout stays untouched. */
const v62CssPath=file('v62.css');
let v62css=read(v62CssPath).replace(/v0\.15\.54/g,'v0.15.56');
if(!v62css.includes('.v62-previous-summary'))v62css+=`\n.v62-empty-section{display:none!important}\n.v62-previous-summary{margin:0 0 7px;border:1.5px solid #000;background:#fff;color:#000}\n.v62-previous-summary .v62-section-title{border:0;border-bottom:1px solid #000}\n.v62-previous-preview{padding:6px 7px 5px;font-size:8px;line-height:1.25;font-weight:800;border-bottom:1px dashed #777}\n.v62-previous-totals{display:flex;justify-content:space-between;gap:8px;padding:6px 7px;font-size:8.5px;font-weight:850}\n.v62-previous-totals b{font-size:10px;font-weight:950}\n.v62-payment-state{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 7px;padding:6px 7px;border:2px solid #000;background:#fff;color:#000}\n.v62-payment-state b{font-size:11px;font-weight:950;letter-spacing:.04em}\n.v62-payment-state span{font-size:7.5px;font-weight:850;text-align:right}\n@media print{.v62-previous-summary,.v62-payment-state{background:#fff!important;color:#000!important}}\n`;
write(v62CssPath,v62css);

/* 5. Final release/cache stamps after all earlier historical patches. */
const indexPath=file('index.html');
let index=read(indexPath);
index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="'+RELEASE+'">');
index=index.replace(/<link rel="stylesheet" href="\/v62\.css\?v=[^"]+">/,'<link rel="stylesheet" href="/v62.css?v='+REVISION+'">');
index=index.replace(/<script src="\/v62\.js\?v=[^"]+"><\/script>/,'<script src="/v62.js?v='+REVISION+'"></script>');
write(indexPath,index);
const v61Path=file('v61.js');
let v61=read(v61Path).replace(/const BUILD='[^']+',REV='[^']+';/,"const BUILD='"+RELEASE+"',REV='"+REVISION+"';");
write(v61Path,v61);

/* 6. Build-time verification of every requested print route. */
const finalV41=read(v41Path),finalV50=read(v50Path),finalV56=read(file('v56.js')),finalV58=read(file('v58.js')),finalV43=read(file('v43.js')),finalV61=read(v61Path),finalV62=read(v62Path),finalIndex=read(indexPath);
const bookingFlow=section(finalV41,'async function postBookingPrint(order){','\n\nfunction billLine','new booking print');
const latePaymentFlow=section(finalV41,'async function submitLatePayment(event){','\n\nfunction ensureDueDialog','later payment print');
const checks=[
 ['all hot-drink photos mapped',finalV50.includes('"Cardamom Tea":"cardamom-tea.webp"')&&finalV50.includes('"Karrak Tea":"karrak-tea.webp"')&&finalV50.includes('"Black Coffee":"black-coffee.webp"')&&finalV50.includes('"Green Tea":"green-tea.webp"')],
 ['cart uses exact menu photo source',finalV50.includes("el.src=src;el.dataset.v50Image=src")],
 ['new orders are not skipped by service mode',!bookingFlow.includes("order.orderType==='Dine-in'")],
 ['new order prints kitchen then customer',bookingFlow.indexOf("printSlip?.(order,'kitchen',true)")>=0&&bookingFlow.indexOf('printCustomerBillNow(order,isPaid(order))')>bookingFlow.indexOf("printSlip?.(order,'kitchen',true)")],
 ['later payment prints paid customer only',latePaymentFlow.includes('printCustomerBill(paid,true)')&&!latePaymentFlow.includes('printSlip')&&!latePaymentFlow.includes('postBookingPrint')],
 ['edit response reaches running-order completion',finalV56.includes('mnahelsV58?.completeRunningOrder')],
 ['addition kitchen delta only',finalV58.includes("printRunningSlip(order,additions,'addition',result)")&&finalV61.includes('NEW ITEMS ONLY')],
 ['removal kitchen delta only',finalV58.includes("printRunningSlip(order,cancellations,'cancellation',result)")&&finalV61.includes('CANCELLED ITEMS ONLY')],
 ['running kitchen label preserved',finalV61.includes('RUNNING ORDER')&&finalV61.includes('deltaRows(lines)')],
 ['edited customer bill auto prints',finalV62.includes('await printUpdatedReceipt(resolved,result,true)')],
 ['short previous bill present',finalV62.includes('PREVIOUS BILL — SHORT VIEW')&&finalV62.includes('total qty')&&finalV62.includes('previousRows(order,result)')],
 ['edited additions and removals present',finalV62.includes('NEWLY ADDED ITEMS')&&finalV62.includes('CANCELLED / REMOVED ITEMS')],
 ['edited final total and due state present',finalV62.includes('FINAL ORDER TOTAL')&&finalV62.includes('UPDATED UNPAID')&&finalV62.includes('PAYMENT DUE')],
 ['attribution preserved',finalV43.toLowerCase().includes('a product by eastern cross technology')&&finalV61.toLowerCase().includes('a product by eastern cross technology')&&finalV62.toLowerCase().includes('a product by eastern cross technology')&&finalV62.includes('www.easterncrosstech.com')],
 ['release stamped',finalIndex.includes('content="'+RELEASE+'"')&&finalIndex.includes('/v62.js?v='+REVISION)&&finalV62.includes("const BUILD='"+RELEASE+"'")]
];
const failed=checks.filter(([,ok])=>!ok).map(([label])=>label);
if(failed.length)throw new Error('Order image / receipt flow v'+RELEASE+' verification failed: '+failed.join(', '));
new Function(finalV41);new Function(finalV50);new Function(finalV61);new Function(finalV62);

/* Runtime receipt cases: addition and removal reconstruct the previous order
   compactly and keep the final order total / unpaid state explicit. */
const sandbox={console,window:{state:{},mnahelsV43:{},mnahelsV58:{completeRunningOrder:async()=>true}},document:{readyState:'complete',documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}},setTimeout:fn=>{fn();return 1},setInterval:()=>1,clearTimeout:()=>{},Promise,Date,Number,String,Array,Set,Map,Math,JSON};
sandbox.window.window=sandbox.window;vm.runInNewContext(finalV62,sandbox,{filename:'v62.js'});
const burger={variantId:1,productName:'Burger',variantName:'Regular',quantity:2,unitPrice:350,lineTotal:700};
const tea={variantId:2,productName:'Green Tea',variantName:'Regular',quantity:1,unitPrice:70,lineTotal:70};
const addedOrder={id:78,tokenNumber:1778,orderType:'Dine-in',paymentStatus:'Unpaid',items:[burger,tea],subtotal:770,discount:0,total:770};
const added=sandbox.window.mnahelsV62.updatedReceiptHtml(addedOrder,{previousTotal:700,updatedTotal:770,additions:[tea],cancellations:[],amendedAt:new Date().toISOString()});
if(!added.includes('PREVIOUS BILL — SHORT VIEW')||!added.includes('2× Burger')||!added.includes('1 item line · 2 total qty')||!added.includes('Green Tea')||!added.includes('PAYMENT DUE')||!added.includes('FINAL ORDER TOTAL'))throw new Error('Addition receipt runtime test failed.');
const reducedBurger={...burger,quantity:1,lineTotal:350};
const reducedOrder={...addedOrder,id:79,tokenNumber:1779,items:[reducedBurger],subtotal:350,total:350};
const removed=sandbox.window.mnahelsV62.updatedReceiptHtml(reducedOrder,{previousTotal:700,updatedTotal:350,additions:[],cancellations:[{...burger,quantity:1,lineTotal:350}],amendedAt:new Date().toISOString()});
if(!removed.includes('2× Burger')||!removed.includes('CANCELLED / REMOVED ITEMS')||!removed.includes('- Rs 350')||!removed.includes('FINAL ORDER TOTAL'))throw new Error('Removal receipt runtime test failed.');
console.log('v'+RELEASE+' exact cart photos and new/edit/later-payment print flows verified.');
