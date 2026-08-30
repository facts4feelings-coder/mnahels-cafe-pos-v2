(()=>{
/* ==========================================================================
   Mnahel's Cafe POS - v30 layer - build 0.14.8
   Owner    : TechMint Software Solutions - https://techmint.org
   Copyright: (c) 2026 TechMint Software Solutions. All rights reserved.
   A product by TechMint Software Solutions.
   Is layer me (0.14.8 se):
     1) F2 order popup ka reset (v32 me bhi mazbooti se, dono chalte hain)
     2) Toast/error popup ke UPAR dikhta hai (blur ke peechhe nahi chhupta)
     3) Sales & Reports me discount ka poora hisaab
     4) 80mm receipt engine (purane [data-reprint] buttons ke liye)
   HATA DIYA GAYA (ab v32 layer sanbhalti hai, duplicate se bachne ke liye):
     - Orders list ki decoration (date/time, discount, reprint strip)
     - Ctrl + Left/Right se payment mode
     - Settings ke backup card ka hint/saved-folder line
   Purane layers ko touch nahi kiya gaya.
   ========================================================================== */
const BUILD='0.14.8';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const el=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const cash=v=>typeof money==='function'?money(v):'Rs '+Math.round(v||0);

/* ---------------------------------- 2. Toast popup ke UPAR (top layer me) */
let tTimer=null;
function mirrorToast(msg){const text=String(msg==null?'':msg).trim();if(!text)return;const open=all('dialog[open]');const d=open[open.length-1];if(!d)return;let n=d.querySelector('.v30-dialog-toast');if(!n){n=document.createElement('div');n.className='v30-dialog-toast';d.appendChild(n)}n.textContent=text;requestAnimationFrame(()=>n.classList.add('show'));if(tTimer)clearTimeout(tTimer);tTimer=setTimeout(()=>{n.classList.remove('show');setTimeout(()=>{if(n&&n.parentElement)n.parentElement.removeChild(n)},260)},3600)}
try{if(typeof toast==='function'){const prevToast=toast;toast=function(){try{prevToast.apply(this,arguments)}catch(e){}try{mirrorToast(arguments[0])}catch(e){}}}}catch(e){}

/* ------------------------------------------------ 1. F2 popup poora reset */
let pendingReset=false;
function clearField(sel){const n=el(sel);if(!n)return;if(n.value!==''){n.value='';try{n.dispatchEvent(new Event('input',{bubbles:true}))}catch(e){}}}
function resetWizard(){try{
	['#ow-phone','#ow-name','#ow-address','#ow-note','#customer-phone','#customer-name','#delivery-address','#order-note','#ow-input','#px-input','#discount'].forEach(clearField);
	const err=el('#ow-phone-error');if(err){err.hidden=true;err.textContent=''}
	const ph=el('#ow-phone');if(ph)ph.classList.remove('invalid','error','input-error');
	if(typeof state!=='undefined'&&state){
		if(Array.isArray(state.cart)&&state.cart.length){state.cart.length=0;if(typeof renderCart==='function')renderCart()}
		const wasType=state.orderType;
		if(wasType!=='Takeaway'){const a=el('[data-ow-type="Takeaway"]');if(a)a.click();const b=el('[data-order-type="Takeaway"]');if(b)b.click();state.orderType='Takeaway'}
		if(state.payment!=='Cash'){const p=el('[data-payment="Cash"]');if(p)p.click();state.payment='Cash';all('[data-px-pay]').forEach(x=>x.classList.toggle('active',x.dataset.pxPay==='Cash'))}
		const wrap=el('#ow-address-wrap');if(wrap)wrap.hidden=true;
	}
}catch(e){}}
function maybeReset(){const d=el('#order-wizard');if(d&&d.open)return;if(!pendingReset)return;pendingReset=false;resetWizard()}
function hookWizard(){const d=el('#order-wizard');if(!d||d.dataset.v30Hook)return false;d.dataset.v30Hook='1';d.addEventListener('close',()=>{pendingReset=true});return true}
const hookTimer=setInterval(()=>{if(hookWizard())clearInterval(hookTimer)},150);setTimeout(()=>clearInterval(hookTimer),30000);
document.addEventListener('keydown',e=>{if(e.key==='F2')maybeReset()},true);
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#ow-launch'):null;if(b)maybeReset()},true);

/* ------------------------------- 4. 80mm receipt engine (reprint ke liye) */
function cashier(){const u=(typeof state!=='undefined'&&state&&state.user)||{};return u.fullName||u.name||u.username||'\u2014'}
function when(o){return new Date(o.createdAt||Date.now()).toLocaleString('en-PK',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function row(a,b){return `<div class="tp-line"><span>${a}</span><b>${b}</b></div>`}
function variant(x){return x.variantName&&x.variantName!=='Regular'?` (${esc(x.variantName)})`:''}
function gross(o){const s=o&&o.subtotal;return (typeof s==='number'&&s>0)?s:((o&&o.total)||0)+((o&&o.discount)||0)}
function discPct(o){const g=gross(o),d=(o&&o.discount)||0;return g?Math.round(d/g*100):0}
function thermal(o,type){const dash='<div class="tp-dash"></div>';const items=(o.items||[]);const g=gross(o),d=o.discount||0,p=discPct(o);
if(type==='customer'){const lines=items.map(x=>`<div class="tp-item"><div><span>${esc(x.productName)}${variant(x)}</span><b>${cash(x.lineTotal)}</b></div><small>${x.quantity} x ${cash(x.unitPrice)}</small></div>`).join('');return `<div class="tp tp-customer"><div class="tp-head"><b>MNAHEL'S CAFE</b><small>Lahore Road, Gaggoo Mandi</small><small>THE WORLD OF TASTE</small></div>${dash}${row('Receipt',esc(o.receiptNumber||'\u2014'))}${row('Token','#'+(o.tokenNumber??'\u2014'))}${row('Date',when(o))}${row('Type',esc(o.orderType||''))}${row('Payment',esc(o.paymentMethod||'Cash'))}${row('Cashier',esc(o.cashierName||cashier()))}${dash}${row('Customer',esc(o.customerName||'Walk-in'))}${row('Phone',esc(o.customerPhone||'\u2014'))}${o.orderType==='Delivery'&&o.deliveryAddress?`<div class="tp-addr"><span>Address</span><b>${esc(o.deliveryAddress)}</b></div>`:''}${dash}<div class="tp-th"><span>Item</span><b>Amount</b></div>${lines||'<div class="tp-empty">No items</div>'}${dash}${row('Price before discount',cash(g))}${d?row('Discount ('+p+'%)','- '+cash(d)):row('Discount','\u2014')}<div class="tp-total"><span>TOTAL PAID</span><b>${cash(o.total)}</b></div>${d?`<div class="tp-saved">You saved ${cash(d)} (${p}% discount)</div>`:''}${dash}<div class="tp-foot"><b>SHUKRIYA \u00b7 THANK YOU</b><small>Freshly made, served with care.</small><small>Aap ka dobara intezaar rahega \u2014 Mnahel's Cafe</small></div></div>`}
const klines=items.map(x=>`<div class="tp-kitem"><b>${x.quantity} x</b><span>${esc(x.productName)}${x.variantName&&x.variantName!=='Regular'?`<em>${esc(x.variantName)}</em>`:''}</span></div>`).join('');return `<div class="tp tp-kitchen"><div class="tp-head"><b>KITCHEN TICKET</b><small>Prepare order carefully</small></div><div class="tp-token">TOKEN #${o.tokenNumber??'\u2014'}</div>${dash}${row('Receipt',esc(o.receiptNumber||'\u2014'))}${row('Time',when(o))}${row('Type',esc(o.orderType||''))}${row('Customer',esc(o.customerName||'Walk-in'))}${row('Phone',esc(o.customerPhone||'\u2014'))}${o.orderType==='Delivery'&&o.deliveryAddress?`<div class="tp-addr"><span>Address</span><b>${esc(o.deliveryAddress)}</b></div>`:''}${dash}<div class="tp-th"><span>Qty</span><b>Item</b></div>${klines||'<div class="tp-empty">No items</div>'}${o.notes?`<div class="tp-note"><b>NOTE</b><span>${esc(o.notes)}</span></div>`:''}${dash}<div class="tp-foot"><b>KITCHEN COPY</b><small>${esc(o.orderType||'')} \u00b7 ${(o.items||[]).reduce((n,x)=>n+x.quantity,0)} items</small></div></div>`}
function setSheet(o,type){const sheet=el('#print-sheet');if(!sheet)return;sheet.removeAttribute('style');sheet.className=`print-sheet tp-sheet ${type}`;sheet.innerHTML=thermal(o,type)}
function bridge(type){return new Promise(resolve=>{const done=e=>{if(e.data===`mnahels-print-${type}-done`||e.data===`mnahels-print-${type}-cancelled`){window.chrome.webview.removeEventListener('message',done);resolve(true)}};window.chrome.webview.addEventListener('message',done);window.chrome.webview.postMessage(`mnahels-print-${type}`)})}
async function printOne(o,type){setSheet(o,type);await sleep(120);if(window.__mnahelsDualPrintBridge&&window.chrome&&window.chrome.webview&&window.chrome.webview.postMessage)return bridge(type);window.print();await sleep(320);return true}
let omap=new Map(),omapAt=0,loading=false;
async function orderMap(force){const now=Date.now();if(!force&&now-omapAt<3000)return omap;if(loading)return omap;loading=true;try{const os=await api('/api/orders?take=200');omap=new Map(os.map(o=>[String(o.id),o]));omapAt=Date.now()}catch(e){}finally{loading=false}return omap}
let printing=false;
document.addEventListener('click',async e=>{const b=e.target&&e.target.closest?e.target.closest('[data-reprint]'):null;if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(printing)return;printing=true;b.disabled=true;const type=b.dataset.reprint;try{const map=await orderMap(true);const o=map.get(String(b.dataset.id));if(!o){toast('Order load nahi hua, Refresh karke dobara koshish karein.');return}await printOne(o,type);toast(type==='customer'?'Customer receipt reprint par bhej di gayi.':'Kitchen receipt reprint par bhej di gayi.')}catch(err){toast((err&&err.message)||'Print error')}finally{printing=false;b.disabled=false}},true);

/* --------------------- 3. Sales & Reports: discount ka poora hisaab */
let rcache=[],rcacheAt=0,rloading=false,ensBusy=false;
async function reportOrders(){const now=Date.now();if(rcache.length&&now-rcacheAt<8000)return rcache;if(rloading)return rcache;rloading=true;try{const os=await api('/api/orders?take=10000');rcache=os;rcacheAt=Date.now()}catch(e){}finally{rloading=false}return rcache}
function salesBounds(){const a=el('#report-ranges [data-report-range].active');const key=a&&a.dataset?a.dataset.reportRange:'month';const now=new Date();let s=new Date(now.getFullYear(),now.getMonth(),now.getDate()),e=new Date(s);e.setDate(e.getDate()+1);if(key==='yesterday'){e=new Date(s);s=new Date(s);s.setDate(s.getDate()-1)}if(key==='week')s.setDate(s.getDate()-6);if(key==='month')s.setDate(s.getDate()-29);if(key==='year')s.setFullYear(s.getFullYear()-1);if(key==='custom'){const f=el('#report-from'),t=el('#report-to');if(!f||!t||!f.value||!t.value)return null;s=new Date(f.value+'T00:00:00');e=new Date(t.value+'T00:00:00');e.setDate(e.getDate()+1)}return{s,e}}
function metricCard(label,value){return `<article class="metric v30-metric"><small>${label}</small><strong>${value}</strong></article>`}
async function enhanceSales(){if(ensBusy)return;const host=el('#one-metrics');if(!host)return;const p=salesBounds();if(!p)return;ensBusy=true;try{
	const list=await reportOrders();if(!list.length)return;
	const valid=list.filter(o=>{const d=new Date(o.createdAt);return d>=p.s&&d<p.e&&o.status!=='Cancelled'});
	const g=valid.reduce((n,o)=>n+gross(o),0),dis=valid.reduce((n,o)=>n+(o.discount||0),0),cnt=valid.filter(o=>(o.discount||0)>0).length;
	const avg=g?Math.round(dis/g*1000)/10:0;
	all('#one-metrics .metric small').forEach(s=>{if(s.textContent.trim()==='Discounts')s.textContent='Total discount given'});
	if(!host.querySelector('.v30-metric'))host.insertAdjacentHTML('beforeend',metricCard('Sales before discount',cash(g))+metricCard('Discounted orders',cnt+' \u00b7 avg '+avg+'%'));
	const table=el('#screen-sales .sales-table');if(!table)return;
	const hr=table.querySelector('thead tr');
	if(hr&&!hr.querySelector('.v30-dh')){const ths=[...hr.children],last=ths[ths.length-1];if(last)last.insertAdjacentHTML('beforebegin','<th class="v30-dh">Discount</th>')}
	const map=new Map(list.map(o=>[String(o.receiptNumber),o]));
	all('#screen-sales .sales-table tbody tr').forEach(tr=>{if(tr.dataset.v30==='1')return;const cells=[...tr.children];if(cells.length<7)return;tr.dataset.v30='1';const head=cells[0].querySelector('strong')||cells[0];const o=map.get(String(head.textContent).trim());const d=o?(o.discount||0):0,sub=o?gross(o):0;const txt=d?('- '+cash(d)+(sub?' <small>('+Math.round(d/sub*100)+'%)</small>':'')):'\u2014';cells[cells.length-1].insertAdjacentHTML('beforebegin','<td class="v30-dc">'+txt+'</td>')})
}catch(e){}finally{ensBusy=false}}
try{if(typeof loadSales==='function'){const prevSales=loadSales;loadSales=async function(){const r=await prevSales.apply(this,arguments);try{await enhanceSales()}catch(e){}return r}}}catch(e){}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#report-ranges button,#apply-custom-report,[data-screen="sales"]'):null;if(b){rcacheAt=0;setTimeout(()=>{enhanceSales()},400)}},true);

/* -------------------------------------------------- build ka nishan */
function versionChip(){const host=el('.side-bottom');if(!host)return;let n=el('#v30-build');if(!n){n=document.createElement('small');n.id='v30-build';n.className='v30-build';host.appendChild(n)}const txt='POS build '+BUILD;if(n.textContent!==txt)n.textContent=txt}
function buildTag(){all('#ow-pricing .ow-navhint').forEach(n=>{if(n.textContent.indexOf('build ')>=0&&n.textContent.indexOf(BUILD)<0)n.innerHTML=n.innerHTML.replace(/build\s+[0-9.]+/,'build '+BUILD)})}
function payHint(){all('#ow-pricing .ow-label').forEach(n=>{if(n.dataset.v30)return;if(n.textContent.indexOf('PAYMENT MODE')<0)return;n.dataset.v30='1';n.insertAdjacentHTML('beforeend',' <b>Ctrl+\u2190</b> <b>Ctrl+\u2192</b>')})}

setInterval(()=>{try{versionChip();buildTag();payHint()}catch(e){}try{if(el('#screen-sales.active')&&(!el('#one-metrics .v30-metric')||el('#screen-sales .sales-table tbody tr:not([data-v30])')))enhanceSales()}catch(e){}},800);
setTimeout(()=>{try{versionChip()}catch(e){}},1200);
})();
