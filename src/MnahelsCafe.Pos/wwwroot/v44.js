(()=>{
'use strict';
const BUILD='0.15.24',UI_REVISION='20260830-receipt-readability-24';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const DESIGN_KEY='mnahels.pos-design';
const DESIGNS=[
 {id:'amber',label:'Midnight Amber'},
 {id:'slate',label:'Clean Slate'},
 {id:'garden',label:'Olive Kitchen'},
 {id:'copper',label:'Copper Ledger'},
 {id:'neon',label:'Neon Counter'}
];
function cartUnits(){try{return (state?.cart||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0)}catch{return 0}}
function resetItemSearch(){const input=q('#search');if(!input||!input.value)return;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));requestAnimationFrame(()=>{try{input.focus({preventScroll:true})}catch{input.focus()}})}
function watchPossibleAdd(event){
 const target=event.target?.closest?.('[data-v38-variant],.product-card');
 if(!target)return;
 const before=cartUnits();
 setTimeout(()=>{if(cartUnits()>before)resetItemSearch()},120);
}
function markResource(button,on){
 button.classList.add('v44-radio');
 button.setAttribute('role','radio');
 button.setAttribute('aria-checked',String(on));
 button.classList.toggle('selected',on);
 const booked=button.disabled&&!on;
 button.dataset.v44State=booked?'BOOKED':on?'✓':'';
 if(booked){
  const small=q('small',button),text=small?.textContent||'';
  if(small&&!/^BOOKED\b/.test(text))small.textContent=text.replace(/^Booked\b/,'BOOKED')||'BOOKED';
 }
}
function enhanceResources(){
 qa('.v38-resource-grid').forEach(grid=>grid.setAttribute('role','radiogroup'));
 qa('[data-v38-resource]').forEach(button=>markResource(button,button.classList.contains('selected')));
}
function selectOne(kind,id){
 qa(`[data-v38-resource="${kind}"]`).forEach(button=>markResource(button,String(button.dataset.id)===String(id)));
}
function normalizeDesign(value){return DESIGNS.some(item=>item.id===value)?value:'amber'}
function currentDesign(){try{return normalizeDesign(localStorage.getItem(DESIGN_KEY)||'amber')}catch{return'amber'}}
function announce(message){try{if(typeof toast==='function')toast(message)}catch{}}
function applyDesign(value,notify=false){
 const id=normalizeDesign(value),item=DESIGNS.find(entry=>entry.id===id);
 document.documentElement.dataset.posDesign=id;
 document.documentElement.classList.toggle('v44-alt',id!=='amber');
 try{localStorage.setItem(DESIGN_KEY,id)}catch{}
 const select=q('#v44-design-select');if(select&&select.value!==id)select.value=id;
 const picker=q('#v44-design-picker');if(picker){picker.dataset.design=id;picker.title=`Interface design: ${item.label}`}
 if(notify)announce(`${item.label} design applied.`);
 try{document.dispatchEvent(new CustomEvent('mnahels:designchange',{detail:{id,label:item.label}}))}catch{}
 return id;
}
function ensureDesignPicker(){
 const actions=q('.top-actions');if(!actions)return null;
 let picker=q('#v44-design-picker');
 if(!picker){
  picker=document.createElement('label');picker.id='v44-design-picker';picker.className='v44-design-picker';
  picker.innerHTML=`<i aria-hidden="true"></i><span>Design</span><select id="v44-design-select" aria-label="Interface design">${DESIGNS.map((item,index)=>`<option value="${item.id}">${String(index+1).padStart(2,'0')} · ${item.label}</option>`).join('')}</select>`;
  actions.insertBefore(picker,q('.theme-toggle',actions)||actions.firstChild);
  q('#v44-design-select',picker).addEventListener('change',event=>applyDesign(event.target.value,true));
 }
 applyDesign(currentDesign());
 return picker;
}
window.addEventListener('click',event=>{
 watchPossibleAdd(event);
 const resource=event.target?.closest?.('[data-v38-resource]');
 if(resource&&!resource.disabled){const kind=resource.dataset.v38Resource,id=resource.dataset.id,pointerClick=event.detail>0;requestAnimationFrame(()=>{enhanceResources();selectOne(kind,id);if(pointerClick)resource.blur()})}
},true);
window.addEventListener('keydown',event=>{
 if((event.key==='Enter'||event.key===' ')&&event.target?.closest?.('.product-card'))watchPossibleAdd(event);
 if(event.altKey&&!event.ctrlKey&&!event.metaKey&&/^[1-5]$/.test(event.key)){
  const item=DESIGNS[Number(event.key)-1];if(item){event.preventDefault();applyDesign(item.id,true)}
 }
},true);
let scheduled=false;
function scheduleEnhance(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhanceResources();ensureDesignPicker()})}
applyDesign(currentDesign());
if(document.body)new MutationObserver(scheduleEnhance).observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleEnhance);else scheduleEnhance();
document.documentElement.dataset.uiRevision=UI_REVISION;
window.__MNAHELS_UI_REVISION__=UI_REVISION;
window.mnahelsV44={build:BUILD,uiRevision:UI_REVISION,resetItemSearch,enhanceResources,selectOne,designs:DESIGNS,applyDesign,currentDesign};
})();
