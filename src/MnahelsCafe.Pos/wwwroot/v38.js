/*
 * Mnahel's Cafe POS · v0.15.11 five-column menu and guided order setup
 * Copyright (c) 2026 TechMint Software Solutions. All rights reserved.
 * A product by TechMint Software Solutions.
 */
window.__v38OrderSetup=true;
(()=>{
'use strict';
const BUILD='0.15.11',UI_REVISION='20260830-flow-11';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=v=>`Rs ${Number(v||0).toLocaleString('en-PK')}`;
const svg=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const icons={
 takeaway:svg('<path d="M6 8h12l-1 13H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 12h6"/>'),
 dine:svg('<path d="M5 3v8M3 3v5c0 2 4 2 4 0V3M5 11v10M15 3v18M15 3c4 2 4 7 0 9"/>'),
 delivery:svg('<path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>'),
 table:svg('<path d="M4 10h16M6 10l-1 11M18 10l1 11M8 6h8v4H8z"/>'),
 waiter:svg('<circle cx="12" cy="6" r="3"/><path d="M7 21v-5c0-4 2-6 5-6s5 2 5 6v5M9 13h6"/>'),
 rider:svg('<circle cx="12" cy="6" r="3"/><path d="M8 21l2-7-3-3 5-2 4 3 3 1M10 14l5 2 2 5"/>'),
 customer:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>'),
 phone:svg('<path d="M7 3h3l1 5-2 1c1 3 3 5 6 6l1-2 5 1v3c0 2-2 4-4 4C9 20 4 15 3 7c0-2 2-4 4-4Z"/>'),
 edit:svg('<path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4"/>'),
 check:svg('<path d="m5 12 4 4L19 6"/>')
};
const modeIcon=mode=>mode==='Dine-in'?icons.dine:mode==='Delivery'?icons.delivery:icons.takeaway;
let resources={riders:[],waiters:[],tables:[]},proposedToken=1000,draft={},editing=false,hooked=false,gridIndex=-1;
const defaultName=token=>`Customer_${token}`;
const defaultPhone=token=>`0300${String(Number(token)||1000).padStart(7,'0').slice(-7)}`;
function productById(id){for(const category of state.menu||[]){const found=(category.products||[]).find(x=>Number(x.id)===Number(id));if(found)return found}return null}
function ensureDialog(){
 let dialog=q('#v38-order-setup');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='v38-order-setup';dialog.className='v38-order-setup';dialog.innerHTML=`<div class="v38-setup-shell"><header><div class="v38-setup-brand"><span>${icons.check}</span><div><small>GUIDED ORDER</small><h2>Start a new order</h2></div></div><div class="v38-setup-steps"><i class="active">1</i><b></b><i>2</i></div><button type="button" data-v38-close aria-label="Close">×</button></header><main id="v38-setup-body"></main><footer id="v38-setup-footer"></footer></div>`;q('#print-sheet')?.before(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close()});return dialog;
}
function loading(){q('#v38-setup-body').innerHTML='<div class="v38-setup-loading"><i></i><strong>Preparing the next order…</strong><small>Checking tables and available team members</small></div>';q('#v38-setup-footer').innerHTML=''}
async function loadSetupData(){
 const [hubResult,tokenResult]=await Promise.allSettled([api('/api/service-hub'),api('/api/orders/next-token')]);
 if(hubResult.status==='fulfilled')resources={riders:hubResult.value.riders||[],waiters:hubResult.value.waiters||[],tables:hubResult.value.tables||[]};
 if(tokenResult.status==='fulfilled'&&Number(tokenResult.value?.tokenNumber))proposedToken=Number(tokenResult.value.tokenNumber);
}
function renderMode(){
 const dialog=ensureDialog(),steps=qa('.v38-setup-steps i',dialog);steps[0].classList.add('active');steps[1].classList.remove('active');
 const body=q('#v38-setup-body');body.innerHTML=`<section class="v38-mode-step"><div class="v38-step-copy"><small>STEP 1 OF 2</small><h3>How will this order be served?</h3><p>Choose once. The relevant table, waiter or rider will be collected next.</p></div><div class="v38-mode-grid"><button type="button" data-v38-mode="Takeaway"><span>${icons.takeaway}</span><div><strong>Takeaway</strong><small>Counter pickup</small></div><i>→</i></button><button type="button" data-v38-mode="Dine-in"><span>${icons.dine}</span><div><strong>Dine-in</strong><small>Table service</small></div><i>→</i></button><button type="button" data-v38-mode="Delivery"><span>${icons.delivery}</span><div><strong>Delivery</strong><small>Assign a rider</small></div><i>→</i></button></div><p class="v38-key-hint">← → move · Enter select · Esc close</p></section>`;
 body.scrollTop=0;q('#v38-setup-footer').innerHTML='<span>Order details stay outside the cart, keeping checkout compact.</span>';
 requestAnimationFrame(()=>q('[data-v38-mode]',dialog)?.focus());
}
function resourceRows(kind,rows,selected){
 const icon=kind==='table'?icons.table:kind==='waiter'?icons.waiter:icons.rider;
 return `<div class="v38-resource-grid">${(rows||[]).map((x,i)=>{const busy=!!(x.booked||x.occupied||!x.isActive),on=Number(selected)===Number(x.id);return `<button type="button" class="v38-resource ${on?'selected':''}" data-v38-resource="${kind}" data-id="${x.id}" ${busy&&!on?'disabled':''} style="--resource-i:${i}"><span>${icon}</span><div><strong>${E(x.name||`${kind} ${x.id}`)}</strong><small>${busy&&!on?`Booked${x.tokenNumber?` · MC-${E(x.tokenNumber)}`:''}`:x.phone?E(x.phone):on?'Selected':'Available'}</small></div>${on?icons.check:'<i>○</i>'}</button>`}).join('')||'<p class="v38-none">No available options. Add them in Service Hub.</p>'}</div>`;
}
function assignmentMarkup(){
 if(draft.mode==='Dine-in')return `<div class="v38-assignment-columns"><section><div class="v38-section-title"><span>${icons.table}</span><div><strong>Select table</strong><small>Required for dine-in</small></div></div>${resourceRows('table',resources.tables,draft.tableId)}</section><section><div class="v38-section-title"><span>${icons.waiter}</span><div><strong>Assign waiter</strong><small>Available floor team</small></div></div>${resourceRows('waiter',resources.waiters,draft.waiterId)}</section></div>`;
 if(draft.mode==='Delivery')return `<section class="v38-rider-section"><div class="v38-section-title"><span>${icons.rider}</span><div><strong>Assign delivery rider</strong><small>Booked riders are unavailable</small></div></div>${resourceRows('rider',resources.riders,draft.riderId)}</section>`;
 return `<div class="v38-takeaway-note"><span>${icons.takeaway}</span><div><strong>Counter pickup</strong><small>No table or team assignment is needed.</small></div></div>`;
}
function autoInput(input,value){if(!input)return;input.dataset.autoValue=value;input.dataset.auto=input.value===value?'1':'0';input.addEventListener('focus',()=>{if(input.dataset.auto==='1'){input.value='';input.dataset.auto='0'}});input.addEventListener('blur',()=>{if(!input.value.trim()){input.value=input.dataset.autoValue;input.dataset.auto='1'}});input.addEventListener('input',()=>input.dataset.auto=input.value===input.dataset.autoValue?'1':'0')}
function renderDetails(){
 const dialog=ensureDialog(),steps=qa('.v38-setup-steps i',dialog);steps[0].classList.add('active');steps[1].classList.add('active');
 const name=draft.name||defaultName(proposedToken),phone=draft.phone||defaultPhone(proposedToken),address=draft.address||'';
 const body=q('#v38-setup-body');body.innerHTML=`<section class="v38-detail-step"><div class="v38-selected-mode"><span>${modeIcon(draft.mode)}</span><div><small>MC-${proposedToken}</small><strong>${E(draft.mode)}</strong></div><button type="button" data-v38-back>Change</button></div>${assignmentMarkup()}<section class="v38-customer-setup"><div class="v38-section-title"><span>${icons.customer}</span><div><strong>Customer details</strong><small>Safe defaults are already matched to MC-${proposedToken}; click a default to replace it.</small></div></div><div class="v38-customer-fields"><label><span>Customer name</span><input id="v38-customer-name" value="${E(name)}" autocomplete="off"></label><label><span>Phone number</span><input id="v38-customer-phone" value="${E(phone)}" inputmode="numeric" maxlength="11" autocomplete="off"></label>${draft.mode==='Delivery'?`<label class="v38-address"><span>Delivery address <b>*</b></span><input id="v38-delivery-address" value="${E(address)}" placeholder="House, street, area" autocomplete="street-address"></label>`:''}</div></section></section>`;
 body.scrollTop=0;q('#v38-setup-footer').innerHTML='<button type="button" class="v38-back" data-v38-back>← Back</button><div><small>Next: add menu items</small><button type="button" class="v38-start" data-v38-start>Start order <b>→</b></button></div>';
 autoInput(q('#v38-customer-name'),defaultName(proposedToken));autoInput(q('#v38-customer-phone'),defaultPhone(proposedToken));
 q('#v38-customer-phone')?.addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,11));
 requestAnimationFrame(()=>q('.v38-resource:not(:disabled),#v38-customer-name',dialog)?.focus());
}
function modeSelect(mode){draft.mode=mode;draft.tableId=null;draft.waiterId=null;draft.riderId=null;const button=q(`[data-v38-mode="${mode}"]`);button?.classList.add('chosen');setTimeout(renderDetails,180)}
function setResource(kind,id){draft.name=q('#v38-customer-name')?.value||draft.name;draft.phone=q('#v38-customer-phone')?.value||draft.phone;draft.address=q('#v38-delivery-address')?.value||draft.address;id=Number(id)||null;if(kind==='table')draft.tableId=id;if(kind==='waiter')draft.waiterId=id;if(kind==='rider')draft.riderId=id;renderDetails()}
function selectedResource(kind,id){const rows=kind==='table'?resources.tables:kind==='waiter'?resources.waiters:resources.riders;return (rows||[]).find(x=>Number(x.id)===Number(id))}
function setField(selector,value){const input=q(selector);if(input)input.value=value||''}
function renderContext(){
 const toolbar=q('#screen-pos .catalog-panel .toolbar');if(!toolbar)return;let bar=q('#v38-order-context');if(!bar){bar=document.createElement('section');bar.id='v38-order-context';toolbar.after(bar)}
 const service=draft.mode==='Dine-in'?`${selectedResource('table',draft.tableId)?.name||'Table'} · ${selectedResource('waiter',draft.waiterId)?.name||'Waiter'}`:draft.mode==='Delivery'?selectedResource('rider',draft.riderId)?.name||'Rider':'Counter pickup';
 bar.innerHTML=`<span class="v38-context-token">MC-${proposedToken}</span><span class="v38-context-mode">${modeIcon(draft.mode)}<b>${E(draft.mode)}</b></span><span class="v38-context-customer">${icons.customer}<span><b>${E(draft.name)}</b><small>${E(draft.phone)}</small></span></span><span class="v38-context-service">${draft.mode==='Dine-in'?icons.table:draft.mode==='Delivery'?icons.rider:icons.takeaway}<b>${E(service)}</b></span><button type="button" data-v38-edit>${icons.edit}<span>Edit</span></button>`;
 const head=q('#screen-pos .cart-head');if(head){const title=q('h3',head),label=q('.eyebrow',head);if(title){title.textContent=`MC-${proposedToken}`;title.dataset.v38Locked='1'}if(label)label.textContent=`${draft.mode} · ${service}`}
}
function commitSetup(){
 const name=q('#v38-customer-name')?.value.trim()||defaultName(proposedToken),phone=(q('#v38-customer-phone')?.value||'').replace(/\D/g,'')||defaultPhone(proposedToken),address=q('#v38-delivery-address')?.value.trim()||'';
 if(draft.mode==='Dine-in'&&!draft.tableId)return toast('Dine-in order ke liye available table select karein.');
 if(draft.mode==='Dine-in'&&!draft.waiterId)return toast('Dine-in order ke liye available waiter select karein.');
 if(draft.mode==='Delivery'&&!draft.riderId)return toast('Delivery order ke liye available rider select karein.');
 if(draft.mode==='Delivery'&&!address){toast('Delivery address required hai.');q('#v38-delivery-address')?.focus();return}
 draft.name=name;draft.phone=phone;draft.address=address;state.orderType=draft.mode;state.tableId=draft.mode==='Dine-in'?draft.tableId:null;state.tableNumber=state.tableId;state.waiterId=draft.mode==='Dine-in'?draft.waiterId:null;state.riderId=draft.mode==='Delivery'?draft.riderId:null;state.v38ProposedToken=proposedToken;state.v38SetupDone=true;
 qa('#screen-pos [data-order-type]').forEach(x=>x.classList.toggle('active',x.dataset.orderType===draft.mode));setField('#customer-name',name);setField('#customer-phone',phone);setField('#delivery-address',draft.mode==='Delivery'?address:'');q('#customer-suggestions')?.classList.remove('show');
 if(!editing){state.cart=[];q('#discount')&&(q('#discount').value=0);q('#order-note')&&(q('#order-note').value='');q('#v36-cash-received')&&(q('#v36-cash-received').value='');renderCart()}
 renderContext();const screen=q('#screen-pos');screen?.classList.add('v35-booking-open','v38-ready');document.documentElement.classList.add('v35-booking-active');ensureDialog().close();const focusSearch=()=>{const search=q('#search');if(!search)return;search.focus({preventScroll:true});try{search.select()}catch(e){}};requestAnimationFrame(focusSearch);setTimeout(focusSearch,80);setTimeout(focusSearch,220);
}
async function openSetup(edit=false){
 const dialog=ensureDialog();editing=!!edit;const legacyWizard=q('#order-wizard');if(legacyWizard?.open)legacyWizard.close();const legacyVariant=q('#variant-dialog');if(legacyVariant?.open)legacyVariant.close();if(state.currentScreen!=='pos'){try{navigate('pos')}catch(e){q('[data-screen="pos"]')?.click()}}
 if(!dialog.open)dialog.showModal();loading();if(edit&&state.v38SetupDone){proposedToken=Number(state.v38ProposedToken)||proposedToken;draft={mode:state.orderType||'Takeaway',tableId:state.tableId||null,waiterId:state.waiterId||null,riderId:state.riderId||null,name:q('#customer-name')?.value||defaultName(proposedToken),phone:q('#customer-phone')?.value||defaultPhone(proposedToken),address:q('#delivery-address')?.value||''}}
 await loadSetupData();if(!dialog.open)return;if(!edit){draft={mode:'',tableId:null,waiterId:null,riderId:null,name:defaultName(proposedToken),phone:defaultPhone(proposedToken),address:''};renderMode()}else renderDetails();
}
function resetContext(){q('#v38-order-context')?.remove();q('#screen-pos')?.classList.remove('v38-ready');state.v38SetupDone=false;const title=q('#screen-pos .cart-head h3');if(title){title.textContent='Current order';delete title.dataset.v38Locked}}
function enhanceCards(){
 qa('#product-grid .product-card').forEach((card,index)=>{const p=productById(card.dataset.id);if(!p)return;card.dataset.v38Index=String(index);card.setAttribute('aria-label',`${p.name}. ${p.variants.length>1?'Choose size':'Add item'}`);if(q('.v38-card-hint',card))return;const hint=document.createElement('span');hint.className='v38-card-hint';hint.innerHTML=p.variants.length>1?'<b>Choose size</b><small>Enter or click</small>':'<b>Add item</b><small>Enter or click</small>';card.append(hint);if(p.variants.length>1){const panel=document.createElement('span');panel.className='v38-variant-panel';panel.innerHTML=`<strong>${E(p.name)}</strong><small>↑ ↓ choose · Enter add</small><span class="v38-variant-list">${p.variants.slice(0,4).map((v,i)=>`<span role="button" data-v38-variant="${v.id}" data-v38-option-index="${i}"><b>${E(v.name)}</b><em>${cash(v.price)}</em></span>`).join('')}</span>`;card.append(panel)}});
}
function closeVariants(except=null){qa('.product-card.v38-variants-open').forEach(card=>{if(card!==except){card.classList.remove('v38-variants-open');qa('[data-v38-variant]',card).forEach(x=>x.classList.remove('active'))}})}
function setVariantIndex(card,index){const rows=qa('[data-v38-variant]',card);if(!rows.length)return;index=(index+rows.length)%rows.length;rows.forEach((x,i)=>x.classList.toggle('active',i===index));card.dataset.v38VariantIndex=String(index)}
function openInlineVariants(id){const p=productById(id),card=q(`.product-card[data-id="${id}"]`);if(!p||!card)return;if(p.variants.length<=1){add(p,p.variants[0]);return}closeVariants(card);card.classList.add('v38-variants-open');setVariantIndex(card,0);setGridFocus(card)}
function addVariant(card,variantId){const p=productById(card.dataset.id),variant=p?.variants?.find(v=>Number(v.id)===Number(variantId));if(!p||!variant)return;add(p,variant);card.classList.remove('v38-variants-open');try{card.animate([{transform:'scale(.96)'},{transform:'scale(1.035)',offset:.6},{transform:'scale(1)'}],{duration:320,easing:'cubic-bezier(.34,1.56,.44,1)'})}catch(e){}}
function cards(){return qa('#product-grid .product-card').filter(x=>x.offsetWidth&&x.offsetHeight)}
function columns(){const grid=q('#product-grid');if(!grid)return 5;return Math.max(1,getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)}
function setGridFocus(card){if(!card)return;qa('.product-card.v38-grid-focus').forEach(x=>x.classList.remove('v38-grid-focus'));card.classList.add('v38-grid-focus');const list=cards();gridIndex=Math.max(0,list.indexOf(card));try{card.focus({preventScroll:true})}catch(e){card.focus()}card.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})}
function moveGrid(delta){const list=cards();if(!list.length)return;let index=gridIndex>=0?gridIndex:Math.max(0,list.indexOf(document.activeElement));if(index<0)index=0;setGridFocus(list[Math.max(0,Math.min(list.length-1,index+delta))])}
function hookGlobals(){
 if(hooked)return;hooked=true;choose=openInlineVariants;const oldRender=renderProducts;renderProducts=function(){const out=oldRender.apply(this,arguments);gridIndex=-1;requestAnimationFrame(enhanceCards);return out};const oldComplete=showOrderComplete;showOrderComplete=function(order){oldComplete(order);resetContext()};enhanceCards();
}
function boot(){ensureDialog();hookGlobals();enhanceCards();if(state?.v38SetupDone)renderContext();const legacy=q('#variant-dialog');if(legacy?.open)legacy.close()}
document.addEventListener('click',event=>{
 const close=event.target.closest?.('[data-v38-close]');if(close){ensureDialog().close();return}
 const mode=event.target.closest?.('[data-v38-mode]');if(mode){event.preventDefault();modeSelect(mode.dataset.v38Mode);return}
 const back=event.target.closest?.('[data-v38-back]');if(back){event.preventDefault();draft.name=q('#v38-customer-name')?.value||draft.name;draft.phone=q('#v38-customer-phone')?.value||draft.phone;draft.address=q('#v38-delivery-address')?.value||draft.address;renderMode();return}
 const resource=event.target.closest?.('[data-v38-resource]');if(resource){event.preventDefault();setResource(resource.dataset.v38Resource,resource.dataset.id);return}
 if(event.target.closest?.('[data-v38-start]')){event.preventDefault();commitSetup();return}
 if(event.target.closest?.('[data-v38-edit]')){event.preventDefault();openSetup(true);return}
 const option=event.target.closest?.('[data-v38-variant]');if(option){event.preventDefault();event.stopImmediatePropagation();addVariant(option.closest('.product-card'),option.dataset.v38Variant);return}
 const card=event.target.closest?.('#product-grid .product-card');if(card){gridIndex=cards().indexOf(card)}else if(!event.target.closest?.('#product-grid'))closeVariants();
},true);
document.addEventListener('keydown',event=>{
 const field=event.target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]');if(field&&field.id!=='search')return;
 const dialog=q('#v38-order-setup');if(dialog?.open){const mode=event.target.closest?.('[data-v38-mode]');if(mode&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();const list=qa('[data-v38-mode]',dialog),i=list.indexOf(mode),next=list[(i+(event.key==='ArrowRight'?1:-1)+list.length)%list.length];next.focus()}return}
 const active=document.activeElement;
 if(active===q('#search')){if(event.key==='ArrowDown'){event.preventDefault();setGridFocus(cards()[0])}return}
 const card=active?.closest?.('#product-grid .product-card')||q('#product-grid .product-card.v38-grid-focus');
 if(!card)return
 if(card.classList.contains('v38-variants-open')){const rows=qa('[data-v38-variant]',card),current=Number(card.dataset.v38VariantIndex||0);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopImmediatePropagation();setVariantIndex(card,current+(event.key==='ArrowDown'?1:-1));return}if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();addVariant(card,rows[current]?.dataset.v38Variant);return}if(event.key==='Escape'){event.preventDefault();card.classList.remove('v38-variants-open');return}if(event.key==='ArrowLeft'||event.key==='ArrowRight')card.classList.remove('v38-variants-open')}
 const key=event.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(key))return;event.preventDefault();event.stopImmediatePropagation();if(key==='Enter'||key===' '){openInlineVariants(card.dataset.id);return}const step=columns();moveGrid(key==='ArrowLeft'?-1:key==='ArrowRight'?1:key==='ArrowUp'?-step:step);
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,120));else setTimeout(boot,120);setTimeout(boot,600);setTimeout(boot,1500);
window.mnahelsV38={build:BUILD,uiRevision:UI_REVISION,openSetup,renderContext,enhanceCards};
})();
