/* Mnahel's Cafe POS v0.15.44 · order-start, audit, logo and print fixes */
(function(){
'use strict';
const BUILD='0.15.44',UI_REVISION='20260904-order-audit-brand-print-44';
const q=(selector,root=document)=>root.querySelector(selector),qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let logBusy=false,logSignature='',manualDownloadBudget=0;
const downloadSeen=new Map();

function appState(){
 try{if(typeof state!=='undefined'&&state){window.state=state;return state}}catch{}
 return window.state||{};
}
function orderReady(){const s=appState();return !!s.v38SetupDone||!!s.v56EditingOrderId}
function syncOrderStart(){
 const ready=orderReady();
 document.documentElement.classList.toggle('v57-order-locked',!ready);
 document.documentElement.classList.toggle('v59-order-ready',ready);
 if(ready){
  qa('#product-grid .product-card').forEach(card=>{const hint=q('.v38-card-hint',card);if(!hint)return;const title=q('b',hint),copy=q('small',hint);if(title&&title.textContent==='Start order first')title.textContent=card.querySelectorAll('[data-v38-variant]').length?'Choose size':'Add item';if(copy)copy.textContent='Enter or click'});
 }
}
function focusSelectedResource(clicked){
 const dialog=q('#v38-order-setup');if(!dialog||!clicked)return;
 const kind=clicked.dataset.v38Resource;
 const selected=q(`[data-v38-resource="${kind}"].selected`,dialog)||clicked;
 qa(`[data-v38-resource="${kind}"]`,dialog).forEach(button=>button.classList.toggle('v59-resource-focus',button===selected));
 try{selected.focus({preventScroll:true})}catch{selected.focus()}
}

async function loadHdLogo(){
 if(document.documentElement.classList.contains('v59-logo-ready'))return;
 try{
  const response=await fetch(`/assets/brand/mnahels-logo-v44.b64?v=${UI_REVISION}`,{cache:'force-cache'});
  if(!response.ok)throw Error('logo');
  const data=(await response.text()).replace(/\s+/g,'');
  if(data.length<1000)throw Error('logo');
  document.documentElement.style.setProperty('--mnahels-brand-logo',`url("data:image/png;base64,${data}")`);
  document.documentElement.classList.add('v56-logo-ready','v59-logo-ready');
 }catch(error){console.warn('[v59 logo]',error)}
}

function installPrintDedupe(){
 if(window.__v59PrintDedupe)return;window.__v59PrintDedupe=true;
 const original=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){
  const filename=String(this.download||'');
  if(!/\.(?:jpe?g|png)$/i.test(filename))return original.apply(this,arguments);
  if(manualDownloadBudget>0){manualDownloadBudget--;return original.apply(this,arguments)}
  const sheet=q('#print-sheet'),text=String(sheet?.textContent||'').replace(/\s+/g,' ').trim();
  const token=text.match(/MC[-\s]?\d+/i)?.[0]?.replace(/\s+/g,'')||'preview';
  const kind=q('[data-receipt-kind]',sheet)?.dataset.receiptKind||(/kitchen/i.test(filename)?'kitchen':'customer');
  const key=`${token}:${kind}:${filename.replace(/\d{8,}/g,'stamp')}`.toLowerCase();
  const now=Date.now(),last=downloadSeen.get(key)||0;
  if(now-last<8000)return;
  downloadSeen.set(key,now);
  for(const [entry,at] of downloadSeen)if(now-at>30000)downloadSeen.delete(entry);
  return original.apply(this,arguments);
 };
}

function ensureOrderLog(){
 const screen=q('#screen-shift');if(!screen||q('#v59-order-audit',screen))return;
 const history=q('#v46-history',screen)?.closest('article.panel');
 const panel=document.createElement('article');panel.id='v59-order-audit';panel.className='panel v59-order-audit';
 panel.innerHTML=`<div class="v59-order-head"><div><p class="eyebrow dark">ORDER SUMMARY & AUDIT</p><h3>Shift order log</h3><small>Who started, completed, cancelled or edited each order.</small></div><button id="v59-log-refresh" type="button">Refresh</button></div><div id="v59-order-metrics" class="v59-order-metrics"></div><div class="v59-order-grid"><section><div class="v59-section-title"><b>User summary</b><span>Orders and edits by operator</span></div><div id="v59-user-log" class="v46-table"></div></section><section><div class="v59-section-title"><b>Order activity</b><span>Latest 80 actions</span></div><div id="v59-event-log" class="v46-table"></div></section></div>`;
 if(history)history.before(panel);else screen.append(panel);
 q('#v59-log-refresh').onclick=()=>loadOrderLog(true);
}
function badge(role){const name=String(role||'Staff');return`<span class="v46-role ${name.toLowerCase()==='admin'?'admin':'cashier'}">${esc(name.toUpperCase())}</span>`}
function localTime(value){if(!value)return'—';return new Date(value).toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function renderOrderLog(data){
 ensureOrderLog();
 const metrics=q('#v59-order-metrics'),users=q('#v59-user-log'),events=q('#v59-event-log');if(!metrics||!users||!events)return;
 if(!data?.open){metrics.innerHTML='<div class="v59-closed">Start shift to begin the order log.</div>';users.innerHTML=events.innerHTML='<div class="empty">No open shift.</div>';return}
 const values=[['All orders',data.totalOrders,'all'],['Successful',data.successfulOrders,'success'],['Active',data.activeOrders,'active'],['Cancelled',data.cancelledOrders,'cancel'],['Edited',data.editedOrders,'edit']];
 metrics.innerHTML=values.map(([label,value,tone])=>`<div data-tone="${tone}"><small>${label}</small><b>${Number(value||0).toLocaleString('en-PK')}</b></div>`).join('');
 const userRows=Array.isArray(data.users)?data.users:[];
 users.innerHTML=userRows.length?`<table><thead><tr><th>User</th><th>Started</th><th>Successful</th><th>Edits</th><th>Cancelled</th></tr></thead><tbody>${userRows.map(row=>`<tr><td><b>${esc(row.name)}</b>${badge(row.role)}</td><td>${row.ordersStarted}</td><td>${row.successful}</td><td>${row.edits}</td><td>${row.cancelled}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No order activity yet.</div>';
 const eventRows=Array.isArray(data.events)?data.events:[];
 events.innerHTML=eventRows.length?`<table><thead><tr><th>Time</th><th>Order</th><th>Action</th><th>User</th><th>Details</th></tr></thead><tbody>${eventRows.map(row=>`<tr><td>${localTime(row.at)}</td><td><b>MC-${esc(row.tokenNumber)}</b></td><td><span class="v59-action ${esc(String(row.action).toLowerCase())}">${esc(row.action)}</span></td><td>${esc(row.actor)}${badge(row.role)}</td><td title="${esc(row.details)}">${esc(row.details)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No order activity yet.</div>';
}
async function loadOrderLog(force=false){
 ensureOrderLog();const s=appState();if(!s.user||logBusy)return;
 logBusy=true;
 try{
  const data=typeof window.api==='function'?await window.api('/api/shifts/current/order-log'):await fetch('/api/shifts/current/order-log',{credentials:'same-origin'}).then(r=>r.json());
  const signature=JSON.stringify(data);if(force||signature!==logSignature){logSignature=signature;renderOrderLog(data)}
 }catch(error){if(force&&typeof toast==='function')toast(error.message||'Order log could not load.')}finally{logBusy=false}
}

function version(){document.documentElement.dataset.v59Revision=UI_REVISION;window.__MNAHELS_UI_REVISION__=UI_REVISION;const meta=q('meta[name="application-version"]');if(meta)meta.content=BUILD;document.title=`Mnahel's Cafe POS · v${BUILD}`}
function refresh(){appState();syncOrderStart();loadHdLogo();installPrintDedupe();ensureOrderLog();if(q('#screen-shift.active'))loadOrderLog()}

document.addEventListener('click',event=>{
 const manual=event.target.closest?.('#v45-download-customer,#v45-download-kitchen,#v31-download,#v31-download-jpg,[data-v45-download],[data-download-receipt]');
 if(manual)manualDownloadBudget=/both/i.test(manual.textContent||'')?2:1;
 const resource=event.target.closest?.('[data-v38-resource]');if(resource)requestAnimationFrame(()=>focusSelectedResource(resource));
 if(event.target.closest?.('[data-v38-start],#ma-new-order'))setTimeout(refresh,0);
 if(event.target.closest?.('[data-screen="shift"],#v46-chip'))setTimeout(()=>loadOrderLog(true),120);
 if(event.target.closest?.('#place-order,[data-v36-status],[data-v35-status],[data-v35-cancel],[data-v56-edit-order],[data-v58-edit-order]'))setTimeout(()=>loadOrderLog(true),900);
},true);
document.addEventListener('keydown',event=>{if(event.key==='F2')setTimeout(refresh,0)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{version();refresh()},{once:true});else{version();refresh()}
setTimeout(refresh,450);setTimeout(refresh,1400);setInterval(()=>{if(document.visibilityState==='visible')refresh()},5000);
window.mnahelsV59={build:BUILD,uiRevision:UI_REVISION,orderReady,refresh,loadOrderLog};
})();