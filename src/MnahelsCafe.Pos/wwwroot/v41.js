/*
 * Mnahel's Cafe POS · v0.15.14 order-first booking and practical payment settlement
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.16',UI_REVISION='20260830-reset-16';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=v=>`Rs ${Number(v||0).toLocaleString('en-PK')}`;
const svg=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const icons={money:svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>'),bill:svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/>'),check:svg('<path d="m5 12 4 4L19 6"/>'),clock:svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>'),card:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),online:svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 18h2"/>')};
let orderMap=new Map(),bookingBusy=false,paymentTarget=null,payNow=false,dueBusy=false,salesHooked=null,salesPaintBusy=false,salesRepairTimer=0,printQueue=Promise.resolve();
const isPaid=o=>String(o?.paymentStatus||'Paid').toLowerCase()==='paid';
const isActive=o=>o&&o.status!=='Completed'&&o.status!=='Cancelled';
const orderTotal=()=>Number(String(q('#total')?.textContent||'0').replace(/[^0-9.-]/g,''))||0;
const bookCash=()=>Number(q('#v36-cash-received')?.value||0)||0;
function resetMenuSearch(){const input=q('#search');if(!input)return;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur()}

function installApiBridge(){
 if(window.__v41PaymentBridge||typeof window.api!=='function')return;
 window.__v41PaymentBridge=true;const previous=window.api;
 window.api=async function(path,options={}){
  let next=String(path),method=String(options.method||'GET').toUpperCase();
  if(next==='/api/orders'&&method==='POST')next='/api/orders/book';
  else if(/^\/api\/orders\/\d+\/status$/.test(next)&&method==='PUT')next=next.replace(/\/status$/,'/workflow-status');
  else if(next==='/api/dashboard'&&method==='GET')next='/api/dashboard/payment-aware';
  else if(next==='/api/insights'&&method==='GET')next='/api/insights/payment-aware';
  else if(next==='/api/customers'&&method==='GET')next='/api/customers/payment-aware';
  else if(/^\/api\/customers\/\d+$/.test(next)&&method==='GET')next+='/payment-aware';
  const result=await previous(next,options);
  if(method==='GET'&&String(path).startsWith('/api/orders?')&&Array.isArray(result)){
   result.forEach(order=>orderMap.set(String(order.id),order));
   queueMicrotask(()=>{decorateCards();paintDueButton()});
   if(state?.currentScreen==='sales')return result.filter(order=>order.status!=='Cancelled'&&isPaid(order));
  }
  return result;
 };
}

function ensurePaymentDialog(){
 let dialog=q('#v41-payment-dialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='v41-payment-dialog';dialog.className='v41-payment-dialog';
 dialog.innerHTML=`<form id="v41-payment-form"><button type="button" class="v41-dialog-close" data-v41-payment-close>×</button><header><span>${icons.money}</span><div><small>FULL PAYMENT</small><h2>Add payment</h2><p id="v41-payment-order">MC-—</p></div></header><section class="v41-due-hero"><span>AMOUNT DUE</span><strong id="v41-payment-due">Rs 0</strong><small>Partial payment is not enabled</small></section><div class="v41-methods"><button type="button" class="active" data-v41-method="Cash">${icons.money}<span>Cash</span></button><button type="button" data-v41-method="Card">${icons.card}<span>Card</span></button><button type="button" data-v41-method="Online">${icons.online}<span>Online</span></button></div><section id="v41-cash-panel" class="v41-cash-panel"><label><span>Cash received</span><div>Rs <input id="v41-payment-received" type="number" min="0" step="1" inputmode="decimal" placeholder="0"></div></label><div id="v41-payment-change"><span>Change to return</span><strong>Rs 0</strong></div></section><label id="v41-reference-wrap" class="v41-reference-wrap" hidden><span>Card / online reference <small>Optional</small></span><input id="v41-payment-reference" maxlength="80" placeholder="Transaction or approval reference"></label><p class="v41-payment-note">Payment save hote hi order <b>Paid + Completed</b> ho ga aur table/waiter release ho jayen ge.</p><button id="v41-confirm-payment" class="v41-confirm-payment" type="submit">${icons.check}<span>Confirm payment & complete</span></button></form>`;
 q('#print-sheet')?.before(dialog);
 q('[data-v41-payment-close]',dialog).onclick=()=>dialog.close();
 qa('[data-v41-method]',dialog).forEach(button=>button.onclick=()=>{qa('[data-v41-method]',dialog).forEach(x=>x.classList.toggle('active',x===button));syncLatePaymentUi()});
 q('#v41-payment-received',dialog).oninput=syncLateChange;
 q('#v41-payment-form',dialog).onsubmit=submitLatePayment;
 return dialog;
}
function selectedLateMethod(){return q('#v41-payment-dialog [data-v41-method].active')?.dataset.v41Method||'Cash'}
function syncLateChange(){
 const due=Number(paymentTarget?.total||0),got=Number(q('#v41-payment-received')?.value||0),method=selectedLateMethod(),short=method==='Cash'&&got<due,box=q('#v41-payment-change');
 if(box){box.classList.toggle('short',short);q('span',box).textContent=short?'Still due':'Change to return';q('strong',box).textContent=cash(Math.abs(got-due))}
 const submit=q('#v41-confirm-payment');if(submit)submit.disabled=short;
}
function syncLatePaymentUi(){const cashMode=selectedLateMethod()==='Cash';q('#v41-cash-panel').hidden=!cashMode;q('#v41-reference-wrap').hidden=cashMode;syncLateChange();setTimeout(()=>q(cashMode?'#v41-payment-received':'#v41-payment-reference')?.focus(),30)}
function openPayment(order){
 if(!order)return toast('Order load nahi hua. Refresh karke dobara koshish karein.');
 if(isPaid(order))return toast('Order already paid hai.');
 paymentTarget=order;const dialog=ensurePaymentDialog();
 q('#v41-payment-order').textContent=`MC-${order.tokenNumber} · ${order.orderType} · ${order.customerName||'Walk-in'}`;
 q('#v41-payment-due').textContent=cash(order.total);q('#v41-payment-received').value='';q('#v41-payment-reference').value='';
 qa('[data-v41-method]',dialog).forEach(x=>x.classList.toggle('active',x.dataset.v41Method==='Cash'));syncLatePaymentUi();dialog.showModal();
}
async function submitLatePayment(event){
 event.preventDefault();if(!paymentTarget)return;
 const button=q('#v41-confirm-payment'),method=selectedLateMethod(),received=method==='Cash'?Number(q('#v41-payment-received').value||0):null,reference=method==='Cash'?null:q('#v41-payment-reference').value.trim();
 if(method==='Cash'&&received<Number(paymentTarget.total||0))return syncLateChange();
 button.disabled=true;button.classList.add('busy');q('span',button).textContent='Saving full payment…';
 try{
  const paid=await window.api(`/api/orders/${paymentTarget.id}/payment`,{method:'POST',body:JSON.stringify({paymentMethod:method,cashReceived:received,reference,completeOrder:true})});
  orderMap.set(String(paid.id),paid);state.dashboardSignature='';state.salesSignature='';state.orderSignature='';q('#v41-payment-dialog').close();paymentTarget=null;
  await Promise.allSettled([window.mnahelsV36?.renderOperations?.(true),window.mnahelsV36?.refreshHub?.(true),refreshDue(true)]);
  await printCustomerBill(paid,true);toast(`MC-${paid.tokenNumber} paid and completed.`);
 }catch(error){toast(error.message||'Payment save nahi hui.')}finally{button.disabled=false;button.classList.remove('busy');q('span',button).textContent='Confirm payment & complete'}
}

function ensureDueDialog(){
 let dialog=q('#v41-due-dialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='v41-due-dialog';dialog.className='v41-due-dialog';dialog.innerHTML=`<header><div><small>PAYMENT QUEUE</small><h2>Due payments</h2><p>Booked orders that still need full payment</p></div><button type="button" data-v41-due-close>×</button></header><div id="v41-due-list" class="v41-due-list"></div>`;
 q('#print-sheet')?.before(dialog);q('[data-v41-due-close]',dialog).onclick=()=>dialog.close();return dialog;
}
function dueOrders(){return [...orderMap.values()].filter(order=>!isPaid(order)&&order.status!=='Cancelled'&&order.status!=='Completed').sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))}
function stageLabel(order){if(order.status==='New')return'Booked';if(order.status==='Preparing')return'Prepared';if(order.status==='Ready')return order.orderType==='Dine-in'?'Served':order.orderType==='Delivery'?'Delivered':'Prepared';if(order.status==='Completed')return'Completed';return order.status}
function renderDueList(){
 const box=q('#v41-due-list');if(!box)return;const rows=dueOrders();
 box.innerHTML=rows.map(order=>`<article data-v41-due-order="${order.id}"><span class="v41-due-token">MC-${E(order.tokenNumber)}</span><div><strong>${E(order.customerName||'Walk-in customer')}</strong><small>${E(order.orderType)} · ${E(stageLabel(order))}</small></div><p><b>${cash(order.total)}</b><small>PAYMENT DUE</small></p><button type="button" data-v41-bill="${order.id}">${icons.bill}<span>Bill</span></button><button type="button" class="primary" data-v41-pay="${order.id}">${icons.money}<span>Pay</span></button></article>`).join('')||`<div class="v41-no-due">${icons.check}<strong>All settled</strong><span>No unpaid active orders.</span></div>`;
}
function paintDueButton(){const button=q('#v41-due-button');if(!button)return;const rows=dueOrders(),total=rows.reduce((sum,x)=>sum+Number(x.total||0),0);q('b',button).textContent=String(rows.length);q('small',button).textContent=rows.length?`${cash(total)} due`:'All settled';button.classList.toggle('has-due',rows.length>0);if(q('#v41-due-dialog')?.open)renderDueList()}
async function refreshDue(force=false){if(dueBusy||!state?.user)return;dueBusy=true;try{const rows=await window.api('/api/orders?take=200');if(Array.isArray(rows))rows.forEach(order=>orderMap.set(String(order.id),order));paintDueButton();renderDueList()}catch(error){if(force)toast(error.message||'Due payments could not be loaded.')}finally{dueBusy=false}}
function openDue(){const dialog=ensureDueDialog();renderDueList();dialog.showModal();refreshDue()}

function paymentBar(order){
 const paid=isPaid(order),done=order.status==='Completed',cancelled=order.status==='Cancelled',method=order.paymentMethod||'Payment';
 if(cancelled)return`<section class="v41-order-payment cancelled"><div><b>CANCELLED</b><span>No payment due</span></div></section>`;
 const actions=paid?`${done?'':`<button type="button" data-v41-complete="${order.id}">${icons.check}<span>Complete order</span></button>`}<button type="button" data-v41-bill="${order.id}">${icons.bill}<span>Print receipt</span></button>`:`<button type="button" class="primary" data-v41-pay="${order.id}">${icons.money}<span>Add payment</span></button><button type="button" data-v41-bill="${order.id}">${icons.bill}<span>Print bill</span></button><button type="button" data-v41-complete="${order.id}">${icons.check}<span>Complete order</span></button>`;
 return `<section class="v41-order-payment ${paid?'paid':'unpaid'}"><div class="v41-payment-state"><b>${paid?'PAID':'UNPAID'}</b><span>${paid?`${E(method)} · ${cash(order.total)}`:`${cash(order.total)} Due`}</span><small>${paid?(done?'Completed':'Payment received'):(order.status==='Ready'&&order.orderType==='Delivery'?'Delivered · Payment due':`${E(stageLabel(order))} · Payment due`)}</small></div><div class="v41-payment-actions">${actions}</div></section>`;
}
function decorateCards(){
 qa('#admin-orders .v36-order-card').forEach(card=>{
  const order=orderMap.get(String(card.dataset.id));if(!order)return;
  let bar=q('.v41-order-payment',card),markup=paymentBar(order),sig=`${order.paymentStatus}:${order.paymentMethod}:${order.status}:${order.total}`;
  if(!bar){q('.v36-progress',card)?.insertAdjacentHTML('beforebegin',markup);bar=q('.v41-order-payment',card)}else if(bar.dataset.sig!==sig)bar.outerHTML=markup;
  bar=q('.v41-order-payment',card);if(bar)bar.dataset.sig=sig;card.classList.toggle('v41-unpaid',!isPaid(order));
  const payLabel=q('.v36-total>span b',card);if(payLabel)payLabel.textContent=isPaid(order)?order.paymentMethod||'Paid':'Payment due';if(isPaid(order)&&order.status!=='Cancelled')q('.v36-cancel',card)?.remove();
 });
}

function ensureCartPayment(){
 const toolbar=q('#screen-pos .catalog-panel .toolbar'),newOrder=q('#ma-new-order',toolbar);
 if(toolbar&&newOrder&&!q('#v41-due-button')){const button=document.createElement('button');button.id='v41-due-button';button.type='button';button.innerHTML=`${icons.clock}<span><strong>Due payments</strong><small>All settled</small></span><b>0</b>`;newOrder.before(button);button.onclick=openDue}
 const footer=q('#screen-pos .cart-footer'),place=q('#place-order',footer),payRow=q('.pay-row',footer);if(!footer||!place)return;
 if(!q('#v41-book-actions')){const actions=document.createElement('section');actions.id='v41-book-actions';actions.innerHTML=`<div><strong>Book first</strong><small id="v41-book-hint">No payment required now</small></div><button id="v41-pay-now" type="button">${icons.money}<span>Pay now</span></button>`;place.before(actions);q('#v41-pay-now').onclick=()=>{payNow=!payNow;syncBookPaymentUi()}}
 if(payRow&&!q('#v41-book-reference')){const reference=document.createElement('label');reference.id='v41-book-reference';reference.hidden=true;reference.innerHTML='<span>Payment reference <small>Optional</small></span><input id="v41-book-reference-input" maxlength="80" placeholder="Card / online reference">';payRow.after(reference)}
 syncBookPaymentUi();
}
function syncBookPaymentUi(){
 const screen=q('#screen-pos');if(!screen)return;state.v41PayNow=payNow;screen.classList.toggle('v41-pay-now',payNow);
 const toggle=q('#v41-pay-now');if(toggle){toggle.classList.toggle('active',payNow);q('span',toggle).textContent=payNow?'Pay later instead':'Pay now'}
 const hint=q('#v41-book-hint');if(hint)hint.textContent=payNow?'Collect full payment with this booking':'Order will be Booked + Unpaid';
 const label=q('#place-order span');if(label)label.textContent=payNow?'Pay & book':'Book order';
 const ref=q('#v41-book-reference');if(ref)ref.hidden=!payNow||state.payment==='Cash';
}
function validateResources(){if(!state.v38SetupDone){toast('Pehle New order se order setup complete karein.');window.mnahelsV38?.openSetup?.(false);return false}if(state.orderType==='Delivery'&&!state.riderId){toast('Delivery order ke liye rider select karein.');return false}if(state.orderType==='Dine-in'&&!state.tableId){toast('Dine-in order ke liye table select karein.');return false}if(state.orderType==='Dine-in'&&!state.waiterId){toast('Dine-in order ke liye waiter select karein.');return false}return true}
function customerValues(){return{name:q('#customer-name')?.value.trim()||null,phone:String(q('#customer-phone')?.value||'').replace(/\D/g,'')||null,address:q('#delivery-address')?.value.trim()||null}}
async function submitBooking(){
 if(bookingBusy)return;if(!state.cart.length)return toast('Add an item first.');if(!validateResources())return;
 const customer=customerValues();if(state.orderType==='Delivery'&&(!customer.name||!customer.phone||!customer.address))return toast('Delivery ke liye complete customer details required hain.');
 const total=orderTotal(),received=bookCash();if(payNow&&state.payment==='Cash'&&received<total){toast(`Cash received kam az kam ${cash(total)} hona chahiye.`);q('#v36-cash-received')?.focus();return}
 const button=q('#place-order'),old=button.innerHTML;bookingBusy=true;button.disabled=true;button.innerHTML='<span>Booking order…</span><b>•••</b>';
 try{
  const payload={items:state.cart.map(item=>({variantId:item.variantId,quantity:item.quantity,notes:null})),orderType:state.orderType,paymentMethod:payNow?state.payment:null,payNow,discount:window.mnahelsV39?.discountAmount?.()||0,notes:q('#order-note')?.value.trim()||null,customerName:customer.name,customerPhone:customer.phone,deliveryAddress:state.orderType==='Delivery'?customer.address:null,tableNumber:state.orderType==='Dine-in'?state.tableId:null,tableId:state.orderType==='Dine-in'?state.tableId:null,waiterId:state.orderType==='Dine-in'?state.waiterId:null,riderId:state.orderType==='Delivery'?state.riderId:null,cashReceived:payNow&&state.payment==='Cash'?received:null,paymentReference:payNow&&state.payment!=='Cash'?q('#v41-book-reference-input')?.value.trim()||null:null};
  const order=await window.api('/api/orders',{method:'POST',body:JSON.stringify(payload)});orderMap.set(String(order.id),order);state.lastOrder=order;state.cart=[];resetMenuSearch();
  const discount=q('#discount');if(discount){discount.value='';discount.dataset.v39Percent='0'}if(q('#order-note'))q('#order-note').value='';if(q('#v36-cash-received'))q('#v36-cash-received').value='';if(q('#v41-book-reference-input'))q('#v41-book-reference-input').value='';
  payNow=false;syncBookPaymentUi();renderCart();showOrderComplete(order);setTimeout(()=>{const detail=q('#v40-order-success .v40-success-card>p');if(detail)detail.textContent=isPaid(order)?`${order.orderType} · Paid now`:`${order.orderType} · Booked unpaid`},40);state.dashboardSignature='';state.salesSignature='';await refreshDue(true);postBookingPrint(order);
 }catch(error){toast(error.message||'Order book nahi hua.')}finally{bookingBusy=false;button.disabled=false;button.innerHTML=old;syncBookPaymentUi();window.totals?.()}
}
function enqueuePrint(task){const run=printQueue.then(task,task);printQueue=run.catch(()=>{});return run}
async function postBookingPrint(order){if(order.orderType==='Dine-in')return;return enqueuePrint(async()=>{await new Promise(resolve=>setTimeout(resolve,320));await window.mnahelsV36?.printSlip?.(order,'kitchen',true);await new Promise(resolve=>setTimeout(resolve,180));await printCustomerBillNow(order,isPaid(order))})}

function billLine(label,value){return `<div class="tp-line"><span>${label}</span><b>${value}</b></div>`}
function billHtml(order,paid=isPaid(order)){
 if(window.mnahelsV43?.receiptHtml)return window.mnahelsV43.receiptHtml(order,paid?'paid':'unpaid');
 const items=(order.items||[]).map(item=>`<div class="tp-item"><div><b>${Number(item.quantity||0)}× ${E(item.productName)}</b><small>${E(item.variantName||'Regular')} · ${cash(item.unitPrice)} each</small></div><strong>${cash(item.lineTotal)}</strong></div>`).join('');
 const service=order.orderType==='Dine-in'?`${billLine('Table',E(order.tableName||`Table ${order.tableNumber||'—'}`))}${billLine('Waiter',E(order.waiterName||'—'))}`:order.orderType==='Delivery'?`${billLine('Rider',E(order.riderName||'—'))}${order.deliveryAddress?billLine('Address',E(order.deliveryAddress)):''}`:'';
 return `<div class="tp tp-customer v41-receipt ${paid?'paid':'unpaid'}"><div class="tp-head"><b>MNAHEL'S CAFE</b><small>${paid?'FINAL PAID RECEIPT':'PROVISIONAL BILL'}</small></div><div class="v41-receipt-state">${paid?'PAID':'PAYMENT DUE'}</div><div class="tp-dash"></div>${billLine('Order',`MC-${E(order.tokenNumber)}`)}${billLine('Type',E(order.orderType||'Takeaway'))}${billLine('Customer',E(order.customerName||'Walk-in'))}${service}<div class="tp-dash"></div><div class="tp-th"><span>Item</span><b>Amount</b></div>${items}<div class="tp-dash"></div>${billLine('Subtotal',cash(order.subtotal))}${order.discount?billLine('Discount',`- ${cash(order.discount)}`):''}<div class="tp-total"><span>${paid?'TOTAL PAID':'AMOUNT DUE'}</span><b>${cash(order.total)}</b></div>${paid?`${billLine('Payment method',E(order.paymentMethod||'Paid'))}${order.paymentReference?billLine('Reference',E(order.paymentReference)):''}${order.paymentMethod==='Cash'&&order.cashReceived!=null?`${billLine('Cash received',cash(order.cashReceived))}${billLine('Change',cash(order.changeDue))}`:''}`:'<div class="v41-due-warning"><b>PAYMENT DUE</b><span>This is not a paid receipt.</span></div>'}<div class="tp-foot"><b>A product by Eastern Cross Technology</b><small>${paid?'Thank you.':'Please collect full payment before completion.'}</small></div></div>`;
}
async function printCustomerBillNow(order,paid=isPaid(order)){const sheet=q('#print-sheet');if(!sheet)return false;sheet.removeAttribute('style');sheet.className='print-sheet tp-sheet customer';sheet.innerHTML=billHtml(order,paid);await new Promise(resolve=>setTimeout(resolve,140));try{if(window.__mnahelsDualPrintBridge&&window.chrome?.webview?.postMessage)window.chrome.webview.postMessage('mnahels-print-customer');else window.print();return true}catch(error){toast('Bill print nahi hua.');return false}}
async function printCustomerBill(order,paid=isPaid(order)){return enqueuePrint(()=>printCustomerBillNow(order,paid))}
async function setComplete(order){if(!order)return;if(!isPaid(order))return openPayment(order);try{const updated=await window.api(`/api/orders/${order.id}/status`,{method:'PUT',body:JSON.stringify({status:'Completed'})});orderMap.set(String(order.id),{...order,...updated,status:'Completed'});state.dashboardSignature='';state.salesSignature='';await Promise.allSettled([window.mnahelsV36?.renderOperations?.(true),window.mnahelsV36?.refreshHub?.(true)]);toast(`MC-${order.tokenNumber} completed.`)}catch(error){toast(error.message||'Order complete nahi hua.')}}
function findOrder(id){return orderMap.get(String(id))}

function periodBounds(){const active=q('#report-ranges [data-report-range].active')?.dataset.reportRange||'month',now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()),end=new Date(start);end.setDate(end.getDate()+1);if(active==='yesterday'){end=new Date(start);start.setDate(start.getDate()-1)}else if(active==='week')start.setDate(start.getDate()-6);else if(active==='month')start.setDate(start.getDate()-29);else if(active==='year')start.setFullYear(start.getFullYear()-1);else if(active==='custom'){const a=q('#report-from')?.value,b=q('#report-to')?.value;if(a&&b){start=new Date(`${a}T00:00:00`);end=new Date(`${b}T00:00:00`);end.setDate(end.getDate()+1)}}return{start,end}}
async function rawOrders(){const response=await fetch('/api/orders?take=10000',{credentials:'same-origin',headers:{Accept:'application/json'}});if(!response.ok)throw Error('Reports could not load orders.');return response.json()}
function salesMetricsCorrect(){return qa('#one-metrics>.metric small').map(x=>x.textContent.trim()).join('|')==='Paid sales|Paid orders|Booked active|Outstanding|Cash sales'}
function scheduleSalesRepair(){if(state?.currentScreen!=='sales'||salesMetricsCorrect())return;clearTimeout(salesRepairTimer);salesRepairTimer=setTimeout(()=>paintSalesMetrics(),120)}
async function paintSalesMetrics(){
 const box=q('#one-metrics');if(!box||state?.currentScreen!=='sales'||salesPaintBusy)return;salesPaintBusy=true;
 try{const all=await rawOrders(),{start,end}=periodBounds(),rows=all.filter(order=>{const date=new Date(order.createdAt);return date>=start&&date<end}),valid=rows.filter(order=>order.status!=='Cancelled'),paid=valid.filter(isPaid),active=valid.filter(isActive),outstanding=valid.filter(order=>!isPaid(order)).reduce((sum,order)=>sum+Number(order.total||0),0),revenue=paid.reduce((sum,order)=>sum+Number(order.total||0),0),cashSales=paid.filter(order=>order.paymentMethod==='Cash').reduce((sum,order)=>sum+Number(order.total||0),0);box.innerHTML=[['Paid sales',cash(revenue),'green'],['Paid orders',paid.length,'green'],['Booked active',active.length,'amber'],['Outstanding',cash(outstanding),'orange'],['Cash sales',cash(cashSales),'neutral']].map(([label,value,tone])=>`<article class="metric v41-metric-${tone}"><small>${label}</small><strong>${value}</strong></article>`).join('');box.dataset.v41PaymentMetrics='1'}catch(error){console.warn('[v41 sales]',error)}finally{salesPaintBusy=false;if(!salesMetricsCorrect())scheduleSalesRepair()}
}
function hookSales(){const current=window.loadSales;if(typeof current!=='function'||current===salesHooked||current.__v41)return;const wrapped=async function(){const out=await current.apply(this,arguments);await paintSalesMetrics();return out};wrapped.__v41=true;wrapped.__v40=true;salesHooked=wrapped;window.loadSales=wrapped}
function decorateDashboardMetrics(){const grid=q('#metric-grid');if(!grid)return;const cards=qa(':scope>.metric',grid);if(cards.length>=4){q('small',cards[0]).textContent='Paid sales';q('small',cards[1]).textContent='Booked active';q('small',cards[2]).textContent='Outstanding';q('small',cards[3]).textContent='Active kitchen';grid.dataset.v41PaymentAware='1'}}
function observe(){if(document.documentElement.dataset.v41Observed)return;document.documentElement.dataset.v41Observed='1';new MutationObserver(records=>{let cards=false,metrics=false,sales=false;for(const record of records){const target=record.target;if(target.closest?.('#admin-orders'))cards=true;if(target.id==='metric-grid'||target.closest?.('#metric-grid'))metrics=true;if(target.id==='one-metrics'||target.closest?.('#one-metrics'))sales=true}if(cards)requestAnimationFrame(decorateCards);if(metrics)requestAnimationFrame(decorateDashboardMetrics);if(sales)scheduleSalesRepair()}).observe(document.body,{childList:true,subtree:true})}
function boot(){document.documentElement.dataset.uiRevision=UI_REVISION;installApiBridge();hookSales();ensurePaymentDialog();ensureDueDialog();ensureCartPayment();decorateCards();decorateDashboardMetrics();if(state?.user)refreshDue()}

window.addEventListener('keydown',event=>{if(event.key==='F2')resetMenuSearch()},true);
window.addEventListener('click',event=>{if(event.target.closest?.('#ma-new-order'))resetMenuSearch()},true);
document.addEventListener('click',event=>{
 const newOrder=event.target.closest?.('#ma-new-order');if(newOrder)resetMenuSearch();
 const place=event.target.closest?.('#place-order');if(place){event.preventDefault();event.stopImmediatePropagation();submitBooking();return}
 const completeStage=event.target.closest?.('[data-v36-status="Completed"]');if(completeStage){const order=findOrder(completeStage.dataset.id);if(order&&!isPaid(order)){event.preventDefault();event.stopImmediatePropagation();openPayment(order)}return}
 const pay=event.target.closest?.('[data-v41-pay]');if(pay){event.preventDefault();event.stopImmediatePropagation();openPayment(findOrder(pay.dataset.v41Pay));return}
 const bill=event.target.closest?.('[data-v41-bill]');if(bill){event.preventDefault();event.stopImmediatePropagation();const order=findOrder(bill.dataset.v41Bill);if(order)printCustomerBill(order,isPaid(order));return}
 const complete=event.target.closest?.('[data-v41-complete]');if(complete){event.preventDefault();event.stopImmediatePropagation();setComplete(findOrder(complete.dataset.v41Complete));return}
 if(event.target.closest?.('[data-payment]'))setTimeout(syncBookPaymentUi,0);
 if(event.target.closest?.('[data-screen="sales"]'))setTimeout(()=>paintSalesMetrics(),450);
},true);

installApiBridge();hookSales();observe();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));else setTimeout(boot,700);
setTimeout(boot,1500);setTimeout(()=>{boot();refreshDue(true)},2800);setInterval(()=>{boot();if(state?.user&&document.visibilityState==='visible'&&(state.currentScreen==='pos'||state.currentScreen==='admin'||q('#v41-due-dialog')?.open))refreshDue()},8000);
window.mnahelsV41={build:BUILD,uiRevision:UI_REVISION,isPaid,openPayment,refreshDue,printCustomerBill,paintSalesMetrics,decorateCards};
})();
