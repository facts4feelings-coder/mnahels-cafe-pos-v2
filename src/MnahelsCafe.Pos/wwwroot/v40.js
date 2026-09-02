/*
 * Mnahel's Cafe POS · v0.15.13 Midnight Amber motion, protected database flash and dashboard ranges
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.13',UI_REVISION='20260830-motion-13';
const WIPE_PHRASE='mnahel’s_cafe_wipe_db';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const stats={flights:0,successes:0,contextFocuses:0};
let dashboardRange='today',dashboardDay='',dashboardRows=[],apiHooked=false,renderProductsHooked=null,renderCartHooked=null,addHooked=null,completeHooked=null,salesHooked=null;

function imageFor(name,category=''){
 const text=`${name||''} ${category||''}`.toLowerCase();
 const rules=[
  [/red bull/,'red-bull.png'],[/coca\s*cola/,'coca-cola.png'],[/\b7up\b|\b7 up\b/,'7up.png'],[/pepsi/,'pepsi.png'],[/mineral water|\bwater\b/,'water.png'],
  [/tin pack/,'tin-pack.png'],[/smart deal|special deal|family deal|\bdeals?\b/,'deal.png'],[/russian salad|\bsalad\b/,'salad.png'],[/sauce|extra topping|\bextras?\b/,'sauce.png'],
  [/shawarma|paratha|tortilla|\bwraps?\b/,'wrap.png'],[/pizza|kabab crust|crown crust|force square|lazania/,'pizza.jpg'],[/burger/,'burger.jpg'],
  [/pasta|lasagna/,'pasta.jpg'],[/fries/,'fries.jpg'],[/sandwich/,'sandwich.jpg'],[/broast|wings?|nuggets?|hot shot|chicken/,'chicken.jpg'],
  [/margarita|shake|coffee|drinks?/,'drinks.jpg'],[/lava|cookies?|brownie|desserts?/,'dessert.jpg']
 ];
 return `/assets/food/${(rules.find(([re])=>re.test(text))||[null,'sandwich.jpg'])[1]}`;
}
function productById(id){for(const category of state?.menu||[]){const product=(category.products||[]).find(x=>Number(x.id)===Number(id));if(product)return{product,category}}return null}
function decorateImages(){
 qa('#product-grid .product-card').forEach(card=>{const found=productById(card.dataset.id);if(!found)return;const src=imageFor(found.product.name,found.category.name),media=q('.ma-food-media',card);if(media){media.dataset.v40Image=src;media.style.backgroundImage=`url("${src}")`;card.dataset.v40Image=src}});
 qa('#cart-items .v37-cart-line').forEach((row,index)=>{const item=state?.cart?.[index];if(!item)return;const src=imageFor(item.name),img=q('.v37-cart-thumb',row);if(img&&img.getAttribute('src')!==src){img.src=src;img.dataset.v40Image=src}});
 qa('#admin-orders .v36-food').forEach(tile=>{const src=imageFor(q('strong',tile)?.textContent||tile.title),img=q('img',tile);if(img&&img.getAttribute('src')!==src){img.src=src;img.dataset.v40Image=src}});
}
function hookRenderers(){
 const products=window.renderProducts;if(typeof products==='function'&&products!==renderProductsHooked&&!products.__v40){const wrapped=function(){const out=products.apply(this,arguments);requestAnimationFrame(decorateImages);return out};wrapped.__v40=true;renderProductsHooked=wrapped;window.renderProducts=wrapped}
 const cart=window.renderCart;if(typeof cart==='function'&&cart!==renderCartHooked&&!cart.__v40){const wrapped=function(){const out=cart.apply(this,arguments);requestAnimationFrame(decorateImages);return out};wrapped.__v40=true;renderCartHooked=wrapped;window.renderCart=wrapped}
 decorateImages();
}

function createFlight(source,product){
 if(reduced()||!source)return null;const sourceRect=source.getBoundingClientRect();if(sourceRect.width<8||sourceRect.height<8)return null;
 const size=Math.max(52,Math.min(92,Math.min(sourceRect.width,sourceRect.height))),left=sourceRect.left+(sourceRect.width-size)/2,top=sourceRect.top+(sourceRect.height-size)/2,rect={left,top,width:size,height:size};
 const ghost=document.createElement('div'),src=imageFor(product?.name||'');ghost.className='v40-fly-ghost';ghost.style.cssText=`left:${left}px;top:${top}px;width:${size}px;height:${size}px;background-image:url("${src}")`;document.body.appendChild(ghost);return{ghost,rect};
}
function landFlight(flight,variant){
 if(!flight)return;requestAnimationFrame(()=>{const index=Math.max(0,(state?.cart||[]).findIndex(x=>Number(x.variantId)===Number(variant?.id))),row=qa('#cart-items .v37-cart-line')[index],target=q('.v37-cart-thumb',row)||q('.v37-cart-bag')||q('.cart-head'),tr=target?.getBoundingClientRect();if(!tr){flight.ghost.remove();return}
  const sr=flight.rect,dx=tr.left+tr.width/2-(sr.left+sr.width/2),dy=tr.top+tr.height/2-(sr.top+sr.height/2),scale=Math.max(.18,Math.min(.52,tr.width/sr.width));stats.flights++;
  const animation=flight.ghost.animate([
   {transform:'translate3d(0,0,0) scale(.96)',opacity:.96,offset:0,easing:'cubic-bezier(.42,0,1,1)'},
   {transform:'translate3d(0,-38px,0) scale(1.05)',opacity:1,offset:.3,easing:'cubic-bezier(.17,.84,.25,1)'},
   {transform:`translate3d(${dx*.3}px,${dy*.16-48}px,0) rotate(4deg) scale(.92)`,opacity:.98,offset:.46,easing:'cubic-bezier(.12,.75,.2,1)'},
   {transform:`translate3d(${dx}px,${dy}px,0) rotate(-2deg) scale(${scale})`,opacity:.12,offset:1}
  ],{duration:560,easing:'linear',fill:'forwards'});
  const cleanup=()=>flight.ghost.isConnected&&flight.ghost.remove();animation.onfinish=cleanup;animation.oncancel=cleanup;setTimeout(cleanup,760);
  setTimeout(()=>{try{row?.animate([{transform:'scale(.97)'},{transform:'scale(1.025)',offset:.48},{transform:'scale(1)'}],{duration:360,easing:'cubic-bezier(.34,1.45,.45,1)'})}catch(e){}},390);
 });
}
function hookAdd(){const current=window.add;if(typeof current!=='function'||current===addHooked||current.__v40)return;const wrapped=function(product,variant){const card=q(`#product-grid .product-card[data-id="${product?.id}"]`),source=q('.ma-food-media',card)||card,flight=createFlight(source,product),out=current.apply(this,arguments);landFlight(flight,variant);return out};wrapped.__v40=true;addHooked=wrapped;window.add=wrapped}

function ensureSuccess(){let overlay=q('#v40-order-success');if(overlay)return overlay;overlay=document.createElement('aside');overlay.id='v40-order-success';overlay.setAttribute('aria-live','polite');overlay.innerHTML=`<div class="v40-success-card"><div class="v40-success-burst"><i></i><span>✓</span></div><small>ORDER CONFIRMED</small><h2>Order placed</h2><strong id="v40-success-token">MC-0000</strong><p id="v40-success-meta">Saved successfully</p><b id="v40-success-total">Rs 0</b><div class="v40-confetti">${Array.from({length:14},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div></div>`;document.body.appendChild(overlay);return overlay}
function countTotal(el,total){if(!el)return;const start=performance.now(),duration=720;function frame(now){const p=Math.min(1,(now-start)/duration),v=Math.round(total*(1-Math.pow(1-p,4)));el.textContent=money(v);if(p<1)requestAnimationFrame(frame)}requestAnimationFrame(frame)}
function showSuccess(order){const overlay=ensureSuccess();q('#v40-success-token',overlay).textContent=`MC-${order?.tokenNumber??'—'}`;q('#v40-success-meta',overlay).textContent=`${order?.orderType||'Order'} · ${order?.customerName||'Customer'}`;overlay.classList.remove('show');void overlay.offsetWidth;overlay.classList.add('show');stats.successes++;countTotal(q('#v40-success-total',overlay),Number(order?.total||0));clearTimeout(overlay._hide);overlay._hide=setTimeout(()=>overlay.classList.remove('show'),2500)}
function hookComplete(){const current=window.showOrderComplete;if(typeof current!=='function'||current===completeHooked||current.__v40)return;const wrapped=function(order){const out=current.apply(this,arguments);showSuccess(order);return out};wrapped.__v40=true;completeHooked=wrapped;window.showOrderComplete=wrapped}

function setNavLabel(screen,label){const button=q(`.sidebar nav [data-screen="${screen}"]`);if(!button)return;let node=q('.ma-nav-label',button);if(!node){node=document.createElement('span');node.className='ma-nav-label';button.appendChild(node)}node.textContent=label;button.title=label}
function arrangeNavigation(){const nav=q('.sidebar nav');if(!nav)return;setNavLabel('menu-admin','Menu Manager');setNavLabel('pos','Our Menu');setNavLabel('service','Service Hub');const desired=['admin','pos','shift','sales','customers','service','menu-admin','settings','orders'],nodes=desired.map(x=>q(`[data-screen="${x}"]`,nav)).filter(Boolean),current=[...nav.children].filter(x=>nodes.includes(x));if(nodes.some((x,i)=>current[i]!==x))nodes.forEach(x=>nav.appendChild(x));if(state?.currentScreen==='pos'){const title=q('#page-title'),kicker=q('#page-kicker');if(title)title.textContent='Our Menu';if(kicker)kicker.textContent='FRONT COUNTER'}if(!nav.dataset.v40Observed){nav.dataset.v40Observed='1';new MutationObserver(()=>queueMicrotask(arrangeNavigation)).observe(nav,{childList:true})}}

function decorateContext(){const bar=q('#v38-order-context');if(!bar)return;const signature=bar.textContent;if(bar.dataset.v40Signature===signature)return;bar.dataset.v40Signature=signature;bar.classList.remove('v40-context-focus');void bar.offsetWidth;bar.classList.add('v40-context-focus');stats.contextFocuses++}

function ensureWipeUi(){
 const screen=q('#screen-settings');if(!screen||q('#v40-database-flash')||state?.user?.role!=='Admin')return;
 screen.insertAdjacentHTML('beforeend',`<article id="v40-database-flash" class="panel v40-wipe-card"><div class="v40-wipe-icon">↻</div><div><p class="eyebrow dark">DANGER ZONE</p><h3>Database flash</h3><p>Orders, customers, service staff, tables and menu edits will be wiped. Default menu and four tables return. Accounts, licensing and backup files stay protected.</p></div><button id="v40-open-wipe" type="button">Flash database</button></article>`);
 const dialog=document.createElement('dialog');dialog.id='v40-wipe-dialog';dialog.className='dialog v40-wipe-dialog';dialog.innerHTML=`<form id="v40-wipe-form"><button class="dialog-close" type="button" data-v40-wipe-close>×</button><div class="v40-wipe-mark">!</div><p class="eyebrow dark">IRREVERSIBLE DATABASE RESET</p><h2>Flash all business data?</h2><p>To continue, type this phrase exactly:</p><div class="v40-wipe-phrase"><code>${WIPE_PHRASE}</code><button type="button" data-v40-copy>Copy</button></div><label>Confirmation phrase<input id="v40-wipe-confirmation" autocomplete="off" spellcheck="false" placeholder="Type the phrase here"></label><p id="v40-wipe-match">Phrase does not match.</p><button id="v40-confirm-wipe" class="v40-confirm-wipe" type="submit" disabled>Wipe and restore defaults</button></form>`;document.body.appendChild(dialog);
 const input=q('#v40-wipe-confirmation'),submit=q('#v40-confirm-wipe'),match=q('#v40-wipe-match');
 const sync=()=>{const ok=input.value.trim()===WIPE_PHRASE;submit.disabled=!ok;match.textContent=ok?'Exact phrase matched. Wipe is unlocked.':'Phrase does not match.';match.classList.toggle('matched',ok)};
 q('#v40-open-wipe').onclick=()=>{input.value='';sync();dialog.showModal();setTimeout(()=>input.focus(),100)};q('[data-v40-wipe-close]',dialog).onclick=()=>dialog.close();q('[data-v40-copy]',dialog).onclick=async()=>{try{await navigator.clipboard.writeText(WIPE_PHRASE);toast('Confirmation phrase copied.')}catch(e){input.value=WIPE_PHRASE;sync();input.select()}};input.oninput=sync;
 q('#v40-wipe-form').onsubmit=async event=>{event.preventDefault();if(input.value.trim()!==WIPE_PHRASE)return;submit.disabled=true;submit.textContent='Wiping database…';try{const result=await api('/api/admin/database/wipe',{method:'POST',body:JSON.stringify({confirmation:input.value.trim()})});state.cart=[];state.category='All';state.dashboardSignature='';state.orderSignature='';state.salesSignature='';state.menu=await api('/api/menu');renderCategories();renderProducts();renderCart();dialog.close();try{navigate('pos')}catch(e){q('[data-screen="pos"]')?.click()}toast(result.message||'Database flash complete.')}catch(error){toast(error.message||'Database flash failed.')}finally{submit.textContent='Wipe and restore defaults';input.value='';sync()}};
}

function dayKey(value){const date=new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function dateAtStart(offset=0){const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()+offset);return date}
function filterDashboard(rows){let start=dateAtStart(),end=dateAtStart(1);if(dashboardRange==='yesterday'){start=dateAtStart(-1);end=dateAtStart()}else if(dashboardRange==='week'){start=dateAtStart(-6)}else if(dashboardRange==='month'){start=dateAtStart(-29)}if(dashboardRange==='week'&&dashboardDay)return rows.filter(row=>dayKey(row.createdAt)===dashboardDay);return rows.filter(row=>{const date=new Date(row.createdAt);return date>=start&&date<end})}
function dashboardLabel(){if(dashboardRange==='today')return 'Today';if(dashboardRange==='yesterday')return 'Yesterday';if(dashboardRange==='week')return dashboardDay?new Date(`${dashboardDay}T00:00:00`).toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'short'}):'Last 7 days';return 'Last 30 days'}
function renderDashboardControls(){
 const box=q('#admin-orders'),panel=box?.closest('.panel');if(!box||!panel)return;let controls=q('#v40-dashboard-filter',panel);if(!controls){controls=document.createElement('section');controls.id='v40-dashboard-filter';controls.innerHTML=`<div class="v40-range-head"><div><small>ORDER VIEW</small><strong id="v40-dashboard-period">Today</strong></div><div class="v40-range-buttons"><button data-v40-range="today">Today</button><button data-v40-range="yesterday">Yesterday</button><button data-v40-range="week">7 Days</button><button data-v40-range="month">Month</button></div></div><div id="v40-day-picker" class="v40-day-picker"></div>`;box.before(controls);qa('[data-v40-range]',controls).forEach(button=>button.onclick=()=>{dashboardRange=button.dataset.v40Range;if(dashboardRange!=='week'||button.classList.contains('active'))dashboardDay='';state.dashboardSignature='';renderDashboardControls();window.mnahelsV36?.renderOperations?.(true)})}
 qa('[data-v40-range]',controls).forEach(button=>button.classList.toggle('active',button.dataset.v40Range===dashboardRange));const shown=filterDashboard(dashboardRows).length;q('#v40-dashboard-period',controls).textContent=`${dashboardLabel()} · ${shown} order${shown===1?'':'s'}`;
 const days=q('#v40-day-picker',controls);days.hidden=dashboardRange!=='week';if(dashboardRange==='week'){const parts=[];for(let offset=-6;offset<=0;offset++){const date=dateAtStart(offset),key=dayKey(date),count=dashboardRows.filter(row=>dayKey(row.createdAt)===key).length;parts.push(`<button type="button" data-v40-day="${key}" class="${dashboardDay===key?'active':''}"><span>${date.toLocaleDateString('en',{weekday:'short'})}</span><b>${date.getDate()}</b><small>${count} order${count===1?'':'s'}</small></button>`)}days.innerHTML=parts.join('');qa('[data-v40-day]',days).forEach(button=>button.onclick=()=>{dashboardDay=button.dataset.v40Day;renderDashboardControls();window.mnahelsV36?.renderOperations?.(true)})}
}
function installApiBridge(){if(apiHooked||typeof window.api!=='function')return;apiHooked=true;const previous=window.api;window.api=async function(path,options={}){const result=await previous(path,options);if(String(path).startsWith('/api/orders?take=80')&&state?.currentScreen==='admin'&&Array.isArray(result)){dashboardRows=result.slice();queueMicrotask(renderDashboardControls);return filterDashboard(result)}return result}}
function refreshDashboardFilter(){renderDashboardControls();if(state?.user?.role==='Admin'&&state.currentScreen==='admin')window.mnahelsV36?.renderOperations?.(true)}

function cleanSales(){const metrics=q('#one-metrics');if(metrics){qa('.metric',metrics).forEach(card=>{const label=(q('small',card)?.textContent||'').toLowerCase();if(label.includes('average bill')||label.includes('discount'))card.remove()});metrics.dataset.v40Clean='1'}qa('#one-chart .one-col small,#one-chart .v23-amt').forEach(value=>value.classList.add('v40-chart-value'))}
function hookSales(){const current=window.loadSales;if(typeof current!=='function'||current===salesHooked||current.__v40)return;const wrapped=async function(){const out=await current.apply(this,arguments);cleanSales();return out};wrapped.__v40=true;salesHooked=wrapped;window.loadSales=wrapped;cleanSales()}

function observeDynamic(){if(document.documentElement.dataset.v40Observed)return;document.documentElement.dataset.v40Observed='1';new MutationObserver(mutations=>{let images=false,context=false,sales=false;for(const mutation of mutations){const node=mutation.target;if(node.closest?.('#product-grid,#cart-items,#admin-orders'))images=true;if(node.id==='v38-order-context'||node.closest?.('#v38-order-context'))context=true;if(node.id==='one-metrics'||node.closest?.('#one-metrics,#one-chart'))sales=true;for(const added of mutation.addedNodes){if(added.nodeType!==1)continue;if(added.id==='v38-order-context'||added.querySelector?.('#v38-order-context'))context=true;if(added.matches?.('.product-card,.v37-cart-line,.v36-food')||added.querySelector?.('.product-card,.v37-cart-line,.v36-food'))images=true}}if(images)requestAnimationFrame(decorateImages);if(context)requestAnimationFrame(decorateContext);if(sales)requestAnimationFrame(cleanSales)}).observe(document.body,{childList:true,subtree:true})}
function boot(){document.documentElement.dataset.uiRevision=UI_REVISION;installApiBridge();hookRenderers();hookAdd();hookComplete();hookSales();arrangeNavigation();ensureWipeUi();ensureSuccess();observeDynamic();decorateImages();decorateContext();cleanSales()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));else setTimeout(boot,900);setTimeout(()=>{boot();refreshDashboardFilter()},1600);setTimeout(boot,3100);setInterval(()=>{if(document.visibilityState==='visible'){arrangeNavigation();ensureWipeUi();hookRenderers();hookAdd();hookComplete();hookSales();decorateImages();decorateContext();cleanSales()}},5000);
window.mnahelsV40={build:BUILD,uiRevision:UI_REVISION,wipePhrase:WIPE_PHRASE,imageFor,filterDashboard,renderDashboardControls,showSuccess,motionStats:stats};
})();
