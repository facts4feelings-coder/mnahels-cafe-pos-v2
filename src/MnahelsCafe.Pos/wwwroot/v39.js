/*
 * Mnahel's Cafe POS · v0.15.12 compact five-item cart, percent discount and menu refresh
 * Copyright (c) 2026 TechMint Software Solutions. All rights reserved.
 * A product by TechMint Software Solutions.
 */
(()=>{
'use strict';
const BUILD='0.15.12',UI_REVISION='20260830-menu-12';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=v=>`Rs ${Number(v||0).toLocaleString('en-PK')}`;
const drinkPattern=/water|pepsi|coca|cola|7up|red bull|drink|shake|coffee|margarita/i;
let productsHooked=null,cartHooked=null,totalsHooked=false;
function productById(id){for(const category of state?.menu||[]){const found=(category.products||[]).find(x=>Number(x.id)===Number(id));if(found)return found}return null}
function subtotal(){return (state?.cart||[]).reduce((sum,item)=>sum+Number(item.price||0)*Number(item.quantity||0),0)}
function normalizePercent(value){const source=String(value??'').replace(/[^0-9.]/g,''),parts=source.split('.'),clean=parts.length>1?`${parts.shift()}.${parts.join('').slice(0,2)}`:parts[0],number=Math.max(0,Math.min(100,Number(clean)||0));return Math.round(number*100)/100}
function percentText(value){return Number.isInteger(value)?String(value):String(value.toFixed(2)).replace(/0+$/,'').replace(/\.$/,'')}
function discountPercent(){const input=q('#discount');return normalizePercent(input?.dataset.v39Percent??input?.value??0)}
function discountAmount(){return Math.min(subtotal(),Math.round(subtotal()*discountPercent()/100))}
function updateDiscountCopy(){const pct=discountPercent(),amount=discountAmount(),copy=q('#v39-discount-copy');if(copy)copy.textContent=pct?`${cash(amount)} off`:'Percentage'}
function decorateDiscount(){
 const input=q('#discount');if(!input)return false;input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=6;input.placeholder='0';input.setAttribute('aria-label','Discount percentage');
 const holder=input.closest('.money-input');if(holder){holder.classList.add('v39-percent-input');[...holder.childNodes].filter(x=>x.nodeType===Node.TEXT_NODE).forEach(x=>x.nodeValue='');if(!q('.v39-percent-sign',holder)){const suffix=document.createElement('b');suffix.className='v39-percent-sign';suffix.textContent='%';holder.append(suffix)}}
 const row=holder?.closest('.totals > div');if(row&&!q('#v39-discount-copy',row)){row.classList.add('v39-discount-row');const label=q(':scope > span',row);if(label)label.innerHTML='<b>Discount</b><small id="v39-discount-copy">Percentage</small>'}
 if(!input.dataset.v39Bound){input.dataset.v39Bound='1';if(input.value==='0')input.value='';input.addEventListener('input',()=>{const pct=normalizePercent(input.value);input.value=percentText(pct);input.dataset.v39Percent=String(pct);window.totals();updateDiscountCopy()})}
 if(input.dataset.v39Percent==null)input.dataset.v39Percent=String(normalizePercent(input.value));updateDiscountCopy();return true;
}
function hookTotals(){
 if(totalsHooked||typeof window.totals!=='function')return;totalsHooked=true;const oldTotals=window.totals;
 const wrapped=function(){const input=q('#discount');if(!input)return oldTotals.apply(this,arguments);const raw=String(input.value||'').trim(),pct=raw==='0'&&subtotal()===0?0:normalizePercent(input.dataset.v39Percent??raw),display=percentText(pct),amount=Math.min(subtotal(),Math.round(subtotal()*pct/100));input.dataset.v39Percent=String(pct);input.value=String(amount);const result=oldTotals.apply(this,arguments);input.value=pct?display:'';updateDiscountCopy();return result};wrapped.__v39=true;window.totals=wrapped;
}
function fullVariantList(card,product){
 const list=q('.v38-variant-list',card);if(!list||!product?.variants?.length)return;const selected=Math.max(0,Number(card.dataset.v38VariantIndex||0));list.style.setProperty('--v39-option-count',String(product.variants.length));list.innerHTML=product.variants.map((variant,index)=>`<span role="button" data-v38-variant="${variant.id}" data-v38-option-index="${index}" class="${card.classList.contains('v38-variants-open')&&index===selected?'active':''}"><b>${E(variant.name)}</b><em>${cash(variant.price)}</em></span>`).join('');
}
function decorateMenu(){
 qa('#product-grid .product-card').forEach(card=>{const product=productById(card.dataset.id);if(!product)return;fullVariantList(card,product);if(drinkPattern.test(product.name)){card.classList.add('v39-drink-card');const media=q('.ma-food-media',card);if(media)media.style.backgroundImage="url('/assets/food/drinks.jpg')"}});
}
function decorateCart(){
 qa('#cart-items .v37-cart-line').forEach((row,index)=>{const item=state?.cart?.[index];row.dataset.v39Position=String(index+1);if(item&&drinkPattern.test(item.name)){const image=q('.v37-cart-thumb',row);if(image)image.src='/assets/food/drinks.jpg'}});decorateDiscount();updateDiscountCopy();
}
function hookProducts(){const current=window.renderProducts;if(typeof current!=='function'||current===productsHooked||current.__v39)return;const wrapped=function(){const result=current.apply(this,arguments);requestAnimationFrame(decorateMenu);return result};wrapped.__v39=true;productsHooked=wrapped;window.renderProducts=wrapped;requestAnimationFrame(decorateMenu)}
function hookCart(){const current=window.renderCart;if(typeof current!=='function'||current===cartHooked||current.__v39)return;const wrapped=function(){const result=current.apply(this,arguments);requestAnimationFrame(decorateCart);return result};wrapped.__v39=true;cartHooked=wrapped;window.renderCart=wrapped;requestAnimationFrame(decorateCart)}
function installApiBridge(){
 if(window.__v39PercentBridge||typeof window.api!=='function')return;window.__v39PercentBridge=true;const oldApi=window.api;
 window.api=async function(path,options={}){if(path==='/api/orders'&&String(options.method||'GET').toUpperCase()==='POST'&&options.body){try{const body=JSON.parse(options.body);body.discount=discountAmount();options={...options,body:JSON.stringify(body)}}catch(e){}}return oldApi(path,options)};
}
function boot(){document.documentElement.dataset.uiRevision=UI_REVISION;hookTotals();decorateDiscount();hookProducts();hookCart();installApiBridge();decorateMenu();decorateCart();window.totals?.()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,240));else setTimeout(boot,240);setTimeout(boot,760);setTimeout(boot,1650);
document.addEventListener('click',event=>{if(event.target.closest?.('#cart-items button,#clear-cart,.product-card'))setTimeout(()=>{decorateCart();decorateMenu()},0)},true);
window.mnahelsV39={build:BUILD,uiRevision:UI_REVISION,discountPercent,discountAmount,decorateMenu,decorateCart};
})();
