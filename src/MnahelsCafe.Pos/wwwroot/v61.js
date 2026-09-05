/* Mnahel's Cafe POS v0.15.48 - shift order log, per-order log and running-order slip rework
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology. */
(function(){
'use strict';
const BUILD='0.15.48',REV='20260905-shift-log-running-slip-48';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'Rs '+Math.round(Number(v||0)).toLocaleString('en-PK');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function appState(){try{if(typeof state!=='undefined'&&state){window.state=state;return state}}catch(e){}return window.state||{}}
function say(m){if(typeof window.toast==='function')window.toast(m)}

const LOGO='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><text x="16" y="22" text-anchor="middle">M</text></svg>';
const ICONS={'Dine-in':'<svg viewBox="0 0 24 24"><path d="M7 3v8m3-8v8M5 3v5c0 2 1 3 3 3s3-1 3-3V3M8 11v10M16 3v18m0-18c2 0 3 2 3 5s-1 5-3 5"/></svg>',Takeaway:'<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 13H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2"/></svg>',Delivery:'<svg viewBox="0 0 24 24"><path d="M3 7h11v10H3V7Zm11 4h4l3 3v3h-7v-6ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>'};
function orderMode(order){const v=String(order&&order.orderType||'Takeaway');return ICONS[v]?v:'Takeaway'}
function placedAt(order){const src=order&&(order.createdAt||order.placedAt);const d=src?new Date(src):new Date();return Number.isNaN(d.getTime())?String(src||''):d.toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})}
function service(order,mode){if(mode==='Dine-in')return{label:'TABLE / WAITER',value:((order&&order.tableName)||('Table '+((order&&order.tableNumber)||'-')))+' - '+((order&&order.waiterName)||'-')};if(mode==='Delivery')return{label:'RIDER / AREA',value:((order&&order.riderName)||'Rider unassigned')+((order&&order.deliveryAddress)?' - '+order.deliveryAddress:'')};return{label:'FULFILMENT',value:'Counter pickup'}}
function metaCell(label,value){return '<div class="v43-meta-cell"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>'}

const KEY=item=>String((item&&item.productName)||'').toLowerCase()+'|'+String((item&&item.variantName)||'Regular').toLowerCase();
function normalize(line){const quantity=Math.max(0,Number((line&&line.quantity)||0)),unitPrice=Number((line&&line.unitPrice)||0);return{variantId:line&&line.variantId,productName:(line&&line.productName)||'Item',variantName:(line&&line.variantName)||'Regular',quantity:quantity,unitPrice:unitPrice,lineTotal:Number(line&&line.lineTotal!=null?line.lineTotal:unitPrice*quantity),notes:(line&&line.notes)||null,cancelledQuantity:0,originalQuantity:quantity}}
function additionRows(lines){return (lines||[]).map(normalize).filter(r=>r.quantity>0)}
function cancellationRows(order,cancellations){
 const rows=(Array.isArray(order&&order.items)?order.items:[]).map(normalize);
 (cancellations||[]).map(normalize).forEach(cancel=>{
  const match=rows.find(row=>KEY(row)===KEY(cancel));
  if(match){match.cancelledQuantity+=cancel.quantity;match.originalQuantity=match.quantity+match.cancelledQuantity;if(!match.unitPrice)match.unitPrice=cancel.unitPrice}
  else{const row=Object.assign({},cancel);row.quantity=0;row.cancelledQuantity=cancel.quantity;row.originalQuantity=cancel.quantity;rows.push(row)}
 });
 return rows.filter(r=>r.originalQuantity>0);
}

function billBlock(previous,updated,cancellation){
 const change=Number(updated)-Number(previous);
 const label=cancellation?'CANCELLED AMOUNT':'CURRENT BILL - NEW ITEMS';
 return '<div class="v61-bill"><div class="v61-bill-row"><span>PREVIOUS TOTAL</span><b>'+money(previous)+'</b></div><div class="v61-bill-row '+(change<0?'v61-minus':'v61-plus')+'"><span>'+label+'</span><b>'+(change<0?'- ':'+ ')+money(Math.abs(change))+'</b></div><div class="v61-bill-row v61-bill-final"><span>FINAL TOTAL</span><b>'+money(updated)+'</b></div></div>';
}
function itemRow(row,cancellation){
 const cancelled=Number(row.cancelledQuantity||0);
 const shown=cancellation?Number(row.originalQuantity||row.quantity||0):row.quantity;
 const amount=cancelled?('- '+money(row.unitPrice*cancelled)):money(row.unitPrice*(cancellation?row.quantity:shown));
 const tag=cancelled?'<em class="v61-cancel-tag">CANCELLED'+(cancelled>1?' x'+cancelled:'')+'</em>':'';
 const note=String(row.notes||'').trim();
 return '<div class="tp-item v43-item-row'+(cancelled?' v61-cancelled-row':'')+'"><span class="v43-qty">'+(cancellation?shown:'+'+shown)+'</span><div class="v43-item-name"><b>'+esc(row.productName)+'</b><small>'+esc(row.variantName)+' - '+money(row.unitPrice)+' each'+(note?' - '+esc(note):'')+' '+tag+'</small></div><strong class="v43-third v43-amount">'+amount+'</strong></div>';
}
function slipHtml(order,lines,type,result){
 const cancellation=String(type)==='cancellation';
 const rows=cancellation?cancellationRows(order,lines):additionRows(lines);
 const title=cancellation?'RUNNING ORDER - CANCELLATION':'RUNNING ORDER';
 const hint=cancellation?'Sirf CANCELLED item hatayein - baqi order jari hai':'Sirf naye item tayar karein - purana order repeat nahi hai';
 const mode=orderMode(order),info=service(order,mode);
 const previous=Number(result&&result.previousTotal!=null?result.previousTotal:((order&&order.total)||0));
 const updated=Number(result&&result.updatedTotal!=null?result.updatedTotal:((order&&order.total)||0));
 const items=rows.map(row=>itemRow(row,cancellation)).join('')||'<div class="v43-empty">No items</div>';
 const token=(order&&order.tokenNumber!=null)?order.tokenNumber:'-';
 const customer=(order&&order.customerName)||'Walk-in customer';
 return '<article class="tp tp-customer v43-receipt kitchen v58-running-slip v61-running-slip '+(cancellation?'v61-cancellation':'v61-addition')+'" data-receipt-kind="'+(cancellation?'running-cancellation':'running-addition')+'" data-order-mode="'+esc(mode)+'"><header class="tp-head v43-dark-head"><div class="v43-brand"><div class="v43-brand-line"><span class="v43-brand-logo">'+LOGO+'</span><b>MNAHEL&#39;S CAFE</b></div><small>THE WORLD OF TASTE</small></div><div class="v43-mode"><span class="v43-mode-icon">'+ICONS[mode]+'</span><b>'+esc(mode.toUpperCase())+'</b></div><div class="v43-seal"><strong>'+(cancellation?'CANCELLED':'RUNNING')+'</strong><small>'+(cancellation?'UPDATE SLIP':'ADD ITEMS')+'</small></div></header><div class="v43-body"><div class="v43-meta-grid">'+metaCell('ORDER','MC-'+token)+metaCell('PLACED AT',placedAt(order))+metaCell('CUSTOMER',customer)+metaCell(info.label,info.value)+'</div><div class="v61-running-banner"><b>'+title+'</b><small>'+hint+'</small></div><div class="v43-items"><div class="tp-th"><span>QTY</span><span>ITEM</span><b>AMOUNT</b></div>'+items+'</div>'+billBlock(previous,updated,cancellation)+'<footer class="tp-foot v41-footer"><strong>'+title+'</strong><span>MC-'+esc(token)+' - '+esc(customer)+'</span></footer></div></article>';
}

function localTime(v){if(!v)return'-';const d=new Date(v);return Number.isNaN(d.getTime())?'-':d.toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function roleBadge(role){const n=String(role||'Staff');return '<span class="v46-role '+(n.toLowerCase()==='admin'?'admin':'cashier')+'">'+esc(n.toUpperCase())+'</span>'}
function grouped(events){
 const map=new Map();
 (events||[]).forEach(e=>{const key=String(e&&e.tokenNumber!=null?e.tokenNumber:'-');if(!map.has(key))map.set(key,[]);map.get(key).push(e)});
 return [...map.entries()].map(entry=>{const sorted=entry[1].slice().sort((a,b)=>new Date(a.at)-new Date(b.at));return{token:entry[0],rows:sorted,last:sorted[sorted.length-1]}}).sort((a,b)=>new Date(b.last.at)-new Date(a.last.at));
}
function perOrderHtml(events){
 const list=grouped(events);
 if(!list.length)return '<div class="empty">No order activity yet.</div>';
 return list.map(group=>{
  const actors=[...new Set(group.rows.map(r=>String((r&&r.actor)||'-')))].join(', ');
  const timeline=group.rows.map(r=>'<li><span class="v61-when">'+localTime(r.at)+'</span><span class="v59-action '+esc(String((r&&r.action)||'').toLowerCase())+'">'+esc(r.action)+'</span><span class="v61-who">'+esc(r.actor)+roleBadge(r.role)+'</span><span class="v61-what">'+esc(r.details)+'</span></li>').join('');
  return '<details class="v61-order-log"><summary><b>MC-'+esc(group.token)+'</b><span>'+esc(actors)+'</span><i>'+group.rows.length+' actions</i><em>'+localTime(group.last.at)+'</em></summary><ol class="v61-order-timeline">'+timeline+'</ol></details>';
 }).join('');
}
function ensureSection(){
 const panel=q('#v59-order-audit');
 if(!panel||q('#v61-per-order',panel))return;
 const section=document.createElement('section');
 section.className='v61-per-order-wrap';
 section.innerHTML='<div class="v59-section-title"><b>Per-order log</b><span>Har order ka apna record - kholne ke liye click karein</span></div><div id="v61-per-order" class="v61-per-order"></div>';
 panel.append(section);
}
function stripDashboardLog(){const panel=q('#v59-dashboard-order-audit');if(panel)panel.remove()}

let busy=false,signature='';
async function loadLog(force){
 const s=appState();
 if(busy||!s.user)return;
 busy=true;
 try{
  const data=typeof window.api==='function'?await window.api('/api/shifts/current/order-log'):await fetch('/api/shifts/current/order-log',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error(r.status+' '+r.statusText);return r.json()});
  const next=JSON.stringify((data&&data.events)||[]);
  if(force||next!==signature){
   signature=next;ensureSection();
   const host=q('#v61-per-order');
   if(host)host.innerHTML=(data&&data.shiftNumber)?perOrderHtml(data.events):'<div class="empty">Start shift to begin the order log.</div>';
  }
 }catch(error){
  const host=q('#v61-per-order');
  if(host&&!host.querySelector('details'))host.innerHTML='<div class="empty">Per-order log load nahi hua ('+esc((error&&error.message)||'error')+'). Refresh dabayen.</div>';
 }finally{busy=false}
}
function refresh(){stripDashboardLog();ensureSection();if(q('#screen-shift.active'))loadLog(false)}

document.addEventListener('click',event=>{
 const target=event.target;
 if(target&&target.closest&&target.closest('[data-screen="shift"],#v46-chip,#v59-log-refresh'))setTimeout(()=>loadLog(true),150);
 if(target&&target.closest&&target.closest('#place-order,[data-v60-edit],[data-op="edit"]'))setTimeout(()=>loadLog(true),900);
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
setTimeout(refresh,600);setTimeout(refresh,1600);
setInterval(()=>{if(document.visibilityState==='visible')refresh()},6000);
document.documentElement.dataset.v61Revision=REV;
window.mnahelsV61={build:BUILD,uiRevision:REV,slipHtml:slipHtml,cancellationRows:cancellationRows,additionRows:additionRows,loadLog:loadLog,refresh:refresh};
})();
