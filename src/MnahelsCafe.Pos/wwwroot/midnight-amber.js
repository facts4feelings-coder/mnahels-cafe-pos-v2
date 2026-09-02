/* Midnight Amber behavior layer — preserves existing POS functions. */
(()=>{
'use strict';
const VERSION='1.2.0';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const later=(fn,ms=0)=>setTimeout(()=>{try{fn()}catch(e){console.warn('[Midnight Amber]',e)}},ms);
const icons={
 admin:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
 pos:'<svg viewBox="0 0 24 24"><path d="M6 3h12l-1 17H7L6 3Z"/><path d="M8 7h8M9 11h6M10 15h4"/></svg>',
 orders:'<svg viewBox="0 0 24 24"><path d="M7 3h10v18l-5-3-5 3V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
 sales:'<svg viewBox="0 0 24 24"><path d="M4 20V10M9 20V5M14 20v-8M19 20V3"/><path d="m3 9 6-5 5 7 6-9"/></svg>',
 reports:'<svg viewBox="0 0 24 24"><path d="M4 20V4h16v16H4Z"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg>',
 customers:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 8a3 3 0 0 1 3 3M17 20v-2a5 5 0 0 0-2-4"/></svg>',
 'menu-admin':'<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
 settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 14.5 21 16l-2 3-2.5-1a8 8 0 0 1-2 1L14 22h-4l-.5-3a8 8 0 0 1-2-1L5 19l-2-3 2-1.5a8 8 0 0 1 0-5L3 8l2-3 2.5 1a8 8 0 0 1 2-1L10 2h4l.5 3a8 8 0 0 1 2 1L19 5l2 3-2 1.5a8 8 0 0 1 0 5Z"/></svg>',
 logout:'<svg viewBox="0 0 24 24"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></svg>'
};
const labels={admin:'Dashboard',pos:'POS',orders:'Orders',sales:'Sales',reports:'Reports',customers:'Customers','menu-admin':'Items',settings:'Setup'};
function relabelNavigation(){
  $$('.sidebar .nav-item').forEach(b=>{
    const key=b.id==='logout'?'logout':b.dataset.screen;
    if(!key||!icons[key]||b.dataset.maNav==='1')return;
    b.dataset.maNav='1'; b.innerHTML=icons[key]+`<span class="ma-nav-label">${labels[key]||'Sign out'}</span>`;
    b.title=labels[key]||'Sign out';
  });
}
function openOrder(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'F2',code:'F2',keyCode:113,which:113,bubbles:true,cancelable:true}))}
function enhanceToolbar(){
  const toolbar=$('#screen-pos .catalog-panel .toolbar'); if(!toolbar)return;
  const input=$('#search',toolbar); if(input)input.placeholder='Search items by name or menu ID...';
  if(!$('#ma-new-order')){const b=document.createElement('button');b.id='ma-new-order';b.className='ma-new-order';b.type='button';b.innerHTML='<span>＋</span> New order <kbd>F2</kbd>';b.onclick=openOrder;toolbar.appendChild(b)}
}
const food=[
 [/pizza|supreme/i,'pizza.jpg'],[/burger|zinger|tower/i,'burger.jpg'],[/pasta|alfredo/i,'pasta.jpg'],[/broast|tikka|boti|chicken/i,'chicken.jpg'],[/fries/i,'fries.jpg'],[/sandwich|club/i,'sandwich.jpg'],[/shake|drink|margarita|coffee|tea|juice/i,'drinks.jpg'],[/cake|dessert|brownie|ice cream/i,'dessert.jpg']
];
function foodFor(text){return (food.find(([r])=>r.test(text))||food[Math.abs([...text].reduce((a,c)=>a+c.charCodeAt(0),0))%food.length])[1]}
function decorateProducts(){
  $$('.product-card').forEach((card,i)=>{
    if(card.dataset.maFood==='1')return; card.dataset.maFood='1'; card.style.setProperty('--i',i);
    const title=$('h4',card)?.textContent||card.textContent||''; const media=document.createElement('div'); media.className='ma-food-media';media.setAttribute('aria-hidden','true');media.style.backgroundImage=`url('/assets/food/${foodFor(title)}')`;card.prepend(media);
  });
}
const copyRules=[
 [/Username ya password sahi nahi\.?/gi,'Incorrect username or password.'],[/Pehle item add karein\.?/gi,'Add an item first.'],[/Cart empty hai\.?/gi,'The cart is empty.'],[/Phone number poore 11 digits ka hona chahiye\.?/gi,'Phone number must contain exactly 11 digits.'],[/Delivery address required hai\.?/gi,'Delivery address is required.'],[/Delivery ke liye name aur address required hai\.?/gi,'Name and address are required for delivery.'],[/Delivery ke liye complete details required hain\.?/gi,'Complete customer details are required for delivery.'],[/Order save nahi hua,? dobara koshish karein\.?/gi,'The order could not be saved. Please try again.'],[/Koi matching menu item nahi mila\.?/gi,'No matching menu item was found.'],[/Cart mein koi item nahi hai\.?/gi,'There are no items in the cart.'],[/From aur To dates select karein\.?/gi,'Select From and To dates.'],[/kisi bhi stage par click karein\.?/gi,'Select any stage to update the order.'],[/Peak hours load nahi ho sake\.?/gi,'Peak hours could not be loaded.'],[/Show receipt preview/gi,'Show receipt preview'],[/Print/gi,'Print'],[/Close/gi,'Close'],[/SHUKRIYA\s*[·-]\s*THANK YOU/gi,'THANK YOU'],[/Har niwala, ek khoobsurat yaad\.?/gi,'Freshly made, served with care.'],[/Aap ka dobara intezaar rahega/gi,'We look forward to serving you again'],[/har 1 minute/gi,'Every minute'],[/har 5 minute/gi,'Every 5 minutes'],[/har 15 minute/gi,'Every 15 minutes'],[/har 30 minute/gi,'Every 30 minutes'],[/har 1 ghanta/gi,'Every hour'],[/har (\d+) ghante/gi,'Every $1 hours'],[/rozana \(24 ghante\)/gi,'Daily (24 hours)'],[/ab tak koi nahi/gi,'None yet']
];
function english(text){let out=text;for(const [r,v] of copyRules)out=out.replace(r,v);return out}
function translate(root=document.body){
  if(!root)return; const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement?.tagName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode); nodes.forEach(n=>{const t=english(n.nodeValue);if(t!==n.nodeValue)n.nodeValue=t});
}
function receiptIcon(type='Takeaway'){
  if(/delivery/i.test(type))return '<svg viewBox="0 0 32 32"><path d="M4 20h16l3-8h4l2 8h-3M8 20V9h10v11M11 25a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM25 25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>';
  if(/dine/i.test(type))return '<svg viewBox="0 0 32 32"><path d="M5 23h22M8 20h16M10 20a6 6 0 0 1 12 0M16 11V8M13 8h6"/></svg>';
  return '<svg viewBox="0 0 32 32"><path d="M9 10h14l2 16H7L9 10ZM12 11V8a4 4 0 0 1 8 0v3"/></svg>';
}
function decorateReceipts(){
  $$('.tp').forEach(tp=>{if(tp.classList.contains('v43-receipt')){tp.querySelector('.ma-receipt-icon')?.remove();tp.dataset.maReceipt='1';return}if(tp.dataset.maReceipt==='1')return;tp.dataset.maReceipt='1';const text=tp.textContent||'';const type=(text.match(/(?:Type|Order type)\s*[:\-]?\s*(Dine-in|Takeaway|Delivery)/i)||[])[1]||'Takeaway';const head=$('.tp-head',tp);if(head){const i=document.createElement('div');i.className='ma-receipt-icon';i.title=type;i.innerHTML=receiptIcon(type);head.prepend(i)}})
}
function updateHeading(screen){const map={admin:['CAFE OVERVIEW','Dashboard'],pos:['FRONT COUNTER','Our Menu'],orders:['LIVE OPERATIONS','Order activity'],sales:['SALES INTELLIGENCE','Sales & Reports'],reports:['BUSINESS REPORTS','Report preview'],customers:['CUSTOMER DIRECTORY','Customers'],'menu-admin':['MENU CONTROL','Menu Manager'],settings:['ADMIN CONTROL','Settings']};const v=map[screen];if(!v)return;const k=$('#page-kicker'),t=$('#page-title');if(k)k.textContent=v[0];if(t)t.textContent=v[1]}
function bindNavigation(){
  $$('.sidebar [data-screen]').forEach(b=>{if(b.dataset.maBound==='1')return;b.dataset.maBound='1';b.addEventListener('click',()=>later(()=>updateHeading(b.dataset.screen),10))});
}
function bindLogin(){const f=$('#login-form');if(!f||f.dataset.maBound==='1')return;f.dataset.maBound='1'}
function boot(){relabelNavigation();enhanceToolbar();decorateProducts();decorateReceipts();bindNavigation();bindLogin();translate();const active=$('.screen.active')?.id?.replace('screen-','');if(active)updateHeading(active)}
let queued=false;const observer=new MutationObserver(records=>{const relevant=records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('.nav-item,.product-card,.tp,.v36-service-person,#screen-service')||node.querySelector?.('.nav-item,.product-card,.tp,.v36-service-person,#screen-service'))));if(!relevant||queued)return;queued=true;later(()=>{queued=false;boot()},120)});observer.observe(document.body,{subtree:true,childList:true});
window.midnightAmber={version:VERSION,receiptIcon,refresh:boot};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>later(boot,80));else later(boot,80);later(boot,500);later(boot,1400);
})();
