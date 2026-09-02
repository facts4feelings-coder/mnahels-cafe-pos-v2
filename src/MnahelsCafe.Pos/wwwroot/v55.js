/*
 * Mnahel's Cafe POS · v0.15.35 stability, waiter context and menu rail
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.35',REV='20260902-waiter-menu-print-performance-35';
const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let hubCache={waiters:[],tables:[],riders:[]},hubPromise=null,hubLoadedAt=0,dialogObserver=null,resourceFrame=0;

function syncRole(){
 const role=String((typeof state!=='undefined'&&state?.user?.role)||q('#user-role')?.textContent||'').trim().toLowerCase();
 if(!role)return;
 document.documentElement.dataset.v55Role=role;
 document.documentElement.classList.toggle('v42-cashier',role==='cashier');
 if(role==='cashier')window.mnahelsV42?.syncNavigation?.();
}
function installRoleGuard(){
 syncRole();
 const shell=q('#app-shell'),role=q('#user-role');
 if(shell&&!shell.dataset.v55RoleWatch){shell.dataset.v55RoleWatch='1';new MutationObserver(syncRole).observe(shell,{attributes:true,attributeFilter:['class','hidden']})}
 if(role&&!role.dataset.v55RoleWatch){role.dataset.v55RoleWatch='1';new MutationObserver(syncRole).observe(role,{childList:true,characterData:true,subtree:true})}
}

async function loadHub(force=false){
 const fresh=Date.now()-hubLoadedAt<12000;
 if(!force&&fresh)return hubCache;
 if(hubPromise)return hubPromise;
 hubPromise=(async()=>{
  try{
   const data=typeof window.api==='function'?await window.api('/api/service-hub'):null;
   if(data){hubCache={waiters:data.waiters||[],tables:data.tables||[],riders:data.riders||[]};hubLoadedAt=Date.now()}
  }catch(error){console.warn('[v55 service hub]',error?.message||error)}
  finally{hubPromise=null}
  return hubCache;
 })();
 return hubPromise;
}
function waiterById(id){return hubCache.waiters.find(waiter=>Number(waiter.id)===Number(id))}
function ensureTooltip(dialog){
 let tooltip=q('#v55-waiter-tooltip',dialog);if(tooltip)return tooltip;
 tooltip=document.createElement('aside');tooltip.id='v55-waiter-tooltip';tooltip.className='v55-waiter-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');dialog.appendChild(tooltip);return tooltip;
}
function positionTooltip(button,tooltip){
 const dialog=q('#v38-order-setup'),rect=button.getBoundingClientRect(),host=dialog?.getBoundingClientRect();if(!host)return;
 const width=Math.min(270,host.width-24),left=Math.max(12,Math.min(host.width-width-12,rect.left-host.left+rect.width/2-width/2));
 let top=rect.bottom-host.top+9;if(host.top+top+190>window.innerHeight)top=Math.max(12,rect.top-host.top-199);
 tooltip.style.left=`${Math.round(left)}px`;tooltip.style.top=`${Math.round(top)}px`;tooltip.style.width=`${Math.round(width)}px`;
}
function showWaiterTooltip(button){
 const dialog=q('#v38-order-setup');if(!dialog?.open)return;
 const waiter=waiterById(button.dataset.id),assignments=Array.isArray(waiter?.assignments)?waiter.assignments:[];
 if(!assignments.length)return;
 const tooltip=ensureTooltip(dialog),shown=assignments.slice(0,3);
 tooltip.innerHTML=`<header><span>Booked tables</span><b>${escapeHtml(waiter.name||'Waiter')}</b></header><div>${shown.map(item=>`<p><strong>MC-${escapeHtml(item.tokenNumber??'—')}</strong><span>${escapeHtml(item.tableName||`Table ${item.tableId??'—'}`)}</span></p>`).join('')}</div>${assignments.length>shown.length?`<small>+${assignments.length-shown.length} aur active table</small>`:'<small>Hover details · live from Service Hub</small>'}`;
 tooltip.hidden=false;button.setAttribute('aria-describedby',tooltip.id);positionTooltip(button,tooltip);
}
function hideWaiterTooltip(button){const dialog=q('#v38-order-setup'),tooltip=dialog&&q('#v55-waiter-tooltip',dialog);if(tooltip)tooltip.hidden=true;if(button)button.removeAttribute('aria-describedby')}
function decorateResources(){
 const dialog=q('#v38-order-setup');if(!dialog)return;
 qa('[data-v38-resource="table"]',dialog).forEach(button=>{
  const booked=button.disabled&&!button.classList.contains('selected');button.classList.toggle('v55-table-booked',booked);
  if(booked){const small=q('small',button);if(small&&!/BOOKED/i.test(small.textContent))small.textContent=`BOOKED · ${small.textContent}`}
 });
 qa('[data-v38-resource="waiter"]',dialog).forEach(button=>{
  const waiter=waiterById(button.dataset.id),count=Array.isArray(waiter?.assignments)?waiter.assignments.length:0;
  button.classList.toggle('v55-waiter-busy',count>0);button.dataset.v55Assignments=String(count);
  if(count)button.title=`${waiter.name||'Waiter'} · ${count} active table${count===1?'':'s'} · hover for order details`;else button.removeAttribute('aria-describedby');
 });
}
function scheduleResourceDecorate(){if(resourceFrame)return;resourceFrame=requestAnimationFrame(async()=>{resourceFrame=0;await loadHub(false);decorateResources()})}
function watchOrderDialog(){
 const dialog=q('#v38-order-setup');if(!dialog||dialog.dataset.v55Observed)return;dialog.dataset.v55Observed='1';
 dialogObserver=new MutationObserver(scheduleResourceDecorate);dialogObserver.observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});scheduleResourceDecorate();
}

function patchReceiptCredit(){
 const receipt=window.mnahelsV43;if(!receipt||typeof receipt.receiptHtml!=='function'||receipt.receiptHtml.__v55Credit)return;
 const original=receipt.receiptHtml;
 const wrapped=function(){
  const html=original.apply(this,arguments);
  return String(html).replace(/<b>A product by Eastern Cross Technology<\/b>/g,'<b>Powered by: www.easterncrosstech.com</b><small class="v55-owner-credit">A product by Eastern Cross Technology</small>').replace(/<b>TechMint(?: Software)? Solutions?<\/b>/gi,'<b>Powered by: www.easterncrosstech.com</b><small class="v55-owner-credit">A product by Eastern Cross Technology</small>');
 };
 wrapped.__v55Credit=true;receipt.receiptHtml=wrapped;
}

function installDownloadGuard(){
 const proto=window.HTMLAnchorElement?.prototype;if(!proto||proto.click.__v55Guard)return;
 const original=proto.click,seen=new Set();let manualUntil=0;
 document.addEventListener('click',event=>{if(event.target.closest?.('#v45-preview-download,#v45-v31-download,#v45-settings-download,.v45-download'))manualUntil=Date.now()+4000},true);
 const guarded=function(){
  const fileName=String(this.download||''),isSlip=/mnahels-.*-slip\.jpe?g$/i.test(fileName)&&String(this.href||'').startsWith('blob:');
  if(isSlip&&Date.now()>manualUntil){
   const source=q('#print-sheet'),receiptText=String(source?.textContent||'').replace(/\s+/g,' ').trim(),key=`${fileName}|${receiptText}`;
   if(seen.has(key)){try{URL.revokeObjectURL(this.href)}catch{}return}
   seen.add(key);if(seen.size>500){const first=seen.values().next().value;if(first)seen.delete(first)}
  }
  return original.apply(this,arguments);
 };
 guarded.__v55Guard=true;proto.click=guarded;
}

function performanceMode(){
 document.documentElement.classList.add('v55-performance','v55-menu-rail');
 if(!window.__v55CoalescedOperations&&window.mnahelsV36){
  window.__v55CoalescedOperations=true;
  ['renderOperations','refreshHub'].forEach(name=>{
   const original=window.mnahelsV36[name];if(typeof original!=='function')return;
   let running=null,queued=false,lastArgs=[];
   window.mnahelsV36[name]=function(){lastArgs=[...arguments];if(running){queued=true;return running}running=Promise.resolve(original.apply(this,lastArgs)).finally(()=>{running=null;if(queued){queued=false;queueMicrotask(()=>window.mnahelsV36[name](...lastArgs))}});return running};
  });
 }
}
function boot(){
 document.documentElement.dataset.uiRevision=REV;window.__MNAHELS_UI_REVISION__=REV;
 installRoleGuard();patchReceiptCredit();installDownloadGuard();performanceMode();watchOrderDialog();syncRole();
}

document.addEventListener('pointerover',event=>{const button=event.target.closest?.('[data-v38-resource="waiter"].v55-waiter-busy');if(button&&!button.contains(event.relatedTarget))showWaiterTooltip(button)},true);
document.addEventListener('pointerout',event=>{const button=event.target.closest?.('[data-v38-resource="waiter"].v55-waiter-busy');if(button&&!button.contains(event.relatedTarget))hideWaiterTooltip(button)},true);
document.addEventListener('focusin',event=>{const button=event.target.closest?.('[data-v38-resource="waiter"].v55-waiter-busy');if(button)showWaiterTooltip(button)},true);
document.addEventListener('focusout',event=>{const button=event.target.closest?.('[data-v38-resource="waiter"].v55-waiter-busy');if(button)hideWaiterTooltip(button)},true);
document.addEventListener('click',event=>{
 if(event.target.closest?.('[data-v38-mode="Dine-in"],#ma-new-order,[data-v38-edit]')){loadHub(true).then(scheduleResourceDecorate)}
 if(event.target.closest?.('#place-order')){document.documentElement.classList.add('v55-order-placed');setTimeout(()=>loadHub(true),450)}
},true);
window.addEventListener('resize',()=>{const button=q('[data-v38-resource="waiter"][aria-describedby="v55-waiter-tooltip"]'),tooltip=q('#v55-waiter-tooltip');if(button&&tooltip&&!tooltip.hidden)positionTooltip(button,tooltip)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();setTimeout(boot,180);setTimeout(boot,700);setTimeout(()=>{boot();loadHub(false).then(scheduleResourceDecorate)},1500);
window.mnahelsV55={build:BUILD,uiRevision:REV,syncRole,loadHub,decorateResources,patchReceiptCredit};
})();
