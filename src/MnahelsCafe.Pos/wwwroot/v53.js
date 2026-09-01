/*
 * Mnahel's Cafe POS · v0.15.31 operations stability and close-shift polish
 * Copyright (c) 2026 TechMint Software Solutions. All rights reserved.
 */
(()=>{
'use strict';
const BUILD='0.15.31',REV='20260901-operations-splash-31';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=v=>`Rs ${Math.round(Number(v||0)).toLocaleString('en-PK')}`;
let salesBusy=false,salesTimer=0,lastSalesSignature='';
function compactOrderCards(){
 qa('#admin-orders .v36-order-card').forEach(card=>{
  const note=q(':scope>.v36-order-note',card)||q('.v53-order-strips>.v36-order-note',card);
  const payment=q(':scope>.v41-order-payment',card)||q('.v53-order-strips>.v41-order-payment',card);
  if(!note&&!payment)return;
  let wrap=q(':scope>.v53-order-strips',card);
  if(!wrap){wrap=document.createElement('div');wrap.className='v53-order-strips';const progress=q(':scope>.v36-progress',card);progress?card.insertBefore(wrap,progress):card.append(wrap)}
  if(note&&note.parentElement!==wrap)wrap.append(note);
  if(payment&&payment.parentElement!==wrap)wrap.append(payment);
  wrap.classList.toggle('without-note',!note);
 });
}
function fixShiftClose(){
 const dialog=q('#v46-close-dialog'),password=q('#v46-password'),override=q('#v46-override-wrap');if(!dialog||!password)return;
 const label=password.closest('label'),admin=String(state?.user?.role||'').toLowerCase()==='admin';
 if(label){const node=[...label.childNodes].find(x=>x.nodeType===Node.TEXT_NODE);if(node)node.nodeValue=admin?'Admin password / PIN':'Cashier password / PIN';}
 password.placeholder=admin?'Enter admin password':'Enter cashier password';password.autocomplete='current-password';
 if(override){override.hidden=true;override.style.display='none';const field=q('#v46-override',override);if(field){field.required=false;field.value=''}}
 dialog.dataset.v53Role=admin?'admin':'cashier';
}
function range(){return q('#report-ranges [data-report-range].active')?.dataset.reportRange||'month'}
function period(value){const now=new Date(),day=(d)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()),endToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);if(value==='today')return{start:day(now),end:endToday};if(value==='yesterday'){const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);return{start,end:day(now)}}if(value==='week')return{start:new Date(now.getFullYear(),now.getMonth(),now.getDate()-6),end:endToday};if(value==='year')return{start:new Date(now.getFullYear(),now.getMonth()-11,1),end:new Date(now.getFullYear(),now.getMonth()+1,1)};if(value==='custom'){const from=q('#report-from')?.value,to=q('#report-to')?.value;if(from&&to)return{start:new Date(from+'T00:00:00'),end:new Date(new Date(to+'T00:00:00').getTime()+86400000)}}return{start:new Date(now.getFullYear(),now.getMonth(),now.getDate()-29),end:endToday}}
function bucketModel(value,start,end){const out=[];if(value==='today'||value==='yesterday'){for(let h=0;h<24;h+=2)out.push({key:h,label:String(h).padStart(2,'0'),value:0})}else if(value==='year'){for(let i=0;i<12;i++){const d=new Date(start.getFullYear(),start.getMonth()+i,1);out.push({key:`${d.getFullYear()}-${d.getMonth()}`,label:d.toLocaleDateString('en-PK',{month:'short'}),value:0})}}else{const days=Math.max(1,Math.round((end-start)/86400000));for(let i=0;i<days;i++){const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);out.push({key:d.toISOString().slice(0,10),label:String(d.getDate()),value:0})}}return out}
function assignBars(bars,value,orders){const map=new Map(bars.map(x=>[x.key,x]));for(const order of orders){const d=new Date(order.createdAt);const key=value==='today'||value==='yesterday'?Math.floor(d.getHours()/2)*2:value==='year'?`${d.getFullYear()}-${d.getMonth()}`:new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString().slice(0,10);if(map.has(key))map.get(key).value+=Number(order.total||0)}return bars}
function short(v){const n=Number(v||0);return n>=1000000?`${(n/1000000).toFixed(n>=10000000?0:1)}M`:n>=1000?`${(n/1000).toFixed(n>=10000?0:1)}K`:String(Math.round(n))}
function stableState(signature,count){const chart=q('#one-chart'),labels=qa('#one-metrics>.metric small').map(x=>x.textContent.trim()).join('|');return chart?.dataset.v53Signature===signature&&qa('.v53-col',chart).length===count&&labels==='Paid sales|Paid orders|Booked active|Outstanding|Cash sales'}
async function stabilizeSales(force=false){
 if(state?.currentScreen!=='sales'||salesBusy||typeof window.api!=='function')return;salesBusy=true;
 try{
  const value=range(),{start,end}=period(value),all=await window.api('/api/orders?take=10000'),windowRows=(all||[]).filter(o=>{const d=new Date(o.createdAt);return d>=start&&d<end&&o.status!=='Cancelled'}),paid=windowRows.filter(o=>String(o.paymentStatus||'').toLowerCase()==='paid'),active=windowRows.filter(o=>String(o.paymentStatus||'').toLowerCase()!=='paid'&&!['Completed','Cancelled'].includes(o.status)),outstanding=active.reduce((n,o)=>n+Number(o.total||0),0),paidSales=paid.reduce((n,o)=>n+Number(o.total||0),0),cashSales=paid.filter(o=>o.paymentMethod==='Cash').reduce((n,o)=>n+Number(o.total||0),0),bars=assignBars(bucketModel(value,start,end),value,paid),signature=`${value}|${start.toISOString()}|${end.toISOString()}|${paid.map(o=>`${o.id}:${o.total}:${o.paymentStatus}`).join(',')}|${active.map(o=>`${o.id}:${o.total}`).join(',')}`;
  if(!force&&signature===lastSalesSignature&&stableState(signature,bars.length))return;
  lastSalesSignature=signature;
  const metrics=q('#one-metrics');if(metrics){metrics.innerHTML=[['Paid sales',cash(paidSales),'green'],['Paid orders',paid.length,'green'],['Booked active',active.length,'amber'],['Outstanding',cash(outstanding),'orange'],['Cash sales',cash(cashSales),'neutral']].map(([label,amount,tone])=>`<article class="metric v53-metric-${tone}"><small>${label}</small><strong>${amount}</strong></article>`).join('');metrics.dataset.v53Stable='1'}
  const chart=q('#one-chart'),max=Math.max(1,...bars.map(x=>x.value));if(chart){chart.className='one-chart v53-stable-chart';chart.dataset.v53Signature=signature;chart.dataset.dense=bars.length>14?'1':'0';chart.style.removeProperty('--count');chart.innerHTML=bars.map(x=>{const height=Math.max(x.value?10:2,Math.round(x.value/max*168));return`<div class="v53-col" title="${esc(x.label)}: ${cash(x.value)}"><b>${x.value?short(x.value):''}</b><i style="height:${height}px"></i><span>${esc(x.label)}</span></div>`}).join('')}
  const title=q('#one-trend-title');if(title)title.textContent=value==='today'?'Today by hour':value==='yesterday'?'Yesterday by hour':value==='week'?'Last 7 days':value==='year'?'Last 12 months':value==='custom'?'Custom period':'Last 30 days';
 }catch(error){console.warn('[v53 sales]',error?.message||error)}finally{salesBusy=false}
}
function scheduleSales(force=false,delay=80){clearTimeout(salesTimer);salesTimer=setTimeout(()=>stabilizeSales(force),delay)}
function observe(){if(document.documentElement.dataset.v53Observed)return;document.documentElement.dataset.v53Observed='1';new MutationObserver(records=>{let cards=false,sales=false,shift=false;for(const record of records){const target=record.target;if(target.closest?.('#admin-orders')||target.id==='admin-orders')cards=true;if(target.closest?.('#one-chart,#one-metrics')||target.id==='one-chart'||target.id==='one-metrics')sales=true;if(target.closest?.('#v46-close-dialog')||target.id==='v46-close-dialog')shift=true}if(cards)requestAnimationFrame(compactOrderCards);if(sales)scheduleSales(false,120);if(shift)requestAnimationFrame(fixShiftClose)}).observe(document.body,{childList:true,subtree:true})}
function boot(){document.documentElement.dataset.uiRevision=REV;window.__MNAHELS_UI_REVISION__=REV;compactOrderCards();fixShiftClose();observe();if(state?.currentScreen==='sales')scheduleSales(true,120)}
document.addEventListener('click',event=>{if(event.target.closest?.('#v46-close'))setTimeout(fixShiftClose,0);if(event.target.closest?.('#report-ranges [data-report-range],#apply-custom-report')){scheduleSales(true,180);setTimeout(()=>scheduleSales(true,0),850)}if(event.target.closest?.('[data-screen="sales"]'))setTimeout(()=>scheduleSales(true,0),350)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,400);setTimeout(boot,1300);setInterval(()=>{if(document.visibilityState==='visible'){compactOrderCards();fixShiftClose();if(state?.currentScreen==='sales')scheduleSales(false,0)}},2200);
window.mnahelsV53={build:BUILD,uiRevision:REV,compactOrderCards,fixShiftClose,stabilizeSales};
})();
