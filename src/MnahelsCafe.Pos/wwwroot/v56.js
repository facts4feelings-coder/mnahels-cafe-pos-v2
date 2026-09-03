/*
 * Mnahel's Cafe POS · v0.15.38 booked-order cart editing and printer recovery
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.38',REV='20260903-order-edit-cart-38',AUTO_KEY='mnahels.receipt-auto-jpg';
const q=(selector,root=document)=>root.querySelector(selector),qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const E=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let manualDownloadUntil=0,editingOrder=null,updateBusy=false,ordersBusy=false,ordersLoadedAt=0;
const orderCache=new Map();

function say(message){try{if(typeof toast==='function')toast(message)}catch{}}
function forceManualJpgOnly(){
 try{localStorage.setItem(AUTO_KEY,'0')}catch{}
 const toggle=q('#v45-auto-jpg');
 if(toggle){toggle.checked=false;toggle.disabled=true;const label=toggle.closest('label');if(label){label.classList.add('v56-manual-only');const title=q('b',label),note=q('small',label);if(title)title.textContent='Automatic JPG download off';if(note)note.textContent='Use Download JPG slip only when needed'}}
}
function lockAutoJpgPreference(){
 const proto=window.Storage?.prototype;if(!proto||proto.setItem.__v56ManualOnly)return;
 const original=proto.setItem;
 const wrapped=function(key,value){return original.call(this,key,String(key)===AUTO_KEY?'0':value)};
 wrapped.__v56ManualOnly=true;proto.setItem=wrapped;forceManualJpgOnly();
}
function installSlipDownloadGate(){
 const proto=window.HTMLAnchorElement?.prototype;if(!proto||proto.click.__v56SlipGate)return;
 const previous=proto.click;
 const guarded=function(){
  const name=String(this.download||''),isSlip=/mnahels-.*-slip\.jpe?g$/i.test(name)&&String(this.href||'').startsWith('blob:');
  if(isSlip&&Date.now()>manualDownloadUntil){try{URL.revokeObjectURL(this.href)}catch{}return}
  return previous.apply(this,arguments);
 };
 guarded.__v56SlipGate=true;proto.click=guarded;
}
function markManualDownload(event){
 const button=event.target.closest?.('#v45-preview-download,#v45-v31-download,#v45-settings-download,.v45-download');
 if(button)manualDownloadUntil=Date.now()+5000;
 const autoToggle=event.target.closest?.('#v45-auto-jpg');
 if(autoToggle){event.preventDefault();event.stopImmediatePropagation();forceManualJpgOnly();say('Automatic JPG download off hai. Manual Download JPG button use karein.')}
}
function decoratePrintButton(event){
 const button=event.target.closest?.('#v31-preview [data-pv="print"],#v31-now');if(!button)return;
 forceManualJpgOnly();
 if(button.dataset.v56Printing==='1'){event.preventDefault();event.stopImmediatePropagation();return}
 button.dataset.v56Printing='1';button.classList.add('v56-printing');
 const old=button.textContent;button.textContent='Printing…';
 setTimeout(()=>{button.dataset.v56Printing='0';button.classList.remove('v56-printing');button.textContent=old},2400);
}

function isEditable(order){return order&&order.status!=='Completed'&&order.status!=='Cancelled'&&String(order.paymentStatus||'').toLowerCase()!=='paid'}
async function loadEditableOrders(force=false){
 if(ordersBusy||typeof state==='undefined'||!state?.user||typeof api!=='function')return;
 if(!force&&Date.now()-ordersLoadedAt<4000){decorateOrderCards();return}
 ordersBusy=true;
 try{const rows=await api('/api/orders?take=200');if(Array.isArray(rows)){rows.forEach(order=>orderCache.set(String(order.id),order));ordersLoadedAt=Date.now();decorateOrderCards()}}
 catch(error){console.warn('[v0.15.38 orders]',error?.message||error)}finally{ordersBusy=false}
}
function decorateOrderCards(){
 qa('#admin-orders .v36-order-card').forEach(card=>{
  const order=orderCache.get(String(card.dataset.id)),actions=q('.v36-card-actions',card),existing=q('[data-v56-edit-order]',card);
  if(!actions||!isEditable(order)){existing?.remove();return}
  if(existing)return;
  const button=document.createElement('button');button.type='button';button.className='v56-edit-order';button.dataset.v56EditOrder=String(order.id);button.textContent='Edit order';button.title='Open this booked order in the cart';
  const cancel=q('.v36-cancel',actions);cancel?actions.insertBefore(button,cancel):actions.appendChild(button);
 });
}
function menuMatch(line){
 const wantedProduct=String(line.productName||'').trim().toLowerCase(),wantedVariant=String(line.variantName||'Regular').trim().toLowerCase();
 for(const category of state?.menu||[]){for(const product of category.products||[]){if(String(product.name||'').trim().toLowerCase()!==wantedProduct)continue;const variant=(product.variants||[]).find(item=>String(item.name||'Regular').trim().toLowerCase()===wantedVariant);if(variant)return{variantId:Number(variant.id),name:product.name,variant:variant.name,price:Number(variant.price||0),quantity:Math.max(1,Number(line.quantity||1)),notes:line.notes||null}}}
 return null;
}
function cartFromOrder(order){
 const cart=[],missing=[];
 for(const line of order.items||[]){
  if(String(line.productName||'').trim().toLowerCase()==='extra topping'&&cart.length){cart[cart.length-1].extraTopping=true;continue}
  const item=menuMatch(line);if(item)cart.push(item);else missing.push(`${line.productName} (${line.variantName||'Regular'})`);
 }
 return{cart,missing};
}
function setValue(selector,value){const node=q(selector);if(node)node.value=value??''}
function setOrderMode(mode){qa('#screen-pos [data-order-type]').forEach(button=>button.classList.toggle('active',button.dataset.orderType===mode))}
function setDiscount(order){
 const input=q('#discount');if(!input)return;const percent=Number(order.subtotal||0)>0?Math.max(0,Math.min(100,Number(order.discount||0)/Number(order.subtotal)*100)):0;
 input.dataset.v39Percent=String(Math.round(percent*100)/100);input.value=percent?String(Math.round(percent*100)/100):'';
}
function contextMarkup(order){
 const service=order.orderType==='Dine-in'?`${order.tableName||`Table ${order.tableNumber||'—'}`} · ${order.waiterName||'Waiter'}`:order.orderType==='Delivery'?(order.riderName||'Rider after preparation'):'Counter pickup';
 return `<span class="v56-edit-token">MC-${E(order.tokenNumber)}</span><span><small>EDITING BOOKED ORDER</small><b>${E(order.orderType)} · ${E(service)}</b></span><span><small>CUSTOMER</small><b>${E(order.customerName||'Walk-in customer')}</b></span><button type="button" data-v56-cancel-edit>Cancel edit</button>`;
}
function lockControl(node,locked){
 if(!node)return;if(locked){if(node.dataset.v56WasDisabled==null)node.dataset.v56WasDisabled=node.disabled?'1':'0';node.disabled=true}else{node.disabled=node.dataset.v56WasDisabled==='1';delete node.dataset.v56WasDisabled}
}
function syncEditUi(){
 const active=!!editingOrder;document.documentElement.classList.toggle('v56-editing-order',active);q('#screen-pos')?.classList.toggle('v56-editing-order',active);
 qa('#screen-pos [data-order-type],#screen-pos [data-payment],#v36-table,#v36-waiter,#v36-rider,#v41-pay-now').forEach(node=>lockControl(node,active));
 qa('#customer-name,#customer-phone,#delivery-address').forEach(node=>{if(active){if(node.dataset.v56WasReadOnly==null)node.dataset.v56WasReadOnly=node.readOnly?'1':'0';node.readOnly=true}else{node.readOnly=node.dataset.v56WasReadOnly==='1';delete node.dataset.v56WasReadOnly}});
 const place=q('#place-order'),label=q('#place-order span'),wasActive=place?.dataset.v56Editing==='1';if(place)place.dataset.v56Editing=active?'1':'0';if(label){if(active)label.textContent='Update order';else if(wasActive)label.textContent='Book order'}
 const head=q('#screen-pos .cart-head h3'),eyebrow=q('#screen-pos .cart-head .eyebrow');if(active&&editingOrder){if(head){head.textContent=`MC-${editingOrder.tokenNumber}`;head.dataset.v38Locked='1'}if(eyebrow)eyebrow.textContent='EDIT BOOKED ORDER'}
}
async function beginEdit(id){
 if(updateBusy||typeof api!=='function')return;
 if((state?.cart?.length||state?.v38SetupDone)&&!confirm('Current cart replace karke booked order edit karna hai?'))return;
 try{
  const order=await api(`/api/orders/${id}/edit`);if(!isEditable(order))throw Error(String(order.paymentStatus||'').toLowerCase()==='paid'?'Paid order edit nahi ho sakta. Pehle refund/void workflow required hai.':'Completed ya cancelled order edit nahi ho sakta.');
  const mapped=cartFromOrder(order);if(mapped.missing.length)throw Error(`Ye item current menu mein available nahi: ${mapped.missing.join(', ')}`);
  try{navigate('pos')}catch{q('[data-screen="pos"]')?.click()}
  editingOrder=order;orderCache.set(String(order.id),order);state.cart=mapped.cart;state.orderType=order.orderType;state.tableId=order.tableId||order.tableNumber||null;state.tableNumber=state.tableId;state.waiterId=order.waiterId||null;state.riderId=order.riderId||null;state.v38ProposedToken=order.tokenNumber;state.v38SetupDone=true;state.v56EditingOrderId=order.id;
  const screen=q('#screen-pos');screen?.classList.add('v35-booking-open','v38-ready','v56-editing-order');document.documentElement.classList.add('v35-booking-active','v56-editing-order');
  setValue('#customer-name',order.customerName||'');setValue('#customer-phone',order.customerPhone||'');setValue('#delivery-address',order.deliveryAddress||'');setValue('#order-note',order.notes||'');setDiscount(order);setOrderMode(order.orderType);
  q('#v38-order-context')?.remove();const toolbar=q('#screen-pos .catalog-panel .toolbar');if(toolbar){const bar=document.createElement('section');bar.id='v38-order-context';bar.className='v56-edit-context';bar.innerHTML=contextMarkup(order);toolbar.after(bar)}
  renderCart();window.totals?.();syncEditUi();q('#search')?.focus();say(`MC-${order.tokenNumber} proper cart mein open ho gaya. Items add/remove karke Update order karein.`);
 }catch(error){say(error.message||'Order edit ke liye load nahi hua.')}
}
function clearEditForm(){
 const old=editingOrder;editingOrder=null;if(typeof state!=='undefined'){state.cart=[];state.v38SetupDone=false;state.v56EditingOrderId=null;state.tableId=null;state.tableNumber=null;state.waiterId=null;state.riderId=null}
 q('#v38-order-context')?.remove();const discount=q('#discount');if(discount){discount.value='';discount.dataset.v39Percent='0'}setValue('#order-note','');setValue('#customer-name','');setValue('#customer-phone','');setValue('#delivery-address','');
 document.documentElement.classList.remove('v35-booking-active','v56-editing-order');const screen=q('#screen-pos');screen?.classList.remove('v35-booking-open','v38-ready','v56-editing-order');syncEditUi();const button=q('#place-order');if(button)button.innerHTML='<span>Book order</span><b id="button-total">Rs 0</b>';renderCart();window.totals?.();
 const head=q('#screen-pos .cart-head h3'),eyebrow=q('#screen-pos .cart-head .eyebrow');if(head){head.textContent='Current order';delete head.dataset.v38Locked}if(eyebrow)eyebrow.textContent='CURRENT ORDER';return old;
}
function cancelEdit(){if(!editingOrder)return;if(confirm(`MC-${editingOrder.tokenNumber} ki unsaved changes discard karni hain?`)){const order=clearEditForm();say(`MC-${order?.tokenNumber||''} edit cancelled.`)}}
async function submitUpdate(){
 if(!editingOrder||updateBusy)return;if(!state?.cart?.length)return say('Updated cart empty nahi ho sakta. Kam az kam ek item rakhein.');
 const button=q('#place-order'),old=button?.innerHTML;updateBusy=true;if(button){button.disabled=true;button.innerHTML='<span>Updating order…</span><b>•••</b>'}
 try{
  let items=state.cart.map(item=>({variantId:item.variantId,quantity:item.quantity,notes:item.notes||null}));if(window.mnahelsV52?.expandedItems)items=window.mnahelsV52.expandedItems(items);
  const discount=window.mnahelsV52?.discountAmount?.()??window.mnahelsV39?.discountAmount?.()??0;
  const updated=await api(`/api/orders/${editingOrder.id}`,{method:'PUT',body:JSON.stringify({items,discount,notes:q('#order-note')?.value.trim()||null})});
  orderCache.set(String(updated.id),updated);state.lastOrder=updated;const token=updated.tokenNumber;clearEditForm();state.dashboardSignature='';state.salesSignature='';state.orderSignature='';ordersLoadedAt=0;
  await Promise.allSettled([window.mnahelsV36?.renderOperations?.(true),window.mnahelsV36?.refreshHub?.(true),window.mnahelsV41?.refreshDue?.(true)]);q('.sidebar [data-screen="admin"]')?.click();say(`MC-${token} update ho gaya aur timeline Booked par reset ho gayi.`);
 }catch(error){say(error.message||'Order update nahi hua.')}finally{updateBusy=false;if(button){button.disabled=false;if(editingOrder)button.innerHTML=old||'<span>Update order</span><b id="button-total">Rs 0</b>'}syncEditUi();window.totals?.()}
}
function observeCards(){const box=q('#admin-orders');if(!box||box.dataset.v56EditWatch)return;box.dataset.v56EditWatch='1';new MutationObserver(()=>queueMicrotask(decorateOrderCards)).observe(box,{childList:true,subtree:true});decorateOrderCards()}
function boot(){
 document.documentElement.dataset.uiRevision=REV;window.__MNAHELS_UI_REVISION__=REV;document.documentElement.classList.add('v56-manual-jpg');q('meta[name="application-version"]')?.setAttribute('content',BUILD);
 lockAutoJpgPreference();installSlipDownloadGate();forceManualJpgOnly();observeCards();syncEditUi();if(typeof state!=='undefined'&&state?.user&&state.currentScreen==='admin')loadEditableOrders();
}
document.addEventListener('click',markManualDownload,true);
document.addEventListener('click',decoratePrintButton,true);
document.addEventListener('click',event=>{const edit=event.target.closest?.('[data-v56-edit-order]');if(edit){event.preventDefault();event.stopImmediatePropagation();beginEdit(edit.dataset.v56EditOrder);return}if(event.target.closest?.('[data-v56-cancel-edit]')){event.preventDefault();cancelEdit()}if(event.target.closest?.('[data-screen="admin"]'))setTimeout(()=>loadEditableOrders(true),250)},true);
window.addEventListener('click',event=>{if(!editingOrder)return;if(event.target.closest?.('#place-order')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();submitUpdate();return}if(event.target.closest?.('#ma-new-order')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();cancelEdit()}},true);
window.addEventListener('keydown',event=>{if(editingOrder&&event.key==='F2'){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();say('Pehle current booked order update ya Cancel edit karein.')}},true);
document.addEventListener('mnahels-shared-print-settings-applied',forceManualJpgOnly);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();setTimeout(boot,250);setTimeout(boot,1000);setTimeout(forceManualJpgOnly,2200);
setInterval(()=>{if(document.visibilityState!=='visible')return;observeCards();if(typeof state!=='undefined'&&state?.user&&state.currentScreen==='admin')loadEditableOrders();if(editingOrder)syncEditUi()},2500);
window.mnahelsV56={build:BUILD,uiRevision:REV,forceManualJpgOnly,beginEdit,cancelEdit,submitUpdate,loadEditableOrders};
})();
