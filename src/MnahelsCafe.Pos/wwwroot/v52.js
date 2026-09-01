/*
 * Mnahel's Cafe POS · v0.15.30 visible pizza/deal extra-topping checkbox
 * Copyright (c) 2026 TechMint Software Solutions. All rights reserved.
 */
(()=>{
'use strict';
const BUILD='0.15.30',REV='20260901-topping-checkbox-30';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const cash=value=>`Rs ${Math.round(Number(value||0)).toLocaleString('en-PK')}`;
let cartHook=null,totalsHook=null,productsHook=null,apiHook=null;
function entries(){return(state?.menu||[]).flatMap(category=>(category.products||[]).map(product=>({category,product})))}
function itemEntry(item){const id=Number(item?.variantId);return entries().find(({product})=>(product.variants||[]).some(variant=>Number(variant.id)===id))||entries().find(({product})=>String(product.name)===String(item?.name))||null}
function toppingProduct(){return entries().find(({product})=>String(product.name).trim().toLowerCase()==='extra topping')?.product||null}
function normalizedSize(value){const key=String(value||'').trim().toLowerCase().replace(/[^a-z]/g,'');return({s:'Small',small:'Small',m:'Medium',medium:'Medium',l:'Large',large:'Large',xl:'Extra Large',extralarge:'Extra Large'})[key]||null}
function sizeFromDeal(description){const text=String(description||'').toLowerCase();if(/extra\s*large|\bxl\b/.test(text))return'Extra Large';if(/medium\s+pizza/.test(text))return'Medium';if(/large(?:\s+special)?\s+pizza/.test(text))return'Large';if(/small\s+pizza/.test(text))return'Small';return null}
function modifierContext(item){const entry=itemEntry(item);if(!entry)return null;const category=String(entry.category?.name||'').trim().toLowerCase();if(category==='pizza')return{size:normalizedSize(item.variant),kind:'pizza',product:entry.product};if(category==='deals'&&/pizza/i.test(String(entry.product?.description||''))){const size=sizeFromDeal(entry.product.description);return size?{size,kind:'deal',product:entry.product}:null}return null}
function toppingFor(item){const context=modifierContext(item),product=toppingProduct();if(!context||!product)return null;const variant=(product.variants||[]).find(x=>String(x.name).trim().toLowerCase()===context.size.toLowerCase());return variant?{variantId:Number(variant.id),name:variant.name,price:Number(variant.price||0),context}:null}
function toppingPrice(item){const topping=toppingFor(item);return item?.extraTopping&&topping?topping.price:0}
function subtotal(){return(state?.cart||[]).reduce((sum,item)=>sum+(Number(item.price||0)+toppingPrice(item))*Number(item.quantity||0),0)}
function discountPercent(){return Number(window.mnahelsV39?.discountPercent?.()||0)}
function discountAmount(){const sum=subtotal();return Math.min(sum,Math.round(sum*discountPercent()/100))}
function syncChange(total){const box=q('#v36-change'),input=q('#v36-cash-received');if(!box||!input)return;const got=Number(input.value||0)||0,change=got-total;box.classList.toggle('short',got<total);const label=q('small',box),value=q('strong',box);if(label)label.textContent=got<total?'Remaining':'Change to return';if(value)value.textContent=cash(Math.abs(change))}
function paintTotals(){const sum=subtotal(),discount=discountAmount(),total=sum-discount;const sub=q('#subtotal'),grand=q('#total'),button=q('#button-total'),copy=q('#v39-discount-copy');if(sub)sub.textContent=cash(sum);if(grand)grand.textContent=cash(total);if(button)button.textContent=cash(total);if(copy)copy.textContent=discount?`${cash(discount)} off`:'Percentage';syncChange(total);return total}
function hideStandaloneTopping(){qa('#product-grid .product-card').forEach(card=>{const id=Number(card.dataset.id),entry=entries().find(({product})=>Number(product.id)===id);if(String(entry?.product?.name||'').trim().toLowerCase()==='extra topping')card.remove()})}
function checkboxFor(row,item,topping){
 row.classList.add('v52-topping-line');q('.v51-topping-toggle',row)?.remove();
 let label=q('.v52-topping-check',row);if(!label){label=document.createElement('label');label.className='v52-topping-check';label.innerHTML='<span class="v52-topping-heading">Extra topping</span><span class="v52-check-row"><input type="checkbox" aria-label="Add extra topping"><b></b></span>';const qty=q(':scope>.qty',row);qty?row.insertBefore(label,qty):row.append(label)}
 const input=q('input',label),price=q('b',label);input.checked=!!item.extraTopping;price.textContent=`+${cash(topping.price)}`;label.classList.toggle('active',input.checked);label.title=`${topping.context.kind==='deal'?'Deal pizza':'Pizza'} ${topping.name} extra topping · ${cash(topping.price)}`;
 input.onchange=event=>{event.stopPropagation();item.extraTopping=event.currentTarget.checked;window.renderCart?.()};label.onclick=event=>event.stopPropagation();
}
function decorateCart(){qa('#cart-items>.v37-cart-line').forEach((row,index)=>{const item=state?.cart?.[index],topping=toppingFor(item);if(!item||!topping)return;checkboxFor(row,item,topping);const lineTotal=q('.v37-line-total',row);if(lineTotal)lineTotal.textContent=cash((Number(item.price||0)+toppingPrice(item))*Number(item.quantity||0))});paintTotals()}
function hookCart(){const current=window.renderCart;if(typeof current!=='function'||current===cartHook)return;const wrapped=function(){const result=current.apply(this,arguments);decorateCart();return result};wrapped.__v52=true;cartHook=wrapped;window.renderCart=wrapped}
function hookTotals(){const current=window.totals;if(typeof current!=='function'||current===totalsHook)return;const wrapped=function(){const result=current.apply(this,arguments);paintTotals();return result};wrapped.__v52=true;totalsHook=wrapped;window.totals=wrapped}
function hookProducts(){const current=window.renderProducts;if(typeof current!=='function'||current===productsHook)return;const wrapped=function(){const result=current.apply(this,arguments);queueMicrotask(hideStandaloneTopping);return result};wrapped.__v52=true;productsHook=wrapped;window.renderProducts=wrapped}
function expandedItems(items){const topping=toppingProduct(),toppingIds=new Set((topping?.variants||[]).map(x=>Number(x.id)));if((items||[]).some(x=>toppingIds.has(Number(x.variantId))))return items;const out=[];for(const line of items||[]){out.push(line);const item=(state?.cart||[]).find(x=>Number(x.variantId)===Number(line.variantId)),extra=item?.extraTopping?toppingFor(item):null;if(extra){const subject=extra.context.kind==='deal'?`${item.name} pizza`:`${item.name}`;out.push({variantId:extra.variantId,quantity:Number(line.quantity||item.quantity||1),notes:`For ${subject} (${extra.context.size})`})}}return out}
function hookApi(){const current=window.api;if(typeof current!=='function'||current===apiHook)return;const wrapped=async function(path,options={}){const method=String(options.method||'GET').toUpperCase();if((path==='/api/orders'||path==='/api/orders/book')&&method==='POST'&&options.body){try{const body=JSON.parse(options.body);body.items=expandedItems(body.items);body.discount=discountAmount();options={...options,body:JSON.stringify(body)}}catch(error){console.warn('[v52 topping payload]',error)}}return current(path,options)};wrapped.__v52=true;apiHook=wrapped;window.api=wrapped}
function boot(){document.documentElement.dataset.uiRevision=REV;window.__MNAHELS_UI_REVISION__=REV;hookTotals();hookCart();hookProducts();hookApi();hideStandaloneTopping();decorateCart();paintTotals()}
document.addEventListener('click',event=>{if(event.target.closest?.('.product-card,#cart-items button,#clear-cart'))setTimeout(()=>{hideStandaloneTopping();decorateCart()},0)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,250);setTimeout(boot,900);setInterval(()=>{if(document.visibilityState==='visible')boot()},3500);
window.mnahelsV52={build:BUILD,uiRevision:REV,subtotal,discountAmount,toppingFor,modifierContext,expandedItems,decorateCart};
})();
