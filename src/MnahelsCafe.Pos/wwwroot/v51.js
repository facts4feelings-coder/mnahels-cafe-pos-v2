/*
 * Mnahel's Cafe POS · v0.15.29 deal photos and pizza extra-topping workflow
 * Copyright (c) 2026 TechMint Software Solutions. All rights reserved.
 */
(()=>{
'use strict';
const BUILD='0.15.29',REV='20260901-deals-toppings-29';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const cash=value=>`Rs ${Math.round(Number(value||0)).toLocaleString('en-PK')}`;
let cartHook=null,totalsHook=null,productsHook=null,apiHook=null;
function allProducts(){return(state?.menu||[]).flatMap(category=>(category.products||[]).map(product=>({category,product})))}
function toppingProduct(){return allProducts().find(x=>String(x.product.name).toLowerCase()==='extra topping')?.product||null}
function pizzaIds(){const category=(state?.menu||[]).find(x=>String(x.name).toLowerCase()==='pizza');return new Set((category?.products||[]).flatMap(product=>(product.variants||[]).map(variant=>Number(variant.id))))}
function isPizza(item){return pizzaIds().has(Number(item?.variantId))}
function sizeName(value){const key=String(value||'').trim().toLowerCase().replace(/[^a-z]/g,'');return({s:'Small',small:'Small',m:'Medium',medium:'Medium',l:'Large',large:'Large',xl:'Extra Large',extralarge:'Extra Large'})[key]||null}
function toppingFor(item){const name=sizeName(item?.variant),product=toppingProduct();if(!name||!product)return null;const variant=(product.variants||[]).find(x=>String(x.name).toLowerCase()===name.toLowerCase());return variant?{variantId:Number(variant.id),name:variant.name,price:Number(variant.price||0)}:null}
function toppingPrice(item){const topping=toppingFor(item);return item?.extraTopping&&topping?topping.price:0}
function subtotal(){return(state?.cart||[]).reduce((sum,item)=>sum+(Number(item.price||0)+toppingPrice(item))*Number(item.quantity||0),0)}
function discountPercent(){return Number(window.mnahelsV39?.discountPercent?.()||0)}
function discountAmount(){const sum=subtotal();return Math.min(sum,Math.round(sum*discountPercent()/100))}
function syncChange(total){const box=q('#v36-change'),input=q('#v36-cash-received');if(!box||!input)return;const got=Number(input.value||0)||0,change=got-total;box.classList.toggle('short',got<total);const label=q('small',box),value=q('strong',box);if(label)label.textContent=got<total?'Remaining':'Change to return';if(value)value.textContent=cash(Math.abs(change))}
function paintTotals(){const sum=subtotal(),discount=discountAmount(),total=sum-discount;const sub=q('#subtotal'),grand=q('#total'),button=q('#button-total'),copy=q('#v39-discount-copy');if(sub)sub.textContent=cash(sum);if(grand)grand.textContent=cash(total);if(button)button.textContent=cash(total);if(copy)copy.textContent=discount?`${cash(discount)} off`:'Percentage';syncChange(total);return total}
function hideStandaloneTopping(){qa('#product-grid .product-card').forEach(card=>{const id=Number(card.dataset.id),entry=allProducts().find(x=>Number(x.product.id)===id);if(String(entry?.product?.name||'').toLowerCase()==='extra topping')card.remove()})}
function decorateCart(){
 const rows=qa('#cart-items>.v37-cart-line');
 rows.forEach((row,index)=>{
  const item=state?.cart?.[index],topping=toppingFor(item);if(!item||!isPizza(item)||!topping)return;
  row.classList.add('v51-pizza-line');
  let button=q('.v51-topping-toggle',row);
  if(!button){button=document.createElement('button');button.type='button';button.className='v51-topping-toggle';button.innerHTML='<span class="v51-switch"><i></i></span><span class="v51-topping-copy"><b>Extra topping</b><small></small></span>';row.append(button)}
  button.classList.toggle('active',!!item.extraTopping);button.setAttribute('aria-pressed',item.extraTopping?'true':'false');button.title=`Extra topping ${topping.name} · ${cash(topping.price)}`;
  const price=q('.v51-topping-copy small',button);if(price)price.textContent=`+${cash(topping.price)}`;
  button.onclick=event=>{event.preventDefault();event.stopPropagation();item.extraTopping=!item.extraTopping;window.renderCart?.()};
  const lineTotal=q('.v37-line-total',row);if(lineTotal)lineTotal.textContent=cash((Number(item.price||0)+toppingPrice(item))*Number(item.quantity||0));
 });
 paintTotals();
}
function hookCart(){const current=window.renderCart;if(typeof current!=='function'||current===cartHook)return;const wrapped=function(){const result=current.apply(this,arguments);decorateCart();return result};wrapped.__v51=true;cartHook=wrapped;window.renderCart=wrapped}
function hookTotals(){const current=window.totals;if(typeof current!=='function'||current===totalsHook)return;const wrapped=function(){const result=current.apply(this,arguments);paintTotals();return result};wrapped.__v51=true;totalsHook=wrapped;window.totals=wrapped}
function hookProducts(){const current=window.renderProducts;if(typeof current!=='function'||current===productsHook)return;const wrapped=function(){const result=current.apply(this,arguments);queueMicrotask(hideStandaloneTopping);return result};wrapped.__v51=true;productsHook=wrapped;window.renderProducts=wrapped}
function expandedItems(items){
 const topping=toppingProduct(),toppingIds=new Set((topping?.variants||[]).map(x=>Number(x.id)));if((items||[]).some(x=>toppingIds.has(Number(x.variantId))))return items;
 const out=[];for(const line of items||[]){out.push(line);const item=(state?.cart||[]).find(x=>Number(x.variantId)===Number(line.variantId));const extra=item?.extraTopping?toppingFor(item):null;if(extra)out.push({variantId:extra.variantId,quantity:Number(line.quantity||item.quantity||1),notes:`For ${item.name} (${item.variant})`})}return out;
}
function hookApi(){const current=window.api;if(typeof current!=='function'||current===apiHook)return;const wrapped=async function(path,options={}){const method=String(options.method||'GET').toUpperCase();if((path==='/api/orders'||path==='/api/orders/book')&&method==='POST'&&options.body){try{const body=JSON.parse(options.body);body.items=expandedItems(body.items);body.discount=discountAmount();options={...options,body:JSON.stringify(body)}}catch(error){console.warn('[v51 topping payload]',error)}}return current(path,options)};wrapped.__v51=true;apiHook=wrapped;window.api=wrapped}
function boot(){document.documentElement.dataset.uiRevision=REV;window.__MNAHELS_UI_REVISION__=REV;hookTotals();hookCart();hookProducts();hookApi();hideStandaloneTopping();decorateCart();paintTotals()}
document.addEventListener('click',event=>{if(event.target.closest?.('.product-card,#cart-items button,#clear-cart'))setTimeout(()=>{hideStandaloneTopping();decorateCart()},0)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,350);setTimeout(boot,1200);setInterval(()=>{if(document.visibilityState==='visible')boot()},4000);
window.mnahelsV51={build:BUILD,uiRevision:REV,subtotal,discountAmount,toppingFor,expandedItems,decorateCart};
})();
