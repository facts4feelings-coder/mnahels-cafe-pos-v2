(()=>{
'use strict';
const BUILD='0.15.25',UI_REVISION='20260901-receipt-speed-25';
const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const money=value=>Math.round(Number(value||0)).toLocaleString('en-PK');
const paidStatus=order=>String(order?.paymentStatus||'').toLowerCase()==='paid'||order?.isPaid===true;
const brandLogo='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M9 13h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-7Zm12 2h2a3 3 0 0 1 0 6h-2M12 10c0-2 2-2 2-4m4 4c0-2 2-2 2-4"/></svg>';
const icons={
 'Dine-in':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8m3-8v8M5 3v5c0 2 1 3 3 3s3-1 3-3V3M8 11v10M16 3v18m0-18c2 0 3 2 3 5s-1 5-3 5"/></svg>',
 Takeaway:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 13H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2"/></svg>',
 Delivery:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v10H3V7Zm11 4h4l3 3v3h-7v-6ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>'
};
function orderMode(order){const value=String(order?.orderType||'Takeaway');return icons[value]?value:'Takeaway'}
function placedAt(order){const source=order?.createdAt||order?.placedAt;if(!source)return new Date().toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'});const date=new Date(source);return Number.isNaN(date.getTime())?String(source):date.toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})}
function service(order,mode){
 if(mode==='Dine-in')return{label:'TABLE / WAITER',value:`${order?.tableName||`Table ${order?.tableNumber||'—'}`} · ${order?.waiterName||'—'}`};
 if(mode==='Delivery')return{label:'RIDER / AREA',value:`${order?.riderName||'Rider unassigned'}${order?.deliveryAddress?` · ${order.deliveryAddress}`:''}`};
 return{label:'FULFILMENT',value:'Counter pickup'};
}
function seal(kind){
 if(kind==='kitchen')return{label:'KITCHEN',sub:'PREPARE NOW',title:'KITCHEN TICKET'};
 if(kind==='waiter')return{label:'PAYMENT DUE',sub:'WAITER COPY',title:'WAITER ORDER · PAY LATER'};
 if(kind==='paid')return{label:'PAID',sub:'FINAL RECEIPT',title:'FINAL PAID RECEIPT'};
 return{label:'TEMPORARY',sub:'SLIP',title:'TEMPORARY SLIP'};
}
function metaCell(label,value){return`<div class="v43-meta-cell"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function itemRows(order,kitchen){
 const rows=Array.isArray(order?.items)?order.items:[];
 return rows.map(item=>{
  const qty=Math.max(0,Number(item.quantity||0));
  const variant=esc(item.variantName||'Regular');
  const third=kitchen?variant:money(item.lineTotal!=null?item.lineTotal:Number(item.unitPrice||0)*qty);
  return`<div class="tp-item v43-item-row"><span class="v43-qty">${qty}</span><div class="v43-item-name"><b>${esc(item.productName||'Item')}</b><small>${variant}${kitchen?' · Prep line':item.unitPrice!=null?` · ${money(item.unitPrice)} each`:''}</small></div><strong class="v43-third ${kitchen?'v43-variant':'v43-amount'}">${third}</strong></div>`;
 }).join('')||'<div class="v43-empty">No items</div>';
}
function paymentLines(order,kind){
 if(kind==='kitchen')return'';
 const paid=kind==='paid';
 const subtotal=money(order?.subtotal!=null?order.subtotal:order?.total);
 const discount=Number(order?.discount||0);
 const total=money(order?.total);
 return`<div class="v43-summary"><div class="tp-line"><span>Subtotal</span><b>${subtotal}</b></div>${discount?`<div class="tp-line"><span>Discount</span><b>- ${money(discount)}</b></div>`:''}<div class="tp-total"><span>${paid?'TOTAL PAID':'AMOUNT DUE'}</span><b>${total}</b></div></div>${paid?`<div class="v43-payment-grid">${metaCell('PAYMENT',order?.paymentMethod||'Paid')}${order?.paymentMethod==='Cash'&&order?.cashReceived!=null?metaCell('RECEIVED / CHANGE',`${money(order.cashReceived)} / ${money(order.changeDue)}`):metaCell('REFERENCE',order?.paymentReference||'Confirmed')}</div>`:''}`;
}
function receiptHtml(order,requestedKind='customer'){
 let kind=requestedKind;
 if(kind==='customer')kind=paidStatus(order)?'paid':'unpaid';
 if(!['kitchen','waiter','paid','unpaid'].includes(kind))kind='unpaid';
 const mode=orderMode(order),serviceInfo=service(order,mode),status=seal(kind),kitchen=kind==='kitchen';
 const footerTitle=kind==='kitchen'?'KITCHEN COPY':kind==='waiter'?'WAITER COPY':'THANK YOU!';
 const footerCopy=kind==='kitchen'?'Prepare with care.':kind==='waiter'?'Service order copy.':'We hope to serve you again.';
 return`<article class="tp tp-customer v43-receipt ${kind}" data-receipt-kind="${kind}" data-order-mode="${esc(mode)}">
  <header class="tp-head v43-dark-head">
   <div class="v43-brand"><div class="v43-brand-line"><span class="v43-brand-logo">${brandLogo}</span><b>MNAHEL'S CAFE</b></div><small>THE WORLD OF TASTE</small></div>
   <div class="v43-mode"><span class="v43-mode-icon">${icons[mode]}</span><b>${esc(mode.toUpperCase())}</b></div>
   <div class="v43-seal"><strong>${esc(status.label)}</strong><small>${esc(status.sub)}</small></div>
  </header>
  <div class="v43-body">
   <div class="v43-meta-grid">${metaCell('ORDER',`MC-${order?.tokenNumber??'—'}`)}${metaCell('PLACED AT',placedAt(order))}${metaCell('CUSTOMER',order?.customerName||'Walk-in customer')}${metaCell(serviceInfo.label,serviceInfo.value)}</div>
   <div class="v43-items"><div class="tp-th"><span>QTY</span><span>ITEM</span><b>${kitchen?'VARIANT':'AMOUNT'}</b></div>${itemRows(order,kitchen)}</div>
   ${paymentLines(order,kind)}
   <footer class="tp-foot"><b>A product by TechMint Software Solutions</b><strong>${footerTitle}</strong><span>${footerCopy}</span></footer>
  </div>
 </article>`;
}
document.documentElement.dataset.uiRevision=UI_REVISION;
window.__MNAHELS_UI_REVISION__=UI_REVISION;
window.mnahelsV43={build:BUILD,uiRevision:UI_REVISION,receiptHtml,isPaid:paidStatus};
})();
