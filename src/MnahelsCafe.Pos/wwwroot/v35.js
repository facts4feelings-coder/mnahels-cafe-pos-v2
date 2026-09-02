/*
 * Mnahel's Cafe POS · v0.15.6 inline booking and order operations
 * Owner: Eastern Cross Technology · https://techmint.org
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
window.__v35Dashboard=true;
const BUILD='0.15.6';
const UI_REVISION='20260830-booking-6';
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=v=>typeof money==='function'?money(v):`Rs ${Number(v||0).toLocaleString('en-PK')}`;
const food=name=>{const s=String(name||'');if(/pizza|supreme|fajita|lover|crust|tikka/i.test(s))return'pizza.jpg';if(/burger|zinger|tower/i.test(s))return'burger.jpg';if(/wing|nugget|broast|chicken|boti/i.test(s))return'chicken.jpg';if(/fries/i.test(s))return'fries.jpg';if(/sandwich|club/i.test(s))return'sandwich.jpg';if(/drink|shake|coffee|margarita|juice/i.test(s))return'drinks.jpg';if(/cake|dessert|brownie|cream|cookie/i.test(s))return'dessert.jpg';return'pasta.jpg'};
const svg=body=>`<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const icons={
 customer:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>'),
 dine:svg('<path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3v18M16 3c4 2 4 8 0 10"/>'),
 takeaway:svg('<path d="M6 8h12l-1 13H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
 delivery:svg('<path d="M3 16h11V7H7L3 11v5Z"/><path d="M14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>'),
 cash:svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>'),
 card:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
 online:svg('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 6h6M10 18h4"/>'),
 staff:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>'),
 print:svg('<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><path d="M17 11h.01"/>'),
 table:svg('<path d="M4 10h16M6 10l-1 11M18 10l1 11M8 6h8v4H8z"/>')
};
const iconFor=value=>{const v=String(value||'').toLowerCase();if(v.includes('dine'))return icons.dine;if(v.includes('deliver'))return icons.delivery;if(v.includes('take'))return icons.takeaway;if(v.includes('card'))return icons.card;if(v.includes('online')||v.includes('bank')||v.includes('wallet'))return icons.online;if(v.includes('cash'))return icons.cash;return icons.staff};
let bookingOpen=false;
let occupiedTables=new Map();
let operationsSignature='';
let operationRows=new Map();
let operationsBusy=false;
let tableBusy=false;

function categoryFit(){const box=q('#categories');if(!box)return;const count=Math.max(1,box.children.length);box.style.setProperty('--v35-category-count',String(count));qa('.category',box).forEach(b=>{b.title=b.textContent.trim()})}

function arrangeCustomerFields(){
 const compact=q('#customer-compact'),footer=q('#screen-pos .cart-footer');if(!compact||!footer)return;
 compact.classList.add('v35-customer');
 const caption=q('.customer-caption',compact);if(caption)caption.innerHTML='<span>Customer details</span><small>Name and phone are optional for walk-in orders</small>';
 const inputs=q('.customer-inputs',compact),name=q('#customer-name')?.closest('label'),phone=q('#customer-phone')?.closest('label');
 if(inputs&&name&&phone){inputs.append(name,phone)}
 if(compact.parentElement!==footer)footer.insertBefore(compact,footer.firstChild);
 const nameInput=q('#customer-name'),phoneInput=q('#customer-phone'),address=q('#delivery-address');
 if(nameInput)nameInput.placeholder='Customer name';
 if(phoneInput)phoneInput.placeholder='03xx xxxxxxx';
 if(address)address.placeholder='House, street, area';
}

function ensureTablePicker(){
 const segment=q('#screen-pos .cart-panel .segment');if(!segment||q('#v35-table-field'))return;
 const box=document.createElement('section');box.id='v35-table-field';box.className='v35-table-field';box.hidden=true;
 box.innerHTML='<div><strong>Select table</strong><small>Required for dine-in · released at Order Complete</small></div><div class="v35-tables">'+[1,2,3,4].map(n=>`<button type="button" data-v35-table="${n}"><span>${icons.table}</span><b>Table ${n}</b><small>Available</small></button>`).join('')+'</div>';
 segment.insertAdjacentElement('afterend',box);
 qa('[data-v35-table]',box).forEach(button=>button.onclick=()=>{
  if(button.disabled)return;
  state.tableNumber=Number(button.dataset.v35Table);
  paintTables();
 });
}

function ensureBookingControls(){
 const head=q('#screen-pos .cart-head');if(head&&!q('#v35-close-booking')){
  const button=document.createElement('button');button.id='v35-close-booking';button.type='button';button.className='v35-close-booking';button.textContent='Close';button.onclick=()=>closeBooking(false);head.appendChild(button);
 }
 const place=q('#place-order');if(place){const label=q('span',place);if(label)label.textContent='Book order';}
 arrangeCustomerFields();ensureTablePicker();
 qa('#screen-pos [data-order-type]').forEach(button=>{
  if(button.dataset.v35Bound)return;button.dataset.v35Bound='1';
  button.addEventListener('click',()=>setTimeout(()=>{syncBookingMode();refreshTables()},0));
 });
 const launch=q('#ma-new-order');if(launch&&!launch.dataset.v35Bound){launch.dataset.v35Bound='1';launch.onclick=e=>{e.preventDefault();if(window.__v38OrderSetup&&window.mnahelsV38?.openSetup)return window.mnahelsV38.openSetup(false);openBooking()}}
}

function syncBookingMode(){
 ensureBookingControls();
 const dine=state.orderType==='Dine-in',delivery=state.orderType==='Delivery';
 const table=q('#v35-table-field'),address=q('#address-field');
 if(table)table.hidden=!dine;
 if(address){address.classList.toggle('hidden',!delivery);address.hidden=!delivery}
 if(!dine)state.tableNumber=null;
 if(!delivery&&q('#delivery-address'))q('#delivery-address').value='';
 paintTables();
}

async function refreshTables(){
 if(tableBusy||!state?.user)return;tableBusy=true;
 try{
  const rows=await api('/api/tables');occupiedTables=new Map((rows||[]).filter(x=>x.occupied).map(x=>[Number(x.number),x]));paintTables();
 }catch(e){console.warn('[v35 tables]',e)}finally{tableBusy=false}
}

function paintTables(){
 qa('[data-v35-table]').forEach(button=>{
  const n=Number(button.dataset.v35Table),occupied=occupiedTables.get(n),selected=state.tableNumber===n;
  button.disabled=!!occupied&&!selected;button.classList.toggle('active',selected);button.classList.toggle('occupied',!!occupied&&!selected);
  const small=q('small',button);if(small)small.textContent=occupied&&!selected?`MC-${occupied.tokenNumber}`:selected?'Selected':'Available';
 });
}

function openBooking(){
 ensureBookingControls();
 if(state.currentScreen!=='pos'){try{navigate('pos')}catch(e){q('[data-screen="pos"]')?.click()}}
 bookingOpen=true;state.tableNumber=state.tableNumber||null;
 const screen=q('#screen-pos');if(screen)screen.classList.add('v35-booking-open');document.documentElement.classList.add('v35-booking-active');
 const wizard=q('#order-wizard');if(wizard?.open)wizard.close();
 syncBookingMode();refreshTables();
 requestAnimationFrame(()=>{const input=q('#search');if(input){input.focus();try{input.select()}catch(e){}}});
}

function closeBooking(clear=false){
 bookingOpen=false;q('#screen-pos')?.classList.remove('v35-booking-open');document.documentElement.classList.remove('v35-booking-active');
 if(clear){state.tableNumber=null;paintTables()}
}

function validateBooking(){
 if(!bookingOpen)return true;
 if(state.orderType==='Dine-in'){
  if(!state.tableNumber){toast('Dine-in order ke liye Table 1, 2, 3 ya 4 select karein.');return false}
  if(occupiedTables.has(Number(state.tableNumber))){toast(`Table ${state.tableNumber} is already occupied.`);refreshTables();return false}
 }
 return true;
}

function installApiBridge(){
 if(window.__v35ApiBridge)return;window.__v35ApiBridge=true;
 const previous=api;
 api=async function(path,options={}){
  if(path==='/api/orders'&&String(options.method||'GET').toUpperCase()==='POST'&&options.body){
   try{const body=JSON.parse(options.body);body.tableNumber=state.orderType==='Dine-in'?(state.tableNumber||null):null;options={...options,body:JSON.stringify(body)}}catch(e){}
  }
  return previous(path,options);
 };
}

function stagesFor(order){
 if(order.orderType==='Dine-in')return[{status:'New',label:'Booked'},{status:'Ready',label:'Served',temporary:true},{status:'Completed',label:'Order Complete'}];
 if(order.orderType==='Delivery')return[{status:'New',label:'Booked'},{status:'Preparing',label:'Prepared'},{status:'Ready',label:'Delivered'},{status:'Completed',label:'Order Complete'}];
 return[{status:'New',label:'Booked'},{status:'Ready',label:'Prepared'},{status:'Completed',label:'Order Complete'}];
}

function activeStage(order,stages){
 if(order.status==='Completed')return stages.length-1;
 let status=order.status;
 if(order.orderType==='Takeaway'&&status==='Preparing')status='Ready';
 if(order.orderType==='Dine-in'&&status==='Preparing')status='New';
 const index=stages.findIndex(x=>x.status===status);return Math.max(0,index);
}

function stageLabel(order){const stages=stagesFor(order);return stages[activeStage(order,stages)]?.label||'Booked'}

function gallery(order){
 const items=order.items||[];
 return items.length?items.map((item,index)=>`<div class="v35-food" style="--i:${index}"><img src="/assets/food/${food(item.productName)}" alt="${E(item.productName)}"><div><strong>${E(item.productName)}</strong><small>${Number(item.quantity||0)}× ${E(item.variantName||'Regular')}</small></div></div>`).join(''):'<span class="v35-empty">No item details</span>';
}

function timeline(order){
 if(order.status==='Cancelled')return '<div class="v35-cancelled">Order cancelled</div>';
 const stages=stagesFor(order),active=activeStage(order,stages);
 return `<div class="v35-timeline" style="--stage-count:${stages.length}">${stages.map((stage,index)=>`<div class="v35-stage-wrap"><button type="button" class="v35-stage ${index<active?'done':index===active?'current':'future'}" data-v35-status="${stage.status}" data-id="${order.id}"><i>${index+1}</i><span>${stage.label}</span></button>${stage.temporary?`<button type="button" class="v35-temp-print" data-v35-temp="${order.id}" ${active<index?'disabled':''} title="Print temporary receipt">${icons.print}<span>Temporary receipt</span></button>`:''}</div>`).join('')}</div>`;
}

function orderCard(order,index){
 const when=new Date(order.createdAt).toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),items=order.items||[];
 const table=order.orderType==='Dine-in'&&order.tableNumber?`<span class="v35-mode">${icons.table}<b>Table ${order.tableNumber}</b></span>`:'';
 return `<article class="v35-order-card ${order.status==='Cancelled'?'cancelled':''}" data-id="${order.id}" style="--i:${index}"><header><div class="v35-id"><strong>MC-${E(order.tokenNumber)}</strong><small>${when}</small></div><div class="v35-card-actions"><span class="status ${E(order.status)}">${E(stageLabel(order))}</span>${order.status!=='Cancelled'&&order.status!=='Completed'?`<button type="button" class="v35-cancel" data-v35-cancel="${order.id}">Cancel</button>`:''}</div></header><div class="v35-main"><div class="v35-customer"><span>${icons.customer}</span><div><strong>${E(order.customerName||'Walk-in customer')}</strong><small>${E(order.customerPhone||'No phone')}</small></div></div><div class="v35-gallery">${gallery(order)}</div><div class="v35-total"><small>Total</small><b>${cash(order.total)}</b></div></div><footer><span class="v35-mode">${iconFor(order.orderType)}<b>${E(order.orderType||'Takeaway')}</b></span>${table}<span class="v35-mode">${iconFor(order.paymentMethod)}<b>${E(order.paymentMethod||'Cash')}</b></span><span class="v35-mode">${icons.staff}<b>${E(order.cashierName||'Cafe staff')}</b></span><strong>${items.reduce((n,x)=>n+Number(x.quantity||0),0)} items</strong></footer><section class="v35-progress"><div><p class="eyebrow dark">ORDER STATUS</p><small>${stagesFor(order).map(x=>x.label).join(' → ')}</small></div>${timeline(order)}</section></article>`;
}

function dashboardHost(){
 const box=q('#admin-orders');if(!box)return null;
 const panel=box.closest('article.panel');if(panel){panel.classList.add('v35-operations-panel');const title=q(':scope > h3',panel);if(title)title.textContent='Order operations'}
 return box;
}

async function renderOperations(force=false){
 if(window.__v36Dashboard||state?.user?.role!=='Admin'||operationsBusy)return;
 const box=dashboardHost();if(!box)return;operationsBusy=true;
 try{
  const rows=await api('/api/orders?take=80');
  operationRows=new Map(rows.map(x=>[String(x.id),x]));
  const signature=rows.map(o=>`${o.id}:${o.status}:${o.orderType}:${o.tableNumber||''}:${o.total}:${o.customerName||''}:${o.customerPhone||''}:${(o.items||[]).map(x=>`${x.productName}:${x.variantName}:${x.quantity}`).join(',')}`).join('|');
  const ownsDom=!!q('.v35-order-card',box)||!rows.length;
  if(!force&&signature===operationsSignature&&ownsDom)return;
  operationsSignature=signature;box.dataset.v35Signature=signature;
  box.innerHTML=rows.map(orderCard).join('')||'<p class="muted">No orders yet.</p>';
 }catch(e){console.warn('[v35 operations]',e)}finally{operationsBusy=false}
}

async function setOrderStatus(id,status,button){
 if(button)button.disabled=true;
 try{
  await api(`/api/orders/${id}/status`,{method:'PUT',body:JSON.stringify({status})});
  operationsSignature='';state.dashboardSignature='';state.orderSignature='';state.salesSignature='';
  await renderOperations(true);await refreshTables();toast('Order status updated.');
 }catch(e){toast(e.message||'Order status update failed.')}finally{if(button)button.disabled=false}
}

function receiptLine(left,right){return `<div class="tp-line"><span>${left}</span><b>${right}</b></div>`}
function temporaryReceipt(order){
 const items=(order.items||[]).map(x=>`<div class="tp-item"><div><span>${E(x.productName)}${x.variantName&&x.variantName!=='Regular'?` (${E(x.variantName)})`:''}</span><b>${cash(x.lineTotal)}</b></div><small>${x.quantity} × ${cash(x.unitPrice)}</small></div>`).join('');
 return `<div class="tp tp-customer"><div class="tp-head"><b>MNAHEL'S CAFE</b><small>TEMPORARY DINE-IN RECEIPT</small></div><div class="tp-dash"></div>${receiptLine('Order',`MC-${E(order.tokenNumber)}`)}${receiptLine('Table',`Table ${E(order.tableNumber||'—')}`)}${receiptLine('Customer',E(order.customerName||'Walk-in'))}<div class="tp-dash"></div><div class="tp-th"><span>Item</span><b>Amount</b></div>${items}<div class="tp-dash"></div>${receiptLine('Subtotal',cash(order.subtotal))}${order.discount?receiptLine('Discount',`- ${cash(order.discount)}`):''}<div class="tp-total"><span>AMOUNT</span><b>${cash(order.total)}</b></div><div class="tp-foot"><b>Temporary receipt</b><small>Final receipt will be issued at Order Complete.</small></div></div>`;
}
async function printTemporary(order){
 const sheet=q('#print-sheet');if(!sheet)return toast('Print sheet not found.');
 sheet.removeAttribute('style');sheet.className='print-sheet tp-sheet customer';sheet.innerHTML=temporaryReceipt(order);
 await new Promise(r=>setTimeout(r,120));
 try{
  if(window.__mnahelsDualPrintBridge&&window.chrome?.webview?.postMessage){window.chrome.webview.postMessage('mnahels-print-customer');toast(`Table ${order.tableNumber} temporary receipt sent to printer.`)}else{window.print()}
 }catch(e){toast('Temporary receipt could not be printed.')}
}

function hideLegacyOrders(){
 qa('.sidebar [data-screen="orders"]').forEach(x=>x.remove());qa('[data-screen="orders"]').forEach(x=>{x.hidden=true;x.style.display='none'});const screen=q('#screen-orders');if(screen)screen.hidden=true;
}

function relabelBooked(root=document){
 qa('.status.New,.status.Preparing',root).forEach(node=>{if(node.textContent.trim()==='Received')node.textContent='Booked'});
}

function hookGlobals(){
 if(window.__v35Globals)return;window.__v35Globals=true;
 const oldRenderProducts=renderProducts;renderProducts=function(){oldRenderProducts.apply(this,arguments);categoryFit()};
 const oldDashboard=loadDashboard;loadDashboard=async function(force=false){const out=await oldDashboard(force);await renderOperations(force);return out};
 const oldComplete=showOrderComplete;showOrderComplete=function(order){oldComplete(order);closeBooking(true);operationsSignature='';state.dashboardSignature='';refreshTables();if(state.user?.role==='Admin'&&state.currentScreen==='admin')renderOperations(true)};
 const oldNavigate=navigate;navigate=function(name){if(name==='orders')name=state.user?.role==='Admin'?'admin':'pos';return oldNavigate(name)};
}

function boot(){
 installApiBridge();hookGlobals();ensureBookingControls();categoryFit();syncBookingMode();hideLegacyOrders();relabelBooked();
 q('#order-wizard')?.classList.add('v35-retired');
 if(state?.user?.role==='Admin'&&state.currentScreen==='admin')renderOperations();
}

document.addEventListener('keydown',event=>{
 if(event.key==='F2'){
  event.preventDefault();event.stopImmediatePropagation();if(window.__v38OrderSetup&&window.mnahelsV38?.openSetup){window.mnahelsV38.openSetup(false);return}openBooking();return;
 }
 if(event.key==='Escape'&&bookingOpen&&!q('#variant-dialog')?.open){event.preventDefault();event.stopImmediatePropagation();closeBooking(false)}
},true);

document.addEventListener('click',event=>{
 const place=event.target.closest?.('#place-order');if(place&&bookingOpen&&!validateBooking()){event.preventDefault();event.stopImmediatePropagation();return}
 const stage=event.target.closest?.('[data-v35-status]');if(stage){event.preventDefault();event.stopImmediatePropagation();if(!stage.classList.contains('current'))setOrderStatus(stage.dataset.id,stage.dataset.v35Status,stage);return}
 const cancel=event.target.closest?.('[data-v35-cancel]');if(cancel){event.preventDefault();event.stopImmediatePropagation();if(confirm('Cancel this order?'))setOrderStatus(cancel.dataset.v35Cancel,'Cancelled',cancel);return}
 const temp=event.target.closest?.('[data-v35-temp]');if(temp){event.preventDefault();event.stopImmediatePropagation();const order=operationRows.get(String(temp.dataset.v35Temp));if(order)printTemporary(order);return}
 if(event.target.closest?.('[data-screen="admin"]'))setTimeout(()=>renderOperations(true),80);
},true);

const observer=new MutationObserver(records=>{let categoryChanged=false;for(const record of records){if(record.target?.id==='categories'||record.target?.closest?.('#categories'))categoryChanged=true;relabelBooked(record.target?.nodeType===1?record.target:document)}if(categoryChanged)categoryFit()});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80));else setTimeout(boot,0);
setTimeout(boot,500);setTimeout(()=>{boot();refreshTables()},1200);
window.mnahelsV35={build:BUILD,uiRevision:UI_REVISION,openBooking,refreshTables,renderOperations};
})();
