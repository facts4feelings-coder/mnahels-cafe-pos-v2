(()=>{
const Q={index:0,lastCount:0};
function addQuantityHelp(){const help=$('#ow-help>div');if(!help||help.dataset.quantityHelp)return;help.dataset.quantityHelp='1';help.insertAdjacentHTML('beforeend','<span>Select cart item</span><kbd>Alt + ↑ / ↓</kbd><span>Decrease / increase</span><kbd>Alt + ← / →</kbd><span>Remove cart item</span><kbd>Alt + Delete</kbd>')}
function decorateCart(){const rows=$$('.ow-cart-row'),count=state.cart.length;if(count>Q.lastCount)Q.index=count-1;Q.lastCount=count;Q.index=Math.max(0,Math.min(Q.index,count-1));rows.forEach((row,i)=>{row.classList.toggle('quantity-selected',i===Q.index);row.setAttribute('aria-selected',i===Q.index?'true':'false');row.onclick=()=>{Q.index=i;decorateCart()}});addQuantityHelp()}
function selectedItem(){return state.cart[Q.index]}
function updateQuantity(change){const item=selectedItem();if(!item)return toast('There are no items in the cart.');item.quantity=Math.max(1,item.quantity+change);renderCart()}
function removeSelected(){if(!selectedItem())return toast('There are no items in the cart.');state.cart.splice(Q.index,1);Q.index=Math.max(0,Math.min(Q.index,state.cart.length-1));renderCart()}
const previousRenderCart=renderCart;renderCart=function(){previousRenderCart();requestAnimationFrame(decorateCart)};
document.addEventListener('keydown',e=>{if(!$('#order-wizard')?.open||$('#variant-dialog')?.open||!e.altKey)return;const keys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete'];if(!keys.includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='ArrowUp'||e.key==='ArrowDown'){if(!state.cart.length)return toast('There are no items in the cart.');Q.index=(Q.index+(e.key==='ArrowDown'?1:-1)+state.cart.length)%state.cart.length;decorateCart();$('.ow-cart-row.quantity-selected')?.scrollIntoView({block:'nearest'});return}if(e.key==='ArrowRight')updateQuantity(1);if(e.key==='ArrowLeft')updateQuantity(-1);if(e.key==='Delete')removeSelected()},true);
const setup=setInterval(()=>{if($('#order-wizard')){decorateCart();clearInterval(setup)}},100);setTimeout(()=>clearInterval(setup),10000);
})();
