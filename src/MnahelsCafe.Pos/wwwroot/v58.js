/*
 * Mnahel's Cafe POS · v0.15.46 clean running-order delta flow
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.46',REV='20260904-running-order-audit-46';
const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>`Rs ${Number(value||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
function currentState(){try{return window.state||state||{}}catch{return window.state||{}}}
function say(message){if(typeof window.toast==='function')window.toast(message)}
function itemName(item){return item?.productName||item?.name||'this item'}

function decorateCancellationState(){
 const app=currentState(),editing=Number(app.v56EditingOrderId||0)>0;
 qa('.v58-cancel-control').forEach(node=>node.remove());
 if(!editing||!Array.isArray(app.cart))return;
 const rows=qa('#cart-items .cart-line');
 rows.forEach((row,index)=>{
  const item=app.cart[index],original=Math.max(0,Number(item?.originalQuantity||0));
  q('.v58-cancel-state',row)?.remove();
  row.classList.remove('v58-partial-cancel-line','v58-cancelled-line');
  if(!item||!original)return;
  const current=Math.max(0,Number(item.quantity??0));
  const cancelled=Math.max(0,Math.min(original,original-current));
  if(!cancelled)return;
  const full=current===0;
  row.classList.add(full?'v58-cancelled-line':'v58-partial-cancel-line');
  const badge=document.createElement('span');
  badge.className='v58-cancel-state';
  badge.innerHTML=full?'<b>CANCELLED</b><small>Use + to restore</small>':`<b>-${cancelled} CANCELLED</b><small>${current} active of ${original}</small>`;
  (q('.qty',row)||row).appendChild(badge);
 });
}

function handleBookedCartAction(event){
 const button=event.target.closest?.('#cart-items button[data-a="-"],#cart-items button[data-a="x"]');
 if(!button)return;
 const app=currentState();
 if(!Number(app.v56EditingOrderId||0)||!Array.isArray(app.cart))return;
 const index=Number(button.dataset.i),item=app.cart[index];
 const original=Math.max(0,Number(item?.originalQuantity||0));
 if(!item||!original)return;
 const current=Math.max(0,Number(item.quantity??0));
 if(button.dataset.a==='-'&&current>original)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(current<=0){say(`${itemName(item)} already cancelled hai. + se restore kar sakte hain.`);return}
 const next=button.dataset.a==='x'?0:current-1;
 const cancelCount=Math.max(0,original-next);
 const prompt=button.dataset.a==='x'
  ?`Cancel ${Math.min(original,current)} booked ${itemName(item)} item(s)? Item cart mein red CANCELLED rahega.`
  :`Cancel 1 x ${itemName(item)} from this booked order?`;
 if(!confirm(prompt))return;
 item.quantity=next;
 item.runningCancelQuantity=cancelCount;
 item.runningCancelled=next===0;
 if(typeof window.renderCart==='function')window.renderCart();
 say(next===0?`${itemName(item)} marked CANCELLED.`:`${cancelCount} x ${itemName(item)} marked for cancellation.`);
}

function installCartHook(){
 const original=window.renderCart;
 if(typeof original!=='function'||original.__v58RunningOrder)return;
 const wrapped=function(...args){const value=original.apply(this,args);queueMicrotask(decorateCancellationState);return value};
 wrapped.__v58RunningOrder=true;
 window.renderCart=wrapped;
}

function billSummary(order,result){
 const previous=Number(result?.previousTotal??order?.total??0),updated=Number(result?.updatedTotal??order?.total??0);
 return `<div class="v58-bill-summary"><span><small>PREVIOUS BILL</small><b>${money(previous)}</b></span><i>→</i><span><small>UPDATED BILL</small><b>${money(updated)}</b></span></div>`;
}
function deltaReceiptHtml(order,lines,type,result){
 const cancellation=type==='cancellation';
 const title=cancellation?'RUNNING ORDER — CANCELLATION':'RUNNING ORDER';
 const subtitle=cancellation?'CANCELLED ITEMS ONLY':'NEW ITEMS ONLY · PREPARE PRIORITY';
 const items=(lines||[]).map(line=>({
  variantId:line.variantId,productName:line.productName,variantName:line.variantName||'Regular',
  quantity:Math.max(1,Number(line.quantity||1)),unitPrice:Number(line.unitPrice||0),
  lineTotal:Number(line.lineTotal||Number(line.unitPrice||0)*Number(line.quantity||1)),notes:line.notes||null
 }));
 const copy={...order,items};
 let html='';
 if(window.mnahelsV43?.receiptHtml){
  html=window.mnahelsV43.receiptHtml(copy,'kitchen');
  html=html.replace('<strong>KITCHEN</strong><small>PREPARE NOW</small>',`<strong>${title}</strong><small>${subtitle}</small>`);
  html=html.replace('data-receipt-kind="kitchen"',`data-receipt-kind="${cancellation?'running-cancellation':'running-addition'}"`);
  html=html.replace('class="tp tp-customer v43-receipt kitchen"',`class="tp tp-customer v43-receipt kitchen v58-running-slip ${cancellation?'v58-cancellation':'v58-addition'}"`);
  html=html.replace('<div class="v43-body">',`<div class="v58-running-title">${title}</div><div class="v58-running-subtitle">${subtitle}</div><div class="v43-body">`);
  html=html.replace(/<span class="v43-qty">(\d+)<\/span>/g,(_,quantity)=>`<span class="v43-qty">${cancellation?'-':'+'}${quantity}</span>`);
  html=html.replace(/ · Prep line/g,cancellation?' · CANCELLED':' · ADD NOW · PRIORITY');
  html=html.replace('<footer class="tp-foot v41-footer">',`${billSummary(order,result)}<footer class="tp-foot v41-footer">`);
  html=html.replace('<strong>KITCHEN COPY</strong><span>Prepare with care.</span>',`<strong>${title}</strong><span>${cancellation?'Sirf minus items cancel karein.':'Sirf naye items tayar karein; purana order repeat nahi hai.'}</span>`);
  return html;
 }
 const rows=items.map(item=>`<div class="tp-kitem"><b>${cancellation?'-':'+'}${item.quantity} x</b><span>${esc(item.productName)}${item.variantName!=='Regular'?` <em>${esc(item.variantName)}</em>`:''}</span></div>`).join('');
 return `<article class="tp tp-kitchen v58-running-slip ${cancellation?'v58-cancellation':'v58-addition'}" data-receipt-kind="${cancellation?'running-cancellation':'running-addition'}"><div class="tp-head"><b>${title}</b><small>${subtitle}</small></div><div class="tp-token">MC-${esc(order?.tokenNumber??'—')}</div><div class="v58-fallback-customer">${esc(order?.customerName||'Walk-in customer')}</div><div class="tp-dash"></div>${rows}${billSummary(order,result)}<div class="tp-foot"><b>${title}</b><small>${cancellation?'Cancelled items only':'New items only · prepare priority'}</small></div></article>`;
}

function bridgePrint(){
 if(!(window.__mnahelsDualPrintBridge&&window.chrome?.webview?.postMessage)){try{window.print()}catch{}return Promise.resolve(true)}
 return new Promise(resolve=>{
  let finished=false;
  const handler=event=>{const message=String(event.data||'');if(message!=='mnahels-print-kitchen-done'&&message!=='mnahels-print-kitchen-cancelled')return;finished=true;try{window.chrome.webview.removeEventListener('message',handler)}catch{}resolve(message.endsWith('-done'))};
  try{window.chrome.webview.addEventListener('message',handler);window.chrome.webview.postMessage('mnahels-print-kitchen')}catch{resolve(false);return}
  setTimeout(()=>{if(!finished){try{window.chrome.webview.removeEventListener('message',handler)}catch{}resolve(true)}},20000);
 });
}
async function printRunningSlip(order,lines,type,result){
 if(!Array.isArray(lines)||!lines.length)return true;
 const sheet=q('#print-sheet');if(!sheet){say('Kitchen print sheet nahi mili.');return false}
 sheet.removeAttribute('style');sheet.className='print-sheet tp-sheet kitchen v58-running-print';sheet.innerHTML=deltaReceiptHtml(order,lines,type,result);
 await sleep(180);const ok=await bridgePrint();if(!ok)say('Kitchen running-order print cancel ho gayi.');return ok;
}
function restoreNormalSuccess(){q('#v58-running-actions')?.remove();['#preview-kitchen','#print-kitchen'].forEach(selector=>{const button=q(selector);if(button)button.hidden=false});q('#success-dialog')?.classList.remove('v58-running-success')}
function installNormalCompletionHook(){const original=window.showOrderComplete;if(typeof original!=='function'||original.__v58RunningOrder)return;const wrapped=function(order){restoreNormalSuccess();const app=currentState();app.v58RunningResult=null;return original.apply(this,arguments)};wrapped.__v58RunningOrder=true;window.showOrderComplete=wrapped}
function resetOrderContext(){const app=currentState();app.v38SetupDone=false;app.v38ProposedToken=null;app.tableId=null;app.tableNumber=null;app.waiterId=null;app.riderId=null;q('#v38-order-context')?.remove();q('#screen-pos')?.classList.remove('v38-ready','v35-booking-open','v56-editing-order');document.documentElement.classList.remove('v35-booking-active','v56-editing-order')}
function showRunningSuccess(order,result){
 restoreNormalSuccess();const dialog=q('#success-dialog');if(!dialog)return;dialog.classList.add('v58-running-success');
 const additions=result?.additions||[],cancellations=result?.cancellations||[];
 const added=additions.reduce((sum,line)=>sum+Number(line.quantity||0),0),cancelled=cancellations.reduce((sum,line)=>sum+Number(line.quantity||0),0);
 const token=q('#success-token');if(token)token.textContent=`Running order #${order?.tokenNumber??'—'} updated`;
 const copy=q('#success-receipt');if(copy)copy.textContent=`${added} added · ${cancelled} cancelled · ${money(result?.previousTotal)} → ${money(result?.updatedTotal??order?.total)}`;
 ['#preview-kitchen','#print-kitchen'].forEach(selector=>{const button=q(selector);if(button)button.hidden=true});
 const actions=document.createElement('div');actions.id='v58-running-actions';actions.className='v58-running-actions';
 actions.innerHTML=`${additions.length?'<button type="button" data-v58-print="addition">Print RUNNING ORDER</button>':''}${cancellations.length?'<button type="button" data-v58-print="cancellation" class="danger">Print cancellation slip</button>':''}`;
 actions.addEventListener('click',async event=>{const type=event.target.closest?.('[data-v58-print]')?.dataset.v58Print;if(!type)return;const button=event.target.closest('button');button.disabled=true;try{await printRunningSlip(order,type==='addition'?additions:cancellations,type,result)}finally{button.disabled=false}});
 q('#new-order',dialog)?.before(actions);if(!dialog.open)dialog.showModal();
}
async function completeRunningOrder(order,result){
 const app=currentState();app.lastOrder=order;app.v58RunningResult=result;resetOrderContext();showRunningSuccess(order,result);
 const additions=result?.additions||[],cancellations=result?.cancellations||[];
 if(additions.length)await printRunningSlip(order,additions,'addition',result);
 if(cancellations.length)await printRunningSlip(order,cancellations,'cancellation',result);
 const added=additions.reduce((sum,line)=>sum+Number(line.quantity||0),0),cancelled=cancellations.reduce((sum,line)=>sum+Number(line.quantity||0),0);
 say(added||cancelled?`RUNNING ORDER updated · +${added} / -${cancelled} · sirf changed items kitchen ko bheje gaye.`:'Order details updated · kitchen item change nahi tha.');
}
function boot(){installCartHook();installNormalCompletionHook();decorateCancellationState();document.documentElement.dataset.v58Revision=REV}
let timer=0;function schedule(delay=30){if(timer)return;timer=setTimeout(()=>{timer=0;boot()},delay)}
document.addEventListener('click',handleBookedCartAction,true);
const cart=q('#cart-items');if(cart)new MutationObserver(()=>schedule(20)).observe(cart,{childList:true,subtree:false});
document.addEventListener('click',event=>{if(event.target.closest?.('#place-order,[data-op="edit"],#new-order'))schedule(40)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(0),{once:true});else schedule(0);
setTimeout(()=>schedule(0),700);setTimeout(()=>schedule(0),1800);
window.mnahelsV58={build:BUILD,uiRevision:REV,completeRunningOrder,printRunningSlip,decoratePartialCancellation:decorateCancellationState};
})();
