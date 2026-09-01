/*
 * Mnahel's Cafe POS · v0.15.10 stable dashboard and Midnight Amber cart
 * Copyright (c) 2026 TechMint Software Solutions. All rights reserved.
 */
(()=>{
'use strict';
window.__v37Dashboard=true;
const BUILD='0.15.10',UI_REVISION='20260830-launch-10';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const bag='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 13H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
const food=name=>{const s=String(name||'');if(/pizza|supreme|fajita|lover|crust|tikka/i.test(s))return'/assets/food/pizza.jpg';if(/burger|zinger|tower/i.test(s))return'/assets/food/burger.jpg';if(/wing|nugget|broast|chicken|boti/i.test(s))return'/assets/food/chicken.jpg';if(/fries/i.test(s))return'/assets/food/fries.jpg';if(/sandwich|club/i.test(s))return'/assets/food/sandwich.jpg';if(/drink|shake|coffee|margarita|juice/i.test(s))return'/assets/food/drinks.jpg';if(/cake|dessert|brownie|cream/i.test(s))return'/assets/food/dessert.jpg';return'/assets/food/pasta.jpg'};
let previousCart=new Map(),cartHooked=false,recovering=false;
function decorateHeader(){const head=q('#screen-pos .cart-head');if(!head)return;if(!q('.v37-cart-bag',head)){const icon=document.createElement('span');icon.className='v37-cart-bag';icon.innerHTML=bag;head.prepend(icon)}const title=q('h3',head);if(title&&!title.dataset.v38Locked)title.textContent='Current order'}
function decorateCart(){
 const box=q('#cart-items');if(!box)return;decorateHeader();const rows=qa(':scope > .cart-line',box),next=new Map();
 rows.forEach((row,index)=>{const item=state?.cart?.[index];if(!item)return;const key=String(item.variantId??index);next.set(key,Number(item.quantity||0));row.classList.add('v37-cart-line');row.dataset.variantId=key;
  let thumb=q('.v37-cart-thumb',row);if(!thumb){thumb=document.createElement('img');thumb.className='v37-cart-thumb';thumb.alt='';thumb.decoding='async';row.prepend(thumb)}thumb.src=food(item.name);
  const detail=q(':scope > div',row),qty=detail&&q('.qty',detail),total=q(':scope > b',row),small=detail&&q('small',detail);
  if(total&&small){total.className='v37-line-total';small.append(document.createTextNode(' · '),total)}if(qty&&qty.parentElement!==row)row.append(qty);
  const remove=qty&&q('.remove',qty);if(remove){remove.textContent='Remove';remove.title='Remove item';remove.setAttribute('aria-label','Remove item')}
  const old=previousCart.get(key),changed=old!=null&&old!==Number(item.quantity||0);if(old==null){try{row.animate([{opacity:0,transform:'translateX(18px) scale(.98)'},{opacity:1,transform:'none'}],{duration:330,easing:'cubic-bezier(.16,1,.3,1)'})}catch(e){}}
  else if(changed){const target=q('.qty',row)||row;try{target.animate([{transform:'scale(.88)'},{transform:'scale(1.1)',offset:.55},{transform:'scale(1)'}],{duration:360,easing:'cubic-bezier(.34,1.56,.44,1)'})}catch(e){}}
 });
 previousCart=next;const empty=q('.empty-cart',box);if(empty){empty.classList.add('v37-empty-cart');const icon=q('span',empty);if(icon)icon.innerHTML=bag}
}
function hookCart(){if(cartHooked)return true;if(typeof window.renderCart!=='function')return false;const old=window.renderCart;const wrapped=function(){const result=old.apply(this,arguments);decorateCart();return result};wrapped.__v37=true;window.renderCart=wrapped;cartHooked=true;decorateCart();return true}
function recoverDashboard(){
 const box=q('#admin-orders');if(!box||recovering||typeof state==='undefined'||!state.user||state.user.role!=='Admin'||state.currentScreen!=='admin')return;
 const legacy=q('.mini-order,.recent-order-card,.v34-card,.v35-order-card',box);if(!legacy)return;recovering=true;Promise.resolve(window.mnahelsV36?.renderOperations?.(true)).finally(()=>{recovering=false});
}
function observeDashboard(){const box=q('#admin-orders');if(!box||box.dataset.v37Observed)return;box.dataset.v37Observed='1';new MutationObserver(()=>queueMicrotask(recoverDashboard)).observe(box,{childList:true,subtree:false})}
function boot(){document.documentElement.dataset.uiRevision=UI_REVISION;hookCart();decorateHeader();decorateCart();observeDashboard();recoverDashboard()}
document.addEventListener('click',event=>{const product=event.target.closest?.('.product-card');if(product){product.classList.add('v37-pressed');setTimeout(()=>product.classList.remove('v37-pressed'),220)}if(event.target.closest?.('#clear-cart,#cart-items button'))setTimeout(decorateCart,0)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,500);setTimeout(boot,1300);setInterval(()=>{if(document.visibilityState==='visible'){hookCart();observeDashboard();recoverDashboard()}},5000);
window.mnahelsV37={build:BUILD,uiRevision:UI_REVISION,decorateCart,recoverDashboard};
})();
