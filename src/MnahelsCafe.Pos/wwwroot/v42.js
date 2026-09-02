(()=>{
'use strict';
const BUILD='0.15.25',UI_REVISION='20260901-cashier-speed-25';
const q=(selector,root=document)=>root.querySelector(selector),qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const trackingIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/><path d="m3 8 6-4 6 7 6-5"/></svg>';
let categoryObserver=null;

function currentUser(){return typeof state!=='undefined'?state.user:null}
function isCashier(){return String(currentUser()?.role||'').toLowerCase()==='cashier'}
function setNavLabel(button,label,icon){
 if(!button)return;
 if(icon){const existing=q(':scope>svg,:scope>span:not(.ma-nav-label)',button);if(existing)existing.remove();button.insertAdjacentHTML('afterbegin',icon)}
 let node=q('.ma-nav-label',button);if(!node){node=document.createElement('span');node.className='ma-nav-label';button.append(node)}
 node.textContent=label;button.title=label;
}
function restoreNav(nav){qa(':scope>.nav-item',nav).forEach(button=>{if(button.dataset.v42Hidden){button.style.removeProperty('display');delete button.dataset.v42Hidden}})}
function trackingTitle(){if(!isCashier()||typeof state==='undefined'||state.currentScreen!=='admin')return;const kicker=q('#page-kicker'),title=q('#page-title');if(kicker)kicker.textContent='LIVE OPERATIONS';if(title)title.textContent='Order Tracking'}
function syncNavigation(){
 const user=currentUser(),nav=q('.sidebar nav');document.documentElement.classList.toggle('v42-cashier',isCashier());if(!user||!nav)return;
 const dashboard=q('[data-screen="admin"]',nav),menu=q('[data-screen="pos"]',nav),shift=q('[data-screen="shift"]',nav),service=q('[data-screen="service"]',nav);
 restoreNav(nav);
 if(isCashier()){
  qa(':scope>.nav-item',nav).forEach(button=>{const keep=button===dashboard||button===menu||button===shift||button===service;if(!keep){button.dataset.v42Hidden='1';button.style.setProperty('display','none','important')}});
  if(dashboard){dashboard.style.setProperty('display','flex','important');setNavLabel(dashboard,'Order Tracking',trackingIcon)}
  if(menu){menu.style.setProperty('display','flex','important');setNavLabel(menu,'Our Menu')}
  if(shift){shift.style.setProperty('display','flex','important');setNavLabel(shift,'Shift Details')}
  if(service){service.style.setProperty('display','flex','important');setNavLabel(service,'Service Hub')}
  trackingTitle();
 }else{
  if(dashboard)setNavLabel(dashboard,'Dashboard');if(menu)setNavLabel(menu,'Our Menu');
 }
}
async function openTracking(){
 if(!isCashier())return;
 state.currentScreen='admin';qa('.screen').forEach(screen=>screen.classList.remove('active'));q('#screen-admin')?.classList.add('active');qa('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.screen==='admin'));trackingTitle();state.dashboardSignature='';
 try{if(typeof loadDashboard==='function')await loadDashboard(true);else await window.mnahelsV36?.renderOperations?.(true)}catch(error){console.warn('[v42 tracking]',error)}
}
function categoryIcon(name){if(name==='All')return'✦';const row=(typeof state!=='undefined'?state.menu:[]).find(category=>category.name===name);return row?.icon||'•'}
function enhanceCategories(){
 const box=q('#categories');if(!box)return;const buttons=qa(':scope>.category',box);box.style.setProperty('--v42-category-count',String(Math.max(1,buttons.length)));
 buttons.forEach(button=>{const name=button.dataset.c||button.textContent.trim();if(button.dataset.v42Category===name)return;const icon=document.createElement('span'),label=document.createElement('span');icon.className='v42-category-icon';label.className='v42-category-name';icon.textContent=categoryIcon(name);label.textContent=name;button.replaceChildren(icon,label);button.dataset.v42Category=name;button.title=name});
}
function hookCategories(){
 if(typeof renderCategories==='function'&&!renderCategories.__v42){const previous=renderCategories,wrapped=function(){const result=previous.apply(this,arguments);requestAnimationFrame(enhanceCategories);return result};wrapped.__v42=true;renderCategories=wrapped}
 const box=q('#categories');if(box&&!categoryObserver){categoryObserver=new MutationObserver(enhanceCategories);categoryObserver.observe(box,{childList:true});enhanceCategories()}
}
function clearProductFocus(){qa('#product-grid .product-card.v38-grid-focus,#product-grid .product-card.keyboard-selected').forEach(card=>{card.classList.remove('v38-grid-focus','keyboard-selected');card.style.removeProperty('border-color');card.style.removeProperty('box-shadow')})}
function markProductFocus(card){if(!card)return;card.classList.add('v38-grid-focus');card.style.setProperty('border-color','#f4bf24','important');card.style.setProperty('box-shadow','0 0 0 3px rgba(244,191,36,.18),0 15px 30px rgba(0,0,0,.34)','important')}
function focusProduct(card){if(!card)return;clearProductFocus();markProductFocus(card);try{card.focus({preventScroll:true})}catch{card.focus()}card.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'})}
function visibleProducts(){return qa('#product-grid .product-card').filter(card=>card.offsetWidth&&card.offsetHeight)}
function editableTarget(target){return target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]')}
window.addEventListener('focusin',event=>{const field=editableTarget(event.target);if(field&&field.id!=='search')clearProductFocus()},true);
window.addEventListener('keydown',event=>{
 const arrows=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'],field=editableTarget(event.target);
 if(field&&field.id!=='search'){clearProductFocus();return}
 if(!field&&arrows.includes(event.key))requestAnimationFrame(()=>markProductFocus(document.activeElement?.closest?.('#product-grid .product-card')));
},true);
window.addEventListener('click',event=>{const tracking=event.target.closest?.('.sidebar nav [data-screen="admin"]');if(tracking&&isCashier()){event.preventDefault();event.stopImmediatePropagation();openTracking()}},true);

function boot(){document.documentElement.dataset.uiRevision=UI_REVISION;syncNavigation();hookCategories();trackingTitle()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,100));else setTimeout(boot,100);
setTimeout(boot,600);setTimeout(boot,1500);setInterval(()=>{if(document.visibilityState!=='visible')return;syncNavigation();hookCategories()},5000);
window.mnahelsV42={build:BUILD,uiRevision:UI_REVISION,syncNavigation,enhanceCategories,openTracking};
})();
