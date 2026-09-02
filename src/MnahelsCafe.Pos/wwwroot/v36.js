/*
 * Mnahel's Cafe POS · v0.15.7 service hub, animated order timeline and cash change
 * Owner: Eastern Cross Technology · https://techmint.org
 * A product by Eastern Cross Technology.
 */
window.__v36Dashboard=true;
(()=>{
'use strict';
const BUILD='0.15.7',UI_REVISION='20260830-service-7';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
const svg=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const icons={
 takeaway:svg('<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M8 8V5h8v3M9 12h6"/>'),
 dine:svg('<path d="M5 3v8M3 3v5c0 2 4 2 4 0V3M5 11v10M15 3v18M15 3c4 2 4 7 0 9"/>'),
 delivery:svg('<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>'),
 cash:svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>'),
 card:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
 online:svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 18h2"/>'),
 customer:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>'),
 rider:svg('<circle cx="12" cy="6" r="3"/><path d="M8 21l2-7-3-3 5-2 4 3 3 1M10 14l5 2 2 5"/>'),
 waiter:svg('<circle cx="12" cy="6" r="3"/><path d="M7 21v-5c0-4 2-6 5-6s5 2 5 6v5M9 13h6"/>'),
 table:svg('<path d="M4 10h16M6 10l-1 11M18 10l1 11M8 6h8v4H8z"/>'),
 note:svg('<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>'),
 print:svg('<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><path d="M17 11h.01"/>'),
 check:svg('<path d="m6 12 4 4 8-9"/>')
};
const modeIcon=v=>String(v||'').toLowerCase().includes('dine')?icons.dine:String(v||'').toLowerCase().includes('deliver')?icons.delivery:icons.takeaway;
const payIcon=v=>String(v||'').toLowerCase().includes('card')?icons.card:String(v||'').toLowerCase().match(/online|bank|wallet/)?icons.online:icons.cash;
const foodImages=[['pizza','pizza.jpg'],['burger','burger.jpg'],['sandwich','sandwich.jpg'],['pasta','pasta.jpg'],['fries','fries.jpg'],['wing','chicken.jpg'],['nugget','chicken.jpg'],['broast','chicken.jpg'],['chicken','chicken.jpg'],['shake','drinks.jpg'],['drink','drinks.jpg'],['coffee','drinks.jpg'],['margarita','drinks.jpg'],['cake','dessert.jpg'],['brownie','dessert.jpg'],['dessert','dessert.jpg'],['tin pack','sandwich.jpg']];
const imageFor=name=>`/assets/food/${(foodImages.find(([key])=>String(name||'').toLowerCase().includes(key))||['','sandwich.jpg'])[1]}`;
let hub={riders:[],waiters:[],tables:[]},hubBusy=false,operationsBusy=false,statusUpdateBusy=0,operationsEpoch=0,operationsSignature='',booted=false,apiWrapped=false,globalsHooked=false,orderRows=new Map(),lastAutoPrint=0;

function stagesFor(order){
 if(order.orderType==='Dine-in')return[{status:'New',label:'Booked'},{status:'Ready',label:'Served'},{status:'Completed',label:'Order Complete'}];
 if(order.orderType==='Delivery')return[{status:'New',label:'Booked'},{status:'Preparing',label:'Prepared'},{status:'Ready',label:'Delivered'},{status:'Completed',label:'Order Complete'}];
 return[{status:'New',label:'Booked'},{status:'Ready',label:'Prepared'},{status:'Completed',label:'Order Complete'}];
}
function activeStage(order,stages=stagesFor(order)){
 if(order.status==='Cancelled')return -1;let i=stages.findIndex(x=>x.status===order.status);
 if(i>=0)return i;if(order.status==='Preparing')return Math.min(1,stages.length-1);return 0;
}
function stageLabel(order){const s=stagesFor(order);return order.status==='Cancelled'?'Cancelled':s[activeStage(order,s)]?.label||'Booked'}
function operationSignature(rows){return rows.map(o=>`${o.id}:${o.status}:${o.orderType}:${o.tableId||o.tableNumber||''}:${o.riderId||''}:${o.waiterId||''}:${o.total}:${o.cashReceived||''}:${o.notes||''}:${(o.items||[]).map(x=>`${x.productName}:${x.variantName}:${x.quantity}`).join(',')}`).join('|')}
function patchCardState(order){
 const el=q(`.v36-order-card[data-id="${order.id}"]`);if(!el)return false;el.classList.toggle('cancelled',order.status==='Cancelled');el.dataset.status=order.status;
 const badge=q('.v36-card-actions .status',el);if(badge){badge.className=`status ${order.status}`;badge.textContent=stageLabel(order)}
 const progress=q('.v36-progress',el);if(progress)progress.innerHTML=`<div class="v36-progress-title"><p class="eyebrow dark">ORDER TIMELINE</p><small>${stagesFor(order).map(x=>x.label).join(' → ')}</small></div>${timeline(order)}`;
 if(order.status==='Completed'||order.status==='Cancelled')q('.v36-cancel',el)?.remove();
 requestAnimationFrame(()=>{const active=q('.v36-step.current i',el);[badge,active].filter(Boolean).forEach((node,i)=>{try{node.animate([{transform:'scale(.78)',opacity:.68},{transform:'scale(1.18)',opacity:1,offset:.62},{transform:'scale(1)',opacity:1}],{duration:i?520:420,easing:'cubic-bezier(.34,1.56,.44,1)'})}catch(e){}})});return true;
}
function itemsCount(order){return (order.items||[]).reduce((n,x)=>n+Number(x.quantity||0),0)}
function gallery(order){const items=order.items||[];return items.length?items.map((item,i)=>`<div class="v36-food" style="--food-i:${i}" title="${E(item.productName)} · ${E(item.variantName)}"><img src="${imageFor(item.productName)}" alt=""><div><strong>${E(item.productName)}</strong><small>${Number(item.quantity||0)}× ${E(item.variantName||'Regular')}</small></div></div>`).join(''):'<span class="v36-empty">No item details</span>'}
function assignmentChips(order){
 const chips=[];
 if(order.orderType==='Dine-in'&&(order.tableName||order.tableNumber))chips.push(`<span>${icons.table}<b>${E(order.tableName||`Table ${order.tableNumber}`)}</b></span>`);
 if(order.orderType==='Dine-in'&&order.waiterName)chips.push(`<span>${icons.waiter}<b>${E(order.waiterName)}</b></span>`);
 if(order.orderType==='Delivery'&&order.riderName)chips.push(`<span>${icons.rider}<b>${E(order.riderName)}</b></span>`);
 return chips.join('');
}
function timeline(order){
 if(order.status==='Cancelled')return '<div class="v36-cancelled">Order cancelled · assignments released</div>';
 const stages=stagesFor(order),active=activeStage(order,stages);
 return `<div class="v36-timeline" style="--stage-count:${stages.length}">${stages.map((stage,index)=>{
  const stateClass=index<active?'done':index===active?'current':'future';
  const print=index===0&&order.orderType==='Dine-in'?`<div class="v36-stage-tools"><button type="button" data-v36-print="waiter" data-id="${order.id}" title="Print waiter receipt">${icons.print}<span>Waiter</span></button><button type="button" data-v36-print="kitchen" data-id="${order.id}" title="Print kitchen receipt">${icons.print}<span>Kitchen</span></button></div>`:'';
  return `<div class="v36-step-wrap"><button type="button" class="v36-step ${stateClass}" data-v36-status="${stage.status}" data-id="${order.id}" title="Set ${stage.label}"><i>${index<active?icons.check:index+1}</i><span>${stage.label}</span></button>${print}</div>`;
 }).join('')}</div>`;
}
function card(order,index){
 const when=new Date(order.createdAt).toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
 const assigned=assignmentChips(order),notes=String(order.notes||'').trim();
 return `<article class="v36-order-card ${order.status==='Cancelled'?'cancelled':''}" data-id="${order.id}" style="--card-i:${index}">
  <header><div class="v36-id"><strong>MC-${E(order.tokenNumber)}</strong><small>${E(when)}</small><span class="v36-order-mode">${modeIcon(order.orderType)}<b>${E(order.orderType||'Takeaway')}</b></span></div><div class="v36-card-actions"><span class="status ${E(order.status)}">${E(stageLabel(order))}</span>${order.status!=='Cancelled'&&order.status!=='Completed'?`<button type="button" class="v36-cancel" data-v36-cancel="${order.id}">Cancel</button>`:''}</div></header>
  <div class="v36-main"><div class="v36-customer"><span>${icons.customer}</span><div><strong>${E(order.customerName||'Walk-in customer')}</strong><small>${E(order.customerPhone||'No phone')}</small></div></div><div class="v36-gallery">${gallery(order)}</div><div class="v36-total"><span>${payIcon(order.paymentMethod)}<b>${E(order.paymentMethod||'Cash')}</b></span><strong>${cash(order.total)}</strong>${order.paymentMethod==='Cash'&&order.cashReceived!=null?`<small>${cash(order.cashReceived)} received · ${cash(order.changeDue)} change</small>`:''}</div></div>
  <div class="v36-info"><div>${assigned||`<span>${icons.customer}<b>${E(order.cashierName||'Cafe staff')}</b></span>`}</div><strong>${itemsCount(order)} items</strong></div>
  ${notes?`<div class="v36-order-note">${icons.note}<span><b>Order note</b>${E(notes)}</span></div>`:''}
  <section class="v36-progress"><div class="v36-progress-title"><p class="eyebrow dark">ORDER TIMELINE</p><small>${stagesFor(order).map(x=>x.label).join(' → ')}</small></div>${timeline(order)}</section>
 </article>`;
}
async function renderOperations(force=false){
 if(!state?.user||!['Admin','Cashier'].includes(state.user.role)||!q('#admin-orders')||operationsBusy||statusUpdateBusy)return;const requestEpoch=operationsEpoch;operationsBusy=true;
 try{
  const rows=await api('/api/orders?take=80');if(requestEpoch!==operationsEpoch)return;
  const sig=operationSignature(rows),box=q('#admin-orders');
  if(!force&&sig===operationsSignature&&box.querySelectorAll('.v36-order-card').length===rows.length)return;operationsSignature=sig;orderRows=new Map(rows.map(x=>[String(x.id),x]));
  box.innerHTML=rows.map(card).join('')||'<div class="panel">No orders yet.</div>';
  const panel=box.closest('.panel');panel?.classList.add('v36-operations-panel');const heading=panel?.querySelector(':scope > h3');if(heading)heading.textContent='Order operations';
 }catch(e){toast(e.message||'Orders could not be loaded.')}finally{operationsBusy=false}
}
async function updateStatus(id,status,button){
 if(button)button.disabled=true;operationsEpoch++;statusUpdateBusy++;let recover=false;
 try{await api(`/api/orders/${id}/status`,{method:'PUT',body:JSON.stringify({status})});const order=orderRows.get(String(id));if(order){order.status=status;recover=!patchCardState(order);operationsSignature=operationSignature([...orderRows.values()])}else recover=true;state.dashboardSignature='';await refreshHub(true);toast('Order timeline updated.')}catch(e){toast(e.message)}finally{statusUpdateBusy=Math.max(0,statusUpdateBusy-1);if(button)button.disabled=false;if(recover)setTimeout(()=>renderOperations(true),0)}
}

function serviceScreen(){
 let screen=q('#screen-service');if(screen)return screen;
 const main=q('.main');if(!main)return null;
 screen=document.createElement('section');screen.id='screen-service';screen.className='screen v36-service-screen';
 screen.innerHTML=`<div class="v36-service-hero"><div><p class="eyebrow dark">FLOOR & DELIVERY</p><h3>Service Hub</h3><p>Riders, waiters aur café tables yahan manage karein. Active order par assigned resource Booked rahega.</p></div><span>${icons.rider}${icons.waiter}${icons.table}</span></div><div class="v36-service-grid">
 <article class="panel"><header><span>${icons.rider}</span><div><h3>Riders</h3><small>Delivery assignments</small></div></header><form data-v36-add="Rider"><input name="name" placeholder="Rider name" required><input name="phone" inputmode="tel" placeholder="Phone number" required><button>Add rider</button></form><div id="v36-riders" class="v36-service-list"></div></article>
 <article class="panel"><header><span>${icons.waiter}</span><div><h3>Waiters</h3><small>Dine-in assignments</small></div></header><form data-v36-add="Waiter"><input name="name" placeholder="Waiter name" required><input name="phone" inputmode="tel" placeholder="Phone number" required><button>Add waiter</button></form><div id="v36-waiters" class="v36-service-list"></div></article>
 <article class="panel"><header><span>${icons.table}</span><div><h3>Tables</h3><small>Dining floor</small></div></header><form data-v36-add="Table"><input name="name" placeholder="Table name" required><button>Add table</button></form><div id="v36-tables" class="v36-service-list"></div></article>
 </div>`;
 main.appendChild(screen);bindServiceScreen(screen);return screen;
}
function ensureServiceNav(){
 const nav=q('.sidebar nav');if(!nav)return;
 let b=q('[data-screen="service"]',nav);
 if(!b){b=document.createElement('button');b.className='nav-item';b.dataset.screen='service';b.title='Service Hub';b.innerHTML=`${icons.waiter}<span class="ma-nav-label">Service Hub</span>`;nav.appendChild(b);b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openService()});}
 b.classList.remove('admin-only');b.style.display=state?.user?'flex':'none';const screen=serviceScreen();screen?.classList.toggle('v54-readonly',state?.user?.role!=='Admin');
}
function openService(){
 if(!state?.user||!['Admin','Cashier'].includes(state.user.role))return;state.currentScreen='service';qa('.screen').forEach(x=>x.classList.remove('active'));const screen=serviceScreen();screen?.classList.add('active');screen?.classList.toggle('v54-readonly',state.user.role!=='Admin');qa('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.screen==='service'));const k=q('#page-kicker'),t=q('#page-title');if(k)k.textContent='FLOOR & DELIVERY';if(t)t.textContent='Service Hub';refreshHub(true);
}
function renderServiceList(selector,rows,type){
 const box=q(selector);if(!box)return;const canEdit=state?.user?.role==='Admin';
 box.innerHTML=rows.map(x=>{const assignments=Array.isArray(x.assignments)?x.assignments:[];let detail='';
  if(type==='Waiter'&&assignments.length)detail=`<div class="v54-service-assignments">${assignments.map(a=>`<span><b>${E(a.tableName||'Table')}</b><small>MC-${E(a.tokenNumber)} · ${E(a.status||'Booked')}</small></span>`).join('')}</div>`;
  else if(type==='Rider'&&x.booked)detail=`<div class="v54-service-assignments"><span><b>MC-${E(x.tokenNumber)}</b><small>${E(assignments[0]?.status||'Delivery order')}</small></span></div>`;
  else if(type==='Table'&&x.booked)detail=`<div class="v54-service-assignments"><span><b>MC-${E(x.tokenNumber)}</b><small>${E(x.waiterName||'Waiter not shown')} · ${E(x.status||'Booked')}</small></span></div>`;
  const status=type==='Waiter'&&assignments.length?`Serving ${assignments.length} table${assignments.length===1?'':'s'}`:x.booked?`Booked · MC-${E(x.tokenNumber)}`:x.isActive?'Available':'Inactive';
  const actions=canEdit?`<button type="button" data-v36-edit="1">Edit</button><button type="button" data-v36-toggle="1" ${x.booked?'disabled':''}>${x.isActive?'Pause':'Activate'}</button>`:'';
  return `<div class="v36-service-person ${x.booked?'booked':''} ${!x.isActive?'inactive':''} ${assignments.length>1?'v54-multi':''}" data-id="${x.id}" data-type="${type}"><span>${type==='Rider'?icons.rider:type==='Waiter'?icons.waiter:icons.table}</span><div class="v54-service-identity"><strong>${E(x.name)}</strong>${x.phone?`<small>${E(x.phone)}</small>`:''}</div><div class="v54-service-state"><em>${status}</em>${detail}</div>${actions}</div>`;
 }).join('')||`<div class="v36-none">No ${type.toLowerCase()} added yet.</div>`;
}
function paintService(){const screen=q('#screen-service');screen?.classList.toggle('v54-readonly',state?.user?.role!=='Admin');renderServiceList('#v36-riders',hub.riders||[],'Rider');renderServiceList('#v36-waiters',hub.waiters||[],'Waiter');renderServiceList('#v36-tables',hub.tables||[],'Table');paintAssignments()}
async function refreshHub(force=false){
 if(hubBusy||!state?.user)return;hubBusy=true;
 try{hub=await api('/api/service-hub');paintService()}catch(e){if(force)toast(e.message||'Service Hub could not be loaded.')}finally{hubBusy=false}
}
function bindServiceScreen(screen){
 screen.addEventListener('submit',async e=>{
  const form=e.target.closest('form[data-v36-add]');if(!form)return;e.preventDefault();if(state?.user?.role!=='Admin')return;const type=form.dataset.v36Add,fd=new FormData(form),name=String(fd.get('name')||'').trim(),phone=String(fd.get('phone')||'').trim(),button=q('button',form);button.disabled=true;
  try{if(type==='Table')await api('/api/service/tables',{method:'POST',body:JSON.stringify({name})});else await api('/api/service/people',{method:'POST',body:JSON.stringify({type,name,phone})});form.reset();await refreshHub(true);toast(`${type} added.`)}catch(err){toast(err.message)}finally{button.disabled=false}
 });
 screen.addEventListener('click',async e=>{
  const row=e.target.closest('.v36-service-person');if(!row||state?.user?.role!=='Admin')return;const type=row.dataset.type,id=Number(row.dataset.id),source=(type==='Rider'?hub.riders:type==='Waiter'?hub.waiters:hub.tables).find(x=>Number(x.id)===id);if(!source)return;
  if(e.target.closest('[data-v36-edit]')){const name=prompt(`${type} name`,source.name);if(name===null)return;let phone=source.phone;if(type!=='Table'){phone=prompt(`${type} phone`,source.phone||'');if(phone===null)return}try{if(type==='Table')await api(`/api/service/tables/${id}`,{method:'PUT',body:JSON.stringify({name,isActive:source.isActive})});else await api(`/api/service/people/${id}`,{method:'PUT',body:JSON.stringify({name,phone,isActive:source.isActive})});await refreshHub(true);toast(`${type} updated.`)}catch(err){toast(err.message)}return}
  if(e.target.closest('[data-v36-toggle]')){try{if(type==='Table')await api(`/api/service/tables/${id}`,{method:'PUT',body:JSON.stringify({name:source.name,isActive:!source.isActive})});else await api(`/api/service/people/${id}`,{method:'PUT',body:JSON.stringify({name:source.name,phone:source.phone,isActive:!source.isActive})});await refreshHub(true);toast(`${type} ${source.isActive?'paused':'activated'}.`)}catch(err){toast(err.message)}}
 });
}

function bookingFields(){
 let box=q('#v36-assignment-fields');if(box)return box;const segment=q('#screen-pos .cart-panel .segment');if(!segment)return null;
 box=document.createElement('section');box.id='v36-assignment-fields';box.className='v36-assignment-fields';
 box.innerHTML=`<label data-v36-for="table">${icons.table}<span>Table <b>*</b></span><select id="v36-table"><option value="">Select table</option></select></label><label data-v36-for="waiter">${icons.waiter}<span>Waiter <b>*</b></span><select id="v36-waiter"><option value="">Assign waiter</option></select></label><label data-v36-for="rider">${icons.rider}<span>Rider <b>*</b></span><select id="v36-rider"><option value="">Assign rider</option></select></label>`;
 segment.after(box);
 q('#v36-table').onchange=e=>{state.tableId=Number(e.target.value)||null;state.tableNumber=state.tableId};
 q('#v36-waiter').onchange=e=>state.waiterId=Number(e.target.value)||null;
 q('#v36-rider').onchange=e=>state.riderId=Number(e.target.value)||null;
 return box;
}
function optionRows(rows,label,kind){return `<option value="">${label}</option>`+(rows||[]).map(x=>{const busy=kind==='waiter'?!x.isActive:(x.booked||!x.isActive),note=kind==='waiter'&&x.booked?` · Serving ${Number(x.tableCount||x.assignments?.length||1)} table(s)`:x.booked?` · Booked MC-${E(x.tokenNumber)}`:!x.isActive?' · Inactive':'';return `<option value="${x.id}" ${busy?'disabled':''}>${E(x.name)}${x.phone?` · ${E(x.phone)}`:''}${note}</option>`}).join('')}
function setSelect(selector,html,value){const el=q(selector);if(!el)return;el.innerHTML=html;if(value&&qa('option',el).some(x=>Number(x.value)===Number(value)&&!x.disabled))el.value=String(value);else el.value=''}
function paintAssignments(){
 bookingFields();setSelect('#v36-table',optionRows(hub.tables,'Select table','table'),state.tableId);setSelect('#v36-waiter',optionRows(hub.waiters,'Assign waiter','waiter'),state.waiterId);setSelect('#v36-rider',optionRows(hub.riders,'Assign rider','rider'),state.riderId);syncAssignmentMode(false);
}
function syncAssignmentMode(clear=true){
 const type=state?.orderType||'Takeaway',dine=type==='Dine-in',delivery=type==='Delivery';bookingFields();qa('[data-v36-for]').forEach(x=>x.hidden=(x.dataset.v36For==='table'||x.dataset.v36For==='waiter')?!dine:!delivery);
 if(clear){if(!dine){state.tableId=null;state.tableNumber=null;state.waiterId=null}if(!delivery)state.riderId=null;}
 q('#v35-table-field')?.setAttribute('hidden','');syncCashBox();
}
function enhanceNoteAndCash(){
 const footer=q('#screen-pos .cart-footer');if(!footer)return;
 let note=q('.note-field',footer);if(note&&!note.dataset.v36){note.dataset.v36='1';note.innerHTML='<span>Order note <small>Optional · order record only</small></span><textarea id="order-note" rows="2" placeholder="No onions, extra sauce, birthday message…"></textarea>'}
 if(!q('#v36-cash-box')){const box=document.createElement('section');box.id='v36-cash-box';box.className='v36-cash-box';box.innerHTML=`<label><span>${icons.cash}<b>Cash received</b></span><div>Rs <input id="v36-cash-received" type="number" min="0" step="1" inputmode="decimal" placeholder="0"></div></label><div id="v36-change"><small>Customer balance</small><strong>Rs 0</strong></div>`;q('#place-order',footer)?.before(box);q('#v36-cash-received').addEventListener('input',updateChange)}
 syncCashBox();
}
function orderTotal(){return Number(String(q('#total')?.textContent||'0').replace(/[^0-9.-]/g,''))||0}
function received(){return Number(q('#v36-cash-received')?.value||0)||0}
function updateChange(){const box=q('#v36-change');if(!box)return;const due=orderTotal(),got=received(),change=got-due;box.classList.toggle('short',got<due);q('small',box).textContent=got<due?'Remaining':'Change to return';q('strong',box).textContent=cash(Math.abs(change))}
function syncCashBox(){const box=q('#v36-cash-box');if(!box)return;box.hidden=state?.payment!=='Cash';updateChange()}
function validateBooking(){
 if(state.orderType==='Delivery'&&!state.riderId){toast('Delivery order ke liye available rider select karein.');q('#v36-rider')?.focus();return false}
 if(state.orderType==='Dine-in'&&!state.tableId){toast('Dine-in order ke liye table select karein.');q('#v36-table')?.focus();return false}
 if(state.orderType==='Dine-in'&&!state.waiterId){toast('Dine-in order ke liye available waiter select karein.');q('#v36-waiter')?.focus();return false}
 if(state.payment==='Cash'&&received()<orderTotal()){toast(`Cash received ${cash(orderTotal())} se kam hai.`);q('#v36-cash-received')?.focus();return false}
 return true;
}
function installApiBridge(){
 if(apiWrapped||typeof api!=='function')return;apiWrapped=true;const oldApi=api;
 api=async function(path,options={}){
  if(path==='/api/orders'&&String(options.method||'GET').toUpperCase()==='POST'&&options.body){try{const body=JSON.parse(options.body);body.tableId=state.orderType==='Dine-in'?(state.tableId||null):null;body.tableNumber=body.tableId;body.waiterId=state.orderType==='Dine-in'?(state.waiterId||null):null;body.riderId=state.orderType==='Delivery'?(state.riderId||null):null;body.cashReceived=state.payment==='Cash'?received():null;body.notes=q('#order-note')?.value?.trim()||null;options={...options,body:JSON.stringify(body)}}catch(e){}}
  return oldApi(path,options);
 };
}

function receiptMode(order){return `<div class="v36-receipt-mode">${modeIcon(order.orderType)}<div><b>${E(order.orderType||'Takeaway')}</b><small>${order.orderType==='Dine-in'?E(order.tableName||`Table ${order.tableNumber||'—'}`):order.orderType==='Delivery'?E(order.riderName||'Rider unassigned'):'Counter pickup'}</small></div></div>`}
function receiptRow(a,b){return `<div class="tp-line"><span>${a}</span><b>${b}</b></div>`}
function receiptHtml(order,kind='customer'){
 if(window.mnahelsV43?.receiptHtml)return window.mnahelsV43.receiptHtml(order,kind);
 const title=kind==='kitchen'?'KITCHEN TICKET':kind==='waiter'?'WAITER ORDER SLIP':'CUSTOMER RECEIPT';
 const items=(order.items||[]).map(x=>`<div class="tp-item"><div><b>${Number(x.quantity||0)}× ${E(x.productName)}</b><small>${E(x.variantName||'Regular')} · ${cash(x.unitPrice)} each</small></div><strong>${cash(x.lineTotal)}</strong></div>`).join('');
 const service=order.orderType==='Dine-in'?`${receiptRow('Table',E(order.tableName||`Table ${order.tableNumber||'—'}`))}${receiptRow('Waiter',E(order.waiterName||'—'))}`:order.orderType==='Delivery'?`${receiptRow('Rider',E(order.riderName||'—'))}${order.deliveryAddress?receiptRow('Address',E(order.deliveryAddress)):''}`:'';
 const note='';
 const money=kind==='kitchen'?'':`<div class="tp-dash"></div>${receiptRow('Subtotal',cash(order.subtotal))}${order.discount?receiptRow('Discount',`- ${cash(order.discount)}`):''}<div class="tp-total"><span>TOTAL</span><b>${cash(order.total)}</b></div>${order.paymentMethod==='Cash'&&order.cashReceived!=null?`${receiptRow('Cash received',cash(order.cashReceived))}${receiptRow('Change',cash(order.changeDue))}`:''}`;
 return `<div class="tp tp-customer v36-receipt"><div class="tp-head"><b>MNAHEL'S CAFE</b><small>${title}</small></div>${receiptMode(order)}<div class="tp-dash"></div>${receiptRow('Order',`MC-${E(order.tokenNumber)}`)}${receiptRow('Customer',E(order.customerName||'Walk-in'))}${service}<div class="tp-dash"></div><div class="tp-th"><span>Item</span><b>${kind==='kitchen'?'Qty':'Amount'}</b></div>${items}${note}${money}<div class="tp-foot"><b>A product by Eastern Cross Technology</b><small>${kind==='waiter'?'Serve and keep with the table.':'Thank you.'}</small></div></div>`;
}
function bridgePrint(type){return new Promise(resolve=>{if(!(window.__mnahelsDualPrintBridge&&window.chrome?.webview?.postMessage)){try{window.print()}catch(e){}resolve(true);return}let done=false;const h=e=>{const m=String(e.data||'');if(m===`mnahels-print-${type}-done`||m===`mnahels-print-${type}-cancelled`){done=true;try{window.chrome.webview.removeEventListener('message',h)}catch(err){}resolve(m.endsWith('-done'))}};try{window.chrome.webview.addEventListener('message',h);window.chrome.webview.postMessage(`mnahels-print-${type}`)}catch(e){resolve(false)}setTimeout(()=>{if(!done)resolve(true)},20000)})}
async function printSlip(order,kind='customer',quiet=false){const sheet=q('#print-sheet');if(!sheet)return false;sheet.removeAttribute('style');const printer=kind==='kitchen'?'kitchen':'customer';sheet.className=`print-sheet tp-sheet ${printer}`;sheet.innerHTML=receiptHtml(order,kind);await new Promise(r=>setTimeout(r,140));const ok=await bridgePrint(printer);if(!quiet)toast(ok?`${kind==='waiter'?'Waiter':kind==='kitchen'?'Kitchen':'Customer'} receipt sent to printer.`:'Printing cancelled.');return ok}
function previewSlip(order,kind){const success=q('#success-dialog'),preview=q('#receipt-preview'),body=q('#receipt-preview-body');if(!preview||!body)return;if(success?.open)success.close();body.innerHTML=receiptHtml(order,kind);preview.showModal()}
async function autoPrintDine(order){
 if(!order||order.orderType!=='Dine-in'||Number(order.id)===lastAutoPrint)return;
 lastAutoPrint=Number(order.id);
 const paid=String(order.paymentStatus||'').toLowerCase()==='paid'||order.isPaid===true;
 await printSlip(order,paid?'paid':'waiter',true);
 await printSlip(order,'kitchen',true);
 toast(`Dine-in booked · ${paid?'paid':'waiter Payment Due'} aur kitchen ki 2 slips print par bhej di gayi.`);
}
function hookGlobals(){
 if(globalsHooked)return;globalsHooked=true;
 if(typeof loadDashboard==='function'){const old=loadDashboard;loadDashboard=async function(force=false){const r=await old(force);await renderOperations(force);return r}}
 if(typeof showOrderComplete==='function'){const old=showOrderComplete;showOrderComplete=function(order){old(order);state.tableId=null;state.tableNumber=null;state.waiterId=null;state.riderId=null;const input=q('#v36-cash-received');if(input)input.value='';updateChange();operationsSignature='';refreshHub(true);setTimeout(()=>autoPrintDine(order),260)}}
}
function boot(){
 if(booted){ensureServiceNav();bookingFields();enhanceNoteAndCash();return}booted=true;ensureServiceNav();bookingFields();enhanceNoteAndCash();installApiBridge();hookGlobals();syncAssignmentMode(false);refreshHub();
 const total=q('#total');if(total)new MutationObserver(updateChange).observe(total,{childList:true,characterData:true,subtree:true});
 document.addEventListener('click',async e=>{
  if(e.target.closest?.('[data-order-type]'))setTimeout(()=>{syncAssignmentMode(true);refreshHub()},0);
  if(e.target.closest?.('[data-payment]'))setTimeout(syncCashBox,0);
  const status=e.target.closest?.('[data-v36-status]');if(status){e.preventDefault();e.stopImmediatePropagation();await updateStatus(status.dataset.id,status.dataset.v36Status,status);return}
  const cancel=e.target.closest?.('[data-v36-cancel]');if(cancel){e.preventDefault();e.stopImmediatePropagation();if(confirm('Cancel this order and release assignments?'))await updateStatus(cancel.dataset.v36Cancel,'Cancelled',cancel);return}
  const print=e.target.closest?.('[data-v36-print]');if(print){e.preventDefault();e.stopImmediatePropagation();const order=orderRows.get(String(print.dataset.id));if(order)await printSlip(order,print.dataset.v36Print);return}
  if(e.target.closest?.('[data-screen="admin"]'))setTimeout(()=>renderOperations(true),100);
  if(e.target.closest?.('#print-customer')){e.preventDefault();e.stopImmediatePropagation();if(state.lastOrder)await printSlip(state.lastOrder,'customer');return}
  if(e.target.closest?.('#print-kitchen')){e.preventDefault();e.stopImmediatePropagation();if(state.lastOrder)await printSlip(state.lastOrder,'kitchen');return}
  if(e.target.closest?.('#preview-customer')){e.preventDefault();e.stopImmediatePropagation();if(state.lastOrder)previewSlip(state.lastOrder,'customer');return}
  if(e.target.closest?.('#preview-kitchen')){e.preventDefault();e.stopImmediatePropagation();if(state.lastOrder)previewSlip(state.lastOrder,'kitchen');return}
 },true);
 document.addEventListener('click',e=>{if(e.target.closest?.('#place-order')&&!validateBooking()){e.preventDefault();e.stopImmediatePropagation()}},true);
 setInterval(()=>{ensureServiceNav();if(state?.user&&state.currentScreen==='service')refreshHub()},10000);
}
setTimeout(boot,520);setTimeout(()=>{boot();refreshHub();if(state?.user?.role==='Admin'&&state.currentScreen==='admin')renderOperations(true)},1350);
window.mnahelsV36={build:BUILD,uiRevision:UI_REVISION,renderOperations,refreshHub,printSlip,openService};
})();
