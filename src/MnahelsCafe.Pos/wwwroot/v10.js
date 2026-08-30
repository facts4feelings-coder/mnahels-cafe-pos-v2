(()=>{
const input=$('#search'),grid=$('#product-grid'),dialog=$('#variant-dialog');
if(!input||!grid||!dialog)return;
let candidates=[],productIndex=0,armed=false,pendingVariant=false,variantIndex=0;

function visibleCandidates(){
  return $$('#product-grid .product-card').map(card=>{const id=Number(card.dataset.id),item=product(id);return item?{id,name:item.name,card}:null}).filter(Boolean);
}
function paintProducts(updateInput=false){
  candidates.forEach((item,i)=>{
    const selected=!!input.value.trim()&&i===productIndex;
    item.card.classList.toggle('keyboard-selected',selected);
    item.card.classList.toggle('v38-grid-focus',selected);
    if(selected){item.card.style.setProperty('border-color','#f4bf24','important');item.card.style.setProperty('box-shadow','0 0 0 3px rgba(244,191,36,.18),0 15px 30px rgba(0,0,0,.34)','important')}else{item.card.style.removeProperty('border-color');item.card.style.removeProperty('box-shadow')}
    item.card.setAttribute('aria-selected',String(selected));
  });
  const active=candidates[productIndex];
  if(active&&armed&&updateInput){
    input.value=active.name;
    input.select();
  }
  input.classList.toggle('keyboard-armed',armed&&!!active);
  if(active&&input.value.trim())input.setAttribute('aria-activedescendant',`keyboard-product-${active.id}`);
  else input.removeAttribute('aria-activedescendant');
}
function syncCandidates(){
  candidates=visibleCandidates();
  productIndex=Math.min(productIndex,Math.max(0,candidates.length-1));
  candidates.forEach(item=>item.card.id=`keyboard-product-${item.id}`);
  paintProducts(false);
}
function applyProductIcons(){
  $$('#product-grid .product-card').forEach(card=>{
    const id=Number(card.dataset.id),item=product(id),category=state.menu.find(c=>c.products.some(p=>p.id===id));
    const icon=card.querySelector('.product-icon');
    if(icon)icon.textContent=item?.icon||category?.icon||'🍽️';
  });
}
const previousRenderProducts=renderProducts;
renderProducts=function(){previousRenderProducts();applyProductIcons();if(!armed)syncCandidates()};
input.oninput=()=>{
  armed=false;
  pendingVariant=false;
  productIndex=0;
  renderProducts();
};

function resetToSearch(){
  pendingVariant=false;
  armed=false;
  productIndex=0;
  input.value='';
  renderProducts();
  requestAnimationFrame(()=>{input.focus();input.setSelectionRange(0,0)});
}
function focusVariant(index=0){
  const options=$$('#variant-options .variant-option');
  if(!options.length)return;
  variantIndex=(index+options.length)%options.length;
  options.forEach((option,i)=>{
    const selected=i===variantIndex;
    option.classList.toggle('keyboard-selected',selected);
    option.setAttribute('aria-selected',String(selected));
  });
  options[variantIndex].focus({preventScroll:true});
}
function activateProduct(){
  const selected=candidates[productIndex];
  if(!selected)return;
  const item=product(selected.id);
  if(!item)return;
  pendingVariant=item.variants.length>1;
  choose(selected.id);
  if(pendingVariant)requestAnimationFrame(()=>focusVariant(0));
  else resetToSearch();
}
function moveProduct(step){
  if(candidates.length<2)return;
  armed=true;
  productIndex=(productIndex+step+candidates.length)%candidates.length;
  paintProducts(true);
}
input.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
    if(!input.value.trim()||!candidates.length)return;
    event.preventDefault();
    if(candidates.length>1)moveProduct(event.key==='ArrowRight'?1:-1);else{armed=true;productIndex=0;paintProducts(true)}
    return;
  }
  if(event.key!=='Enter')return;
  if(!input.value.trim())return;
  event.preventDefault();
  if(!candidates.length){toast('No matching menu item was found.');return}
  if(candidates.length>1&&!armed){
    armed=true;
    productIndex=0;
    paintProducts(true);
    return;
  }
  activateProduct();
});

dialog.addEventListener('keydown',event=>{
  if(!pendingVariant)return;
  const options=$$('#variant-options .variant-option');
  if(!options.length)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();
    event.stopPropagation();
    focusVariant(variantIndex+(event.key==='ArrowDown'?1:-1));
  }else if(event.key==='Enter'){
    event.preventDefault();
    event.stopPropagation();
    options[variantIndex].click();
  }else if(event.key==='Escape'){
    pendingVariant=false;
    setTimeout(()=>input.focus(),0);
  }
});
dialog.addEventListener('click',event=>{
  if(pendingVariant&&event.target.closest('.variant-option'))setTimeout(resetToSearch,0);
});

input.setAttribute('aria-controls','product-grid');
input.setAttribute('aria-autocomplete','list');
input.title='Enter: select/add · Left/Right: switch item · Up/Down: switch size';
document.addEventListener('click',event=>{if(event.target.closest('[data-screen="pos"]'))setTimeout(()=>input.focus(),80)});

const clearableSelector='input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]),textarea';
function updateClearState(field){field.closest('.input-clear-wrap')?.classList.toggle('has-value',field.value.length>0)}
function installClearButtons(root=document){
  const fields=[];
  if(root.matches?.(clearableSelector))fields.push(root);
  fields.push(...(root.querySelectorAll?.(clearableSelector)||[]));
  fields.forEach(field=>{
    if(field.closest('.input-clear-wrap')){updateClearState(field);return}
    const wrap=document.createElement('div');wrap.className='input-clear-wrap';
    field.parentNode.insertBefore(wrap,field);wrap.appendChild(field);
    const clear=document.createElement('button');clear.type='button';clear.className='field-clear';clear.textContent='×';clear.tabIndex=-1;clear.setAttribute('aria-label',`Clear ${field.getAttribute('aria-label')||field.name||field.id||'field'}`);
    clear.onclick=event=>{event.preventDefault();event.stopPropagation();field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));field.focus()};
    wrap.appendChild(clear);field.addEventListener('input',()=>updateClearState(field));field.addEventListener('change',()=>updateClearState(field));updateClearState(field);
  });
}
installClearButtons();
new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)installClearButtons(node)}))).observe(document.body,{childList:true,subtree:true});

const discount=$('#discount');
if(discount?.value==='0')discount.value='';
const placeOrder=$('#place-order');
if(placeOrder?.onclick&&!placeOrder.dataset.blankDiscount){
  const originalPlaceOrder=placeOrder.onclick;placeOrder.dataset.blankDiscount='true';
  placeOrder.onclick=async function(event){const result=await originalPlaceOrder.call(this,event);if(!state.cart.length&&discount){discount.value='';updateClearState(discount)}return result};
}

const foodIcons=[['🍕','Pizza'],['🍔','Burger'],['🍝','Pasta'],['🍗','Chicken'],['🍖','BBQ'],['🥩','Steak'],['🍟','Fries'],['🥪','Sandwich'],['🌯','Wrap'],['🥤','Drink'],['🍰','Dessert'],['🍪','Cookie'],['🥗','Salad'],['🌶️','Sauce'],['🧀','Cheese'],['🍱','Deal'],['🍲','Bowl'],['🍽️','Other food']];
function ensureIconPicker(){
  if($('#edit-product-icon'))return;
  const two=$('.drawer-two');if(!two)return;
  const field=document.createElement('fieldset');field.className='product-icon-picker';
  field.innerHTML=`<legend>Product icon</legend><input id="edit-product-icon" type="hidden" value="🍽️"><div>${foodIcons.map(([icon,label])=>`<button type="button" data-food-icon="${icon}" title="${label}" aria-label="${label}"><span>${icon}</span><small>${label}</small></button>`).join('')}</div>`;
  two.after(field);$$('[data-food-icon]').forEach(button=>button.onclick=()=>selectProductIcon(button.dataset.foodIcon));
}
function selectProductIcon(icon){
  ensureIconPicker();$('#edit-product-icon').value=icon||'🍽️';
  $$('[data-food-icon]').forEach(button=>button.classList.toggle('selected',button.dataset.foodIcon===$('#edit-product-icon').value));
}
async function syncProductIcon(){
  ensureIconPicker();const id=Number($('#edit-product-id')?.value||0),categoryId=Number($('#edit-category')?.value||0);let icon='';
  if(id){try{const menu=await api('/api/admin/menu');for(const category of menu){const item=category.products.find(p=>p.id===id);if(item){icon=item.icon||category.icon;break}}}catch{}}
  if(!icon)icon=state.menu.find(category=>category.id===categoryId)?.icon||'🍽️';
  selectProductIcon(icon);
}
const baseApi=api;
api=async function(path,options={}){
  const method=(options.method||'GET').toUpperCase(),drawer=$('#menu-drawer-backdrop');
  if((method==='POST'||method==='PUT')&&/^\/api\/products(?:\/\d+)?$/.test(path)&&drawer?.classList.contains('open')&&options.body){
    try{const body=JSON.parse(options.body);body.icon=$('#edit-product-icon')?.value||null;options={...options,body:JSON.stringify(body)}}catch{}
  }
  return baseApi(path,options);
};
ensureIconPicker();
$('#edit-category')?.addEventListener('change',()=>{if(!Number($('#edit-product-id')?.value||0))selectProductIcon(state.menu.find(c=>c.id===Number($('#edit-category').value))?.icon||'🍽️')});
const drawer=$('#menu-drawer-backdrop');
if(drawer)new MutationObserver(()=>{if(drawer.classList.contains('open'))setTimeout(()=>{syncProductIcon();installClearButtons(drawer);$$('.input-clear-wrap').forEach(w=>{const field=w.querySelector('input,textarea');if(field)updateClearState(field)})},30)}).observe(drawer,{attributes:true,attributeFilter:['class']});

function productIconByName(name){for(const category of state.menu){const item=category.products.find(p=>p.name===name);if(item)return item.icon||category.icon}return'🍽️'}
function decorateDashboard(){
  $$('#admin-orders .mini-order').forEach(row=>row.classList.add('recent-order-card'));
  $$('#top-items>div').forEach(row=>{
    if(row.classList.contains('top-item-polished'))return;const label=row.firstElementChild,text=label?.textContent||'',match=text.match(/^(.*)\s·\s(\d+)$/);if(!label||!match)return;
    row.classList.add('top-item-polished');const name=match[1],count=match[2];label.className='top-item-head';label.innerHTML=`<span class="top-item-name"><i>${productIconByName(name)}</i><strong>${esc(name)}</strong></span><b>${count} sold</b>`;
  });
}
const adminScreen=$('#screen-admin');if(adminScreen)new MutationObserver(decorateDashboard).observe(adminScreen,{childList:true,subtree:true});
setTimeout(()=>{if(state.user&&state.currentScreen==='pos')input.focus();syncCandidates();applyProductIcons();decorateDashboard()},700);
})();
