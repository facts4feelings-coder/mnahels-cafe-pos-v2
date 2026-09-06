/*
 * MNHEL CAFE v0.15.54 - receipt content and direct-print repair.
 * Reuses the existing cart, order editing, v43 receipt and desktop print bridge.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.60',REV='20260905-menu-images-order-print-56';
const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>`Rs ${Number(value||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const ICONS={
 'Dine-in':'<svg viewBox="0 0 24 24"><path d="M7 3v8m3-8v8M5 3v5c0 2 1 3 3 3s3-1 3-3V3M8 11v10M16 3v18m0-18c2 0 3 2 3 5s-1 5-3 5"/></svg>',
 Takeaway:'<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 13H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2"/></svg>',
 Delivery:'<svg viewBox="0 0 24 24"><path d="M3 7h11v10H3V7Zm11 4h4l3 3v3h-7v-6ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>'
};
const LOGO='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><text x="16" y="22" text-anchor="middle">M</text></svg>';
let completionSource=null,previewReturn=false,autoPrintKey='';
function appState(){try{return window.state||state||{}}catch{return window.state||{}}}
function say(message){if(typeof window.toast==='function')window.toast(message)}
function orderFrom(value){let current=value;const seen=new Set();for(let depth=0;depth<5;depth++){if(!current||typeof current!=='object'||seen.has(current))return null;seen.add(current);if(Number(current.id)>0&&current.tokenNumber!=null&&Array.isArray(current.items))return current;current=current.order||current.data?.order||current.result?.order||current.value?.order||null}return null}
function validOrder(value){const order=orderFrom(value);return!!(order&&Number(order.id)>0&&order.tokenNumber!=null&&Array.isArray(order.items)&&order.items.length>0)}
function paid(order){return String(order?.paymentStatus||'').toLowerCase()==='paid'||order?.isPaid===true}
function orderMode(order){const mode=String(order?.orderType||'Takeaway');return ICONS[mode]?mode:'Takeaway'}
function at(value){const date=value?new Date(value):new Date();return Number.isNaN(date.getTime())?String(value||''):date.toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})}
function service(order,mode){
 if(mode==='Dine-in')return{label:'TABLE / WAITER',value:`${order?.tableName||`Table ${order?.tableNumber||'—'}`} · ${order?.waiterName||'—'}`};
 if(mode==='Delivery')return{label:'RIDER / AREA',value:`${order?.riderName||'Rider unassigned'}${order?.deliveryAddress?` · ${order.deliveryAddress}`:''}`};
 return{label:'FULFILMENT',value:'Counter pickup'};
}
function metaCell(label,value){return`<div class="v43-meta-cell"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function delta(lines){return(Array.isArray(lines)?lines:[]).map(line=>{const quantity=Math.max(1,Number(line?.quantity||1)),unitPrice=Number(line?.unitPrice||0);return{variantId:Number(line?.variantId||0),productName:line?.productName||'Item',variantName:line?.variantName||'Regular',quantity,unitPrice,lineTotal:Number(line?.lineTotal??unitPrice*quantity),notes:line?.notes||null}})}
function amount(lines){return delta(lines).reduce((total,line)=>total+Number(line.lineTotal||0),0)}
function lineKey(line){const id=Number(line?.variantId||0),notes=String(line?.notes||'').trim().toLowerCase();return id>0?'v:'+id+'|'+notes:'n:'+String(line?.productName||'').trim().toLowerCase()+'|'+String(line?.variantName||'').trim().toLowerCase()+'|'+notes}
function previousRows(order,result){const rows=new Map();function apply(line,direction){const normalized=delta([line])[0],quantity=Math.max(0,Number(line?.quantity||0));if(!normalized||!quantity)return;const key=lineKey(normalized),current=rows.get(key)||{...normalized,quantity:0};current.quantity=Math.max(0,Number(current.quantity||0)+direction*quantity);current.lineTotal=current.unitPrice*current.quantity;if(current.quantity>0)rows.set(key,current);else rows.delete(key)};(Array.isArray(order?.items)?order.items:[]).forEach(line=>apply(line,1));(Array.isArray(result?.additions)?result.additions:[]).forEach(line=>apply(line,-1));(Array.isArray(result?.cancellations)?result.cancellations:[]).forEach(line=>apply(line,1));return[...rows.values()]}
function previousSummaryHtml(order,result,previous){const rows=previousRows(order,result),units=rows.reduce((total,row)=>total+Number(row.quantity||0),0),preview=rows.slice(0,2).map(row=>Number(row.quantity||0)+'× '+esc(row.productName)).join(' · '),more=rows.length>2?' · +'+(rows.length-2)+' more item line'+(rows.length-2===1?'':'s'):'';return'<section class="v62-previous-summary"><div class="v62-section-title"><b>PREVIOUS BILL — SHORT VIEW</b><small>Before this edit</small></div><div class="v62-previous-preview">'+(preview||'Previous item detail unavailable')+more+'</div><div class="v62-previous-totals"><span>'+rows.length+' item line'+(rows.length===1?'':'s')+' · '+units+' total qty</span><b>'+money(previous)+'</b></div></section>'}
function itemRows(lines,cancelled){
 const rows=delta(lines);
 if(!rows.length)return'<div class="v62-none">None</div>';
 return rows.map(item=>{const note=String(item.notes||'').trim();return`<div class="tp-item v43-item-row ${cancelled?'v62-cancelled-row':'v62-added-row'}"><span class="v43-qty">${cancelled?'-':'+'}${item.quantity}</span><div class="v43-item-name"><b>${esc(item.productName)}</b><small>${esc(item.variantName)} · ${money(item.unitPrice)} each${note?` · ${esc(note)}`:''} <em>${cancelled?'CANCELLED / REMOVED':'NEWLY ADDED'}</em></small></div><strong class="v43-third v43-amount">${cancelled?'- ':''}${money(item.lineTotal)}</strong></div>`}).join('');
}
function updatedReceiptHtml(order,result){
 order=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(order))return'';
 const additions=result?.additions||[],cancellations=result?.cancellations||[];
 const previous=Number(result?.previousTotal??order?.total??0),updated=Number(result?.updatedTotal??order?.total??0);
 const previousView=previousSummaryHtml(order,result,previous);
 const added=amount(additions),removed=amount(cancellations),adjustment=updated-previous-added+removed;
 const mode=orderMode(order),info=service(order,mode),token=order?.tokenNumber??'—';
 const adjustmentLine=Math.abs(adjustment)>.005?`<div class="tp-line"><span>DISCOUNT / OTHER ADJUSTMENT</span><b>${adjustment<0?'- ':'+ '}${money(Math.abs(adjustment))}</b></div>`:'';
 return (window.mnahelsV63?.cleanHtml||String)(`<article class="tp tp-customer v43-receipt v62-updated-receipt ${paid(order)?'paid':'unpaid'}" data-receipt-kind="order-update" data-order-mode="${esc(mode)}"><header class="tp-head v43-dark-head"><div class="v43-brand"><div class="v43-brand-line"><span class="v43-brand-logo">${LOGO}</span><b>MNAHEL'S CAFE</b></div><small>THE WORLD OF TASTE</small></div><div class="v43-mode"><span class="v43-mode-icon">${ICONS[mode]}</span><b>${esc(mode.toUpperCase())}</b></div><div class="v43-seal">${paid(order)?'<strong>UPDATED PAID</strong><small>CUSTOMER COPY</small>':'<strong>PAYMENT DUE</strong><small>UPDATED UNPAID</small>'}</div></header><div class="v43-body"><div class="v43-meta-grid">${metaCell('ORDER',`MC-${token}`)}${metaCell('UPDATED AT',at(result?.amendedAt))}${metaCell('CUSTOMER',order?.customerName||'Walk-in customer')}${metaCell(info.label,info.value)}</div><div class="v62-update-banner"><b>ORDER UPDATE</b><small>Only changes made to the booked order</small></div>${previousView}<section class="v62-change-section additions ${additions.length?'':'v62-empty-section'}"><div class="v62-section-title"><b>NEWLY ADDED ITEMS</b><small>${additions.length?'Added during this update':'No new items added'}</small></div><div class="v43-items"><div class="tp-th"><span>QTY</span><span>ITEM</span><b>AMOUNT</b></div>${itemRows(additions,false)}</div></section><section class="v62-change-section cancellations ${cancellations.length?'':'v62-empty-section'}"><div class="v62-section-title"><b>CANCELLED / REMOVED ITEMS</b><small>${cancellations.length?'Removed during this update':'No items removed'}</small></div><div class="v43-items"><div class="tp-th"><span>QTY</span><span>ITEM</span><b>IMPACT</b></div>${itemRows(cancellations,true)}</div></section><div class="v43-summary v62-summary"><div class="tp-line"><span>PREVIOUS ORDER</span><b>${money(previous)}</b></div><div class="tp-line v62-plus"><span>NEWLY ADDED ITEMS</span><b>+ ${money(added)}</b></div><div class="tp-line v62-minus"><span>CANCELLED / REMOVED ITEMS</span><b>- ${money(removed)}</b></div>${adjustmentLine}<div class="tp-total"><span>FINAL ORDER TOTAL</span><b>${money(updated)}</b></div></div><div class="v62-payment-state ${paid(order)?'paid':'unpaid'}"><b>${paid(order)?'PAID':'PAYMENT DUE'}</b><span>${paid(order)?'Updated paid receipt':'Updated unpaid bill · collect full payment later'}</span></div><footer class="tp-foot v41-footer"><strong>UPDATED ORDER</strong><span>Previous bill + additions - removals = final total</span><b>A product by eastern cross technology</b><small>www.easterncrosstech.com</small></footer></div></article>`);/*v63-clean*/
}
function normalReceiptHtml(order,type){
 order=orderFrom(order)||orderFrom(appState().lastOrder);if(!validOrder(order))return'';
 if(window.mnahelsV43?.receiptHtml)return window.mnahelsV43.receiptHtml(order,type==='kitchen'?'kitchen':paid(order)?'paid':'unpaid');
 return'';
}
function receiptHtml(order,type,result){return result&&type==='customer'?updatedReceiptHtml(order,result):normalReceiptHtml(order,type)}
function stage(html,type){
 const sheet=q('#print-sheet');
 if(!sheet||!String(html||'').trim())return null;
 sheet.removeAttribute('style');
 sheet.className=`print-sheet tp-sheet ${type==='kitchen'?'kitchen':'customer'} v62-print`;
 sheet.innerHTML=html;
 return sheet;
}
function bridgePrint(type){
 if(!(window.__mnahelsDualPrintBridge&&window.chrome?.webview?.postMessage)){try{window.print()}catch{}return Promise.resolve(true)}
 return new Promise(resolve=>{
  let finished=false;
  const done=`mnahels-print-${type}-done`,cancelled=`mnahels-print-${type}-cancelled`;
  const handler=event=>{const message=String(event?.data||'');if(message!==done&&message!==cancelled)return;finished=true;try{window.chrome.webview.removeEventListener('message',handler)}catch{}resolve(message===done)};
  try{window.chrome.webview.addEventListener('message',handler);window.chrome.webview.postMessage(`mnahels-print-${type}`)}catch{resolve(false);return}
  setTimeout(()=>{if(!finished){try{window.chrome.webview.removeEventListener('message',handler)}catch{}resolve(true)}},20000);
 });
}
async function printHtml(html,type,quiet=false){if(window.mnahelsV64)return window.mnahelsV64.printHtml(html,type);
 const sheet=stage(html,type);if(!sheet){if(!quiet)say('Receipt content load nahi hua.');return false}
 await sleep(180);
 const receiptText=String(sheet.textContent||'').replace(/\s+/g,' ').trim();if(receiptText.length<20||!/\bMC-\d+\b/i.test(receiptText)){if(!quiet)say('Receipt data khali hai — order dobara load karein.');return false}
 const ok=await bridgePrint(type);if(!ok&&!quiet)say('Receipt print cancel ho gayi.');return ok;
}
async function printUpdatedReceipt(order,result,automatic=false){
 order=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(order)||!result)return false;if(automatic&&window.mnahelsV64&&!result?.__v58Printing)return window.mnahelsV64.once(window.mnahelsV64.amendmentKey(order,result)+':customer',()=>printUpdatedReceipt(order,{...result,__v58Printing:true},true));
 const key=`${order.id||order.tokenNumber}:${result.amendedAt||''}:${result.updatedTotal}`;
 if(automatic&&autoPrintKey===key)return true;
 if(automatic)autoPrintKey=key;
 return printHtml(updatedReceiptHtml(order,result),'customer',automatic);
}
function showPreview(html){
 const dialog=q('#receipt-preview'),body=q('#receipt-preview-body');if(!dialog||!body){say('Receipt preview nahi mili.');return}
 const success=q('#success-dialog');previewReturn=!!success?.open;if(previewReturn)success.close();
 body.innerHTML=html;dialog.dataset.v62Receipt='1';if(!dialog.open)dialog.showModal();
}
function closePreview(){
 const dialog=q('#receipt-preview');if(!dialog?.dataset.v62Receipt)return false;
 delete dialog.dataset.v62Receipt;if(dialog.open)dialog.close();
 if(previewReturn&&appState().lastOrder){const success=q('#success-dialog');if(success&&!success.open)success.showModal()}
 previewReturn=false;return true;
}
function installCompletionHook(){
 const feature=window.mnahelsV58,original=feature?.completeRunningOrder;
 if(typeof original!=='function'||original===completionSource||original.__v62Receipt)return;
 const wrapped=async function(order,result){const resolved=orderFrom(order)||orderFrom(result)||orderFrom(appState().lastOrder);if(!validOrder(resolved)){say('Order update ho gaya lekin receipt data load nahi hua.');return false}const value=await original.call(this,resolved,result);try{await printUpdatedReceipt(resolved,result,true)}catch(error){console.warn('[v62 updated receipt]',error)}return value};
 wrapped.__v62Receipt=true;completionSource=wrapped;feature.completeRunningOrder=wrapped;
}
function stampBuild(){
 document.documentElement.dataset.v62Revision=REV;
 const meta=q('meta[name="application-version"]');if(meta)meta.content=BUILD;
 qa('.side-bottom *,.server-state *,.sidebar small,.sidebar b,.sidebar strong,.sidebar span,#v46-chip *').forEach(element=>{if(element.children.length)return;const raw=String(element.textContent||'').trim();if(!/^v?\d+\.\d+\.\d+$/.test(raw))return;element.textContent=(raw.startsWith('v')?'v':'')+BUILD});
}
function currentReceipt(type){const state=appState(),order=orderFrom(state.lastOrder)||orderFrom(state.v56EditingOrder),result=state.v58RunningResult;if(order&&state.lastOrder!==order)state.lastOrder=order;return{order,result:type==='customer'?result:null,html:order?receiptHtml(order,type,type==='customer'?result:null):''}}
document.addEventListener('click',event=>{
 const target=event.target?.closest?.('#preview-customer,#print-customer,#preview-kitchen,#print-kitchen,#close-preview,#new-order');if(!target)return;
 if(target.id==='new-order'){setTimeout(()=>{const state=appState();state.v58RunningResult=null;autoPrintKey=''},0);return}
 if(target.id==='close-preview'&&q('#receipt-preview')?.dataset.v62Receipt){event.preventDefault();event.stopImmediatePropagation();closePreview();return}
 const preview=target.id.startsWith('preview-'),type=target.id.endsWith('kitchen')?'kitchen':'customer',current=currentReceipt(type);
 if(!current.order||!current.html)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(preview)showPreview(current.html);else printHtml(current.html,type,false);
},true);
function boot(){installCompletionHook();stampBuild()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,250);setTimeout(boot,900);setInterval(()=>{if(document.visibilityState==='visible')boot()},2500);
window.mnahelsV62={build:BUILD,uiRevision:REV,orderFrom,validOrder,updatedReceiptHtml,normalReceiptHtml,receiptHtml,printHtml,printUpdatedReceipt,installCompletionHook};
})();
