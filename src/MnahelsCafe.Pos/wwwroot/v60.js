/*
 * Mnahel's Cafe POS · v0.15.47 prominent order editing and reliable edit loading
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.47',REV='20260905-order-edit-console-47';
const ACTIVE=new Set(['New','Confirmed','Preparing','Ready']);
const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let orders=new Map(),listBusy=false,lastList=0,openBusy=false,pending=0;
function appState(){try{if(typeof state!=='undefined'&&state){window.state=state;return state}}catch{}return window.state||{}}
function say(message){if(typeof window.toast==='function')window.toast(message)}

async function request(path,options){
 const target=path.startsWith('/api')?path:`/api${path.startsWith('/')?'':'/'}${path}`;
 if(typeof window.api==='function')return window.api(target,options||{});
 const response=await fetch(target,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...(options||{})});
 if(!response.ok){let message=`${response.status} ${response.statusText}`;try{const body=await response.json();if(body&&body.message)message=body.message}catch{}throw new Error(message)}
 return response.status===204?null:response.json();
}

function menuIndex(){
 const products=(appState().menu||[]).flatMap(category=>(category.products||[]).map(product=>({...product})));
 const variants=products.flatMap(product=>(product.variants||[]).map(variant=>({...variant,productId:product.id,productName:product.name})));
 return {products,variants};
}
function mapCart(order){
 const {products,variants}=menuIndex();
 return (order.items||[]).map(item=>{
  const wanted=Number(item.variantId||0);
  const variant=variants.find(value=>wanted&&Number(value.id)===wanted)||
   variants.find(value=>String(value.name||'').toLowerCase()===String(item.variantName||'').toLowerCase()&&
    String(value.productName||'').toLowerCase()===String(item.productName||'').toLowerCase());
  const quantity=Math.max(1,Number(item.quantity||1));
  const price=Number((variant&&variant.price)||item.unitPrice||0);
  const productName=(variant&&variant.productName)||item.productName||'Item';
  const variantName=(variant&&variant.name)||item.variantName||'Regular';
  const product=variant?products.find(value=>Number(value.id)===Number(variant.productId)):null;
  return {
   variantId:Number((variant&&variant.id)||item.variantId||0),
   productId:Number((product&&product.id)||0),
   productName,name:productName,variantName,variant:variantName,
   quantity,originalQuantity:quantity,
   unitPrice:price,price,lineTotal:price*quantity,notes:item.notes||null
  };
 }).filter(line=>line.variantId>0);
}

function banner(order){
 const existing=q('#v56-edit-banner');if(existing)existing.remove();
 const panel=q('#screen-pos .cart-panel');if(!panel)return;
 const box=document.createElement('div');
 box.id='v56-edit-banner';box.className='v56-edit-banner v60-edit-banner';
 box.innerHTML=`<div><small>RUNNING ORDER · EDIT MODE</small><strong>MC-${esc(order.tokenNumber)} · ${esc(order.customerName||'Walk-in customer')}</strong></div><button type="button">Cancel edit</button>`;
 box.querySelector('button').addEventListener('click',()=>{
  if(window.mnahelsV56&&typeof window.mnahelsV56.clearEditForm==='function')window.mnahelsV56.clearEditForm();
  const current=appState();current.cart=[];current.v56EditingOrderId=null;current.v56EditingOrder=null;
  document.documentElement.classList.remove('v60-editing-order');
  const existingBanner=q('#v56-edit-banner');if(existingBanner)existingBanner.remove();
  if(typeof window.renderCart==='function')window.renderCart();
  say('Order edit cancel ho gaya.');
 });
 panel.prepend(box);
}
function showPos(){
 if(typeof window.showScreen==='function'){window.showScreen('pos');return}
 if(typeof window.navigate==='function'){window.navigate('pos');return}
 qa('.screen').forEach(node=>node.classList.remove('active'));
 const screen=q('#screen-pos');if(screen)screen.classList.add('active');
 qa('.nav-item').forEach(node=>node.classList.toggle('active',node.dataset.screen==='pos'));
}
function applyEdit(order){
 const cart=mapCart(order);
 if(!cart.length)throw new Error('Is order ke items live menu mein nahi mile, is liye cart open nahi ho saka.');
 const current=appState();
 current.cart=cart;
 current.orderType=order.orderType||'Takeaway';
 current.paymentMethod=order.paymentMethod||'Cash';
 current.payment=order.paymentMethod||'Cash';
 current.v56EditingOrderId=Number(order.id);
 current.v56EditingOrder=order;
 current.v56EditServiceContext={serviceMode:order.serviceMode,serviceAssignmentId:order.serviceAssignmentId};
 current.v38SetupDone=true;
 current.tableId=order.tableId||null;
 current.tableNumber=order.tableNumber||order.tableId||null;
 current.waiterId=order.waiterId||null;
 current.riderId=order.riderId||null;
 const note=q('#order-note');if(note)note.value=order.notes||'';
 const discount=q('#discount');if(discount)discount.value=Number(order.discount||0);
 qa('[data-order-type]').forEach(button=>button.classList.toggle('active',button.dataset.orderType===current.orderType));
 qa('[data-payment]').forEach(button=>button.classList.toggle('active',button.dataset.payment===current.paymentMethod));
 document.documentElement.classList.add('v56-editing-order','v35-booking-active','v60-editing-order');
 const screen=q('#screen-pos');
 if(screen)screen.classList.add('v56-editing-order','v35-booking-open','v38-ready');
 showPos();
 if(typeof window.renderCart==='function')window.renderCart();
 banner(order);
 const label=q('#place-order span');if(label)label.textContent='Update order';
 if(window.mnahelsV58&&typeof window.mnahelsV58.decoratePartialCancellation==='function')window.mnahelsV58.decoratePartialCancellation();
 if(window.mnahelsV59&&typeof window.mnahelsV59.refresh==='function')window.mnahelsV59.refresh();
 setTimeout(()=>{const panel=q('#screen-pos .cart-panel');if(panel&&panel.scrollIntoView)panel.scrollIntoView({behavior:'smooth',block:'nearest'})},90);
 say(`MC-${order.tokenNumber} cart mein open hai · items add ya cancel karke Update order dabayen.`);
}

function index(list){orders=new Map((list||[]).map(order=>[String(order.id),order]))}
async function loadList(){
 const rows=await request('/orders?take=200');
 index(Array.isArray(rows)?rows:(rows&&rows.items)||[]);
}
async function openEdit(id){
 const numeric=Number(id||0);
 if(!numeric){say('Order pehchana nahi gaya, list refresh karein.');return}
 if(openBusy)return;
 openBusy=true;
 let order=null,problem='';
 try{order=await request(`/orders/${numeric}/edit`)}
 catch(error){problem=(error&&error.message)||'edit endpoint unavailable'}
 if(!order||!Array.isArray(order.items)||!order.items.length){
  if(!orders.has(String(numeric))){try{await loadList()}catch(error){problem=problem||(error&&error.message)||''}}
  const fallback=orders.get(String(numeric));
  if(fallback)order=fallback;
 }
 try{
  if(!order)throw new Error(problem?`Order data nahi mila (${problem}).`:'Order data nahi mila.');
  applyEdit(order);
  if(problem)console.warn('[v60 edit fallback]',problem);
 }
 catch(error){say((error&&error.message)||'Order cart mein open nahi ho saka.')}
 finally{openBusy=false}
}

function canEdit(order){return ACTIVE.has(order.status)&&order.status!=='Cancelled'&&String(order.paymentStatus||'')!=='Paid'}
function decorate(){
 qa('.v56-operation-actions').forEach(node=>node.remove());
 qa('#admin-orders .v36-order-card,#orders-list .order-card').forEach(row=>{
  const id=row.dataset.id||q('[data-v36-cancel]',row)?.dataset.v36Cancel||q('[data-cancel]',row)?.dataset.cancel;
  const order=orders.get(String(id||''));
  if(!order)return;
  const host=q('.v36-card-actions',row)||q('.order-actions',row);
  if(!host)return;
  let button=q('.v60-edit',host);
  if(!canEdit(order)){if(button)button.remove();return}
  if(!button){
   button=document.createElement('button');
   button.type='button';
   button.className='v60-edit';
   button.innerHTML='<span aria-hidden="true">✎</span><b>Edit order</b>';
   host.prepend(button);
  }
  button.dataset.v60Edit=String(order.id);
  button.title=`MC-${order.tokenNumber} ko cart mein open karein`;
 });
}
function schedule(){if(pending)return;pending=setTimeout(()=>{pending=0;decorate()},140)}
async function refresh(force){
 const visible=q('#screen-admin')?.classList.contains('active')||q('#screen-orders')?.classList.contains('active');
 if(!visible||document.hidden)return;
 if(!appState().user)return;
 if(!force&&Date.now()-lastList<8000){decorate();return}
 if(listBusy)return;
 listBusy=true;lastList=Date.now();
 try{await loadList();decorate()}
 catch(error){console.warn('[v60 orders]',error)}
 finally{listBusy=false}
}
function version(){
 document.documentElement.dataset.v60Revision=REV;
 const meta=q('meta[name="application-version"]');if(meta)meta.content=BUILD;
 document.title=`Mnahel's Cafe POS · v${BUILD}`;
}

document.addEventListener('click',event=>{
 const trigger=event.target.closest?.('[data-v60-edit]');
 if(trigger){event.preventDefault();event.stopImmediatePropagation();openEdit(trigger.dataset.v60Edit);return}
 const legacy=event.target.closest?.('[data-op="edit"]');
 if(legacy){
  event.preventDefault();event.stopImmediatePropagation();
  const row=legacy.closest('.v36-order-card,.order-card,.order-row');
  openEdit((row&&row.dataset.id)||0);
  return;
 }
 if(event.target.closest?.('[data-screen="admin"],[data-screen="orders"],#refresh-orders'))setTimeout(()=>refresh(true),160);
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{version();refresh(true)},{once:true});
else{version();refresh(true)}
setTimeout(()=>refresh(true),900);setTimeout(()=>refresh(true),2100);
setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},4000);
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.mnahelsV60={build:BUILD,uiRevision:REV,openEdit,refresh,decorate};
})();
