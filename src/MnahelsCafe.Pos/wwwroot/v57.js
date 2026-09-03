/* Mnahel's Cafe POS v0.15.42 — order-start guard and receipt header correction */
(()=>{
'use strict';
const BUILD='0.15.42',UI_REVISION='20260904-order-start-receipt-42';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const currentState=()=>window.state||{};
const orderReady=()=>!!currentState().v38SetupDone||!!currentState().v56EditingOrderId;
function warnStart(){if(typeof window.toast==='function')window.toast('Start order first — pehle New order / F2 se order start karein.');const b=q('#ma-new-order');if(b){b.classList.remove('v57-start-pulse');void b.offsetWidth;b.classList.add('v57-start-pulse');setTimeout(()=>b.classList.remove('v57-start-pulse'),1500)}}
function syncOrderLock(){const locked=!orderReady();document.documentElement.classList.toggle('v57-order-locked',locked);qa('#product-grid .product-card').forEach(card=>{const hint=q('.v38-card-hint',card);if(!hint)return;const title=q('b',hint),copy=q('small',hint);if(locked){title.textContent='Start order first';copy.textContent='New order / F2'}else{const product=(currentState().menu||[]).flatMap(c=>c.products||[]).find(p=>Number(p.id)===Number(card.dataset.id));title.textContent=product?.variants?.length>1?'Choose size':'Add item';copy.textContent='Enter or click'}})}
function wrapAdd(){if(typeof window.add!=='function'||window.add.__v57Guard)return;const original=window.add;const guarded=function(...args){if(!orderReady()){warnStart();return}return original.apply(this,args)};guarded.__v57Guard=true;window.add=guarded}
function wrapReceipts(){const api=window.mnahelsV43;if(!api||api.__v57Address||typeof api.receiptHtml!=='function')return;const original=api.receiptHtml;api.receiptHtml=function(...args){return original.apply(this,args).replace('<small>THE WORLD OF TASTE</small>','<small class="v57-tagline">THE WORLD OF TASTE</small><span class="v57-address">Ada 25/85 Gaggoo Mandi, Lahore Road</span>')};api.__v57Address=true}
document.addEventListener('click',event=>{const card=event.target.closest?.('#product-grid .product-card');if(card&&!orderReady()){event.preventDefault();event.stopImmediatePropagation();warnStart()}},true);
document.addEventListener('keydown',event=>{if(!orderReady()&&(event.key==='Enter'||event.key===' ')&&event.target.closest?.('#product-grid .product-card')){event.preventDefault();event.stopImmediatePropagation();warnStart()}},true);
function boot(){wrapAdd();wrapReceipts();syncOrderLock();document.documentElement.dataset.v57Revision=UI_REVISION}
new MutationObserver(()=>requestAnimationFrame(boot)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',()=>setTimeout(boot,0),true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,500);setInterval(boot,3000);
window.mnahelsV57={build:BUILD,uiRevision:UI_REVISION,orderReady};
})();
