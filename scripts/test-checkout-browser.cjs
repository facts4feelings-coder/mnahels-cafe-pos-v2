/* Real Edge + HTTP + owned temporary SQLite. Transport assertions are not a
 * substitute for physical printer or complete click-through checkout acceptance. */
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require('playwright');
const timeout=setTimeout(()=>{console.error('Checkout browser tests exceeded four minutes');process.exit(1)},240000);timeout.unref();
(async()=>{
 const f=await require('./fixtures/cafe-server.cjs')();let browser,passed=false;const pages={},checks=[],errors=[];
 const count=()=>f.sql([['SELECT COUNT(*) FROM Orders',[]]])[0][0][0];
 const submit=(page,path,body,method='POST')=>page.evaluate(async({path,body,method})=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,body:await r.json()}},{path,body,method});
 const raw=async(path,body,headers,method='POST')=>{const r=await fetch(f.base+'/api'+path,{method,headers:{Cookie:f.cookies.Cashier,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return{status:r.status,body:await r.json()}};
 const cart=async(page,id,price)=>page.evaluate(({id,price})=>{const p=state.menu.flatMap(c=>c.products).find(p=>p.variants.some(v=>v.id===id)),v=p.variants.find(v=>v.id===id);state.cart=[{variantId:id,name:p.name,variant:v.name,price,quantity:2}];window.renderCart()},{id,price});
 try{
  await f.api('Cashier','/shifts/open','POST',{openingCash:1000});
  const menu=await f.api('Admin','/menu');
  const created=await f.api('Admin','/products','POST',{categoryId:menu[0].id,name:'QA Checkout Price',isActive:true,isAvailable:true,variants:[{name:'Regular',price:321.25}]});
  let product=(await f.api('Admin','/admin/menu')).flatMap(c=>c.products).find(p=>p.id===created.id),variant=product.variants[0];
  async function change(price,available=true){product={...product,isAvailable:available,variants:product.variants.map(v=>({...v,price}))};await f.api('Admin','/products/'+product.id,'PUT',product)}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const role of ['Admin','Cashier']){
   const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-PK',timezoneId:'Asia/Karachi'}),i=f.cookies[role].indexOf('=');
   await context.addCookies([{name:f.cookies[role].slice(0,i),value:f.cookies[role].slice(i+1),url:f.base,httpOnly:true}]);
   const page=pages[role]=await context.newPage();page.on('pageerror',e=>errors.push({role,error:e.message}));page.on('dialog',d=>d.dismiss());
   await page.goto(f.base+'/?screen=pos',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>state.user&&window.cafeCatalog?.stamp&&state.menu.length>0,null,{timeout:30000});
   await cart(page,variant.id,321.25);
  }
  const payload={items:[{variantId:variant.id,quantity:2}],orderType:'Takeaway',payNow:true,paymentMethod:'Card',discount:17.5};
  await change(444.5);
  for(const page of Object.values(pages))await page.waitForFunction(id=>state.menu.flatMap(c=>c.products).find(p=>p.variants.some(v=>v.id===id))?.variants.find(v=>v.id===id)?.price===444.5,variant.id,{timeout:20000});
  const initial=count();
  for(const [role,page] of Object.entries(pages)){
   assert.equal(await page.evaluate(()=>state.cart[0].price),321.25);
   for(const route of ['/orders','/orders/book']){const r=await submit(page,route,payload);assert.equal(r.status,409,role+' '+route);assert.equal(r.body.code,'CART_PRICE_CHANGED')}
  }
  assert.equal(count(),initial);checks.push('Both roles and both booking endpoints reject stale prices without writing an order');
  // A changed price is never auto-accepted: explicitly review the draft here.
  for(const [role,page] of Object.entries(pages)){
   await cart(page,variant.id,444.5);
   await page.evaluate(()=>{const input=document.querySelector('#discount');input.value='2';input.dispatchEvent(new Event('input',{bubbles:true}))});
   const shown=await page.evaluate(()=>({discount:window.mnahelsV39.discountAmount(),total:Number(document.querySelector('#total').textContent.replace(/[^0-9.]/g,''))}));
   const reviewed=await submit(page,'/orders/book',{...payload,discount:shown.discount});assert.equal(reviewed.status,200);assert.equal(shown.discount,18);assert.equal(reviewed.body.total,shown.total);assert.equal(shown.total,871);
   for(const payNow of [true,false])for(const paymentMethod of ['Cash','Card','Online']){
    const r=await submit(page,'/orders/book',{...payload,payNow,paymentMethod,cashReceived:1000});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.total,871.5);assert.equal(r.body.items[0].unitPrice,444.5);assert.equal(r.body.paymentStatus,payNow?'Paid':'Unpaid');if(payNow&&paymentMethod==='Cash')assert.equal(r.body.changeDue,128.5);
   }
  }
  checks.push('Displayed UI total equals saved total after explicit review; discount, cash change and paid/unpaid status match for both roles and Cash/Card/Online');
  // Exercise the real application API wrappers and actual topping checkbox handler.
  const quotes=[];
  for(const [role,page] of Object.entries(pages)){
   const quote=await page.evaluate(()=>{const options=state.menu.flatMap(c=>c.products).flatMap(p=>p.variants.map(v=>({variantId:v.id,name:p.name,variant:v.name,price:v.price,quantity:2})));const item=options.find(x=>window.mnahelsV52.toppingFor(x));if(!item)throw Error('No topping-capable pizza');state.cart=[item];window.renderCart();const checkbox=document.querySelector('.v52-topping-check input');if(!checkbox)throw Error('Topping checkbox missing');checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));return{itemId:item.variantId,topping:item.extraToppingQuote,total:window.mnahelsV52.subtotal()-window.mnahelsV52.discountAmount()}});
   const order=await page.evaluate(async itemId=>window.api('/api/orders/book',{method:'POST',body:JSON.stringify({items:[{variantId:itemId,quantity:2}],orderType:'Takeaway',payNow:false,discount:0})}),quote.itemId);
   assert.equal(order.items.length,2);assert.equal(order.total,quote.total);quotes.push({role,...quote});
  }
  const topping=(await f.api('Admin','/admin/menu')).flatMap(c=>c.products).find(p=>p.variants.some(v=>v.id===quotes[0].topping.variantId));
  await f.api('Admin','/products/'+topping.id,'PUT',{...topping,variants:topping.variants.map(v=>({...v,price:v.price+11}))});
  const toppingCount=count();
  for(const quote of quotes){const page=pages[quote.role];await page.evaluate(()=>window.cafeCatalog.check(true));assert.equal(await page.evaluate(()=>state.cart[0].extraToppingQuote.price),quote.topping.price);const failure=await page.evaluate(async itemId=>{try{await window.api('/api/orders/book',{method:'POST',body:JSON.stringify({items:[{variantId:itemId,quantity:2}],orderType:'Takeaway',payNow:false,discount:0})});return null}catch(e){return e.message}},quote.itemId);assert.match(failure,/Menu price badal/)}
  assert.equal(count(),toppingCount);await f.api('Admin','/products/'+topping.id,'PUT',topping);for(const page of Object.values(pages))await cart(page,variant.id,444.5);
  checks.push('Actual API wrappers and topping checkbox preserve quoted totals and reject changed topping prices');
  await change(444.5,false);const n=count();
  for(const page of Object.values(pages)){const r=await submit(page,'/orders/book',payload);assert.equal(r.status,409);assert.equal(r.body.code,'ITEM_UNAVAILABLE')}
  assert.equal(count(),n);checks.push('Unavailable items rejected with no order creation');await change(444.5);
  const saved=await submit(pages.Cashier,'/orders/book',{...payload,payNow:false});assert.equal(saved.status,200);
  await change(500);
  const edit=await submit(pages.Cashier,'/orders/'+saved.body.id,{items:payload.items,discount:17.5},'PUT');assert.equal(edit.status,409);assert.equal(edit.body.code,'CART_PRICE_CHANGED');
  const paid=await submit(pages.Cashier,'/orders/'+saved.body.id+'/payment',{paymentMethod:'Card',completeOrder:true});assert.equal(paid.status,200);assert.equal(paid.body.total,871.5);
  const duplicate=await submit(pages.Cashier,'/orders/'+saved.body.id+'/payment',{paymentMethod:'Card'});assert.equal(duplicate.status,409);
  checks.push('Stale amendment rejected; later payment retains saved total and duplicate payment is rejected');
  const epoch=(await f.api('Cashier','/menu/revision')).epoch;
  const malformed=await raw('/orders/book',payload,{'X-Cafe-Epoch':epoch,'X-Cafe-Cart':'not-json'});assert.equal(malformed.status,400);assert.equal(malformed.body.code,'CART_REVIEW_REQUIRED');
  const wrongEpoch=await raw('/orders/'+saved.body.id+'/status',{status:'Cancelled'},{'X-Cafe-Epoch':'old-epoch'},'PUT');assert.equal(wrongEpoch.status,409);assert.equal(wrongEpoch.body.code,'DATABASE_CHANGED');
  checks.push('Malformed expected-price data and stale-epoch order actions fail closed');
  // Simulated network interruption: the actual browser must not submit or erase the draft.
  const offlineCount=count();await pages.Cashier.context().setOffline(true);
  await assert.rejects(submit(pages.Cashier,'/orders/book',payload));assert.equal(await pages.Cashier.evaluate(()=>state.cart.length),1);await pages.Cashier.context().setOffline(false);assert.equal(count(),offlineCount);checks.push('Offline transport does not create an order or erase the cart');
  // Sample all currently visible navigation destinations in both themes. This is
  // navigation/JS smoke coverage, not every dialog or pixel-comparison acceptance.
  fs.mkdirSync('reports/browser',{recursive:true});
  for(const [role,page] of Object.entries(pages))for(const theme of ['light','dark']){
   await page.evaluate(theme=>window.setTheme(theme),theme);
   const screens=await page.locator('.sidebar [data-screen]:visible').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.screen))]);
   for(const screen of screens){const button=page.locator('.sidebar [data-screen="'+screen+'"]:visible').first();await button.click();await page.waitForTimeout(250);assert(await page.locator('.screen.active').count()>0,role+' '+screen)}
   await page.evaluate(()=>window.navigate('pos'));await page.screenshot({path:'reports/browser/checkout-'+role+'-'+theme+'.png',fullPage:true});
  }
  checks.push('Visible navigation smoke-tested in light/dark for both roles (not full all-screen acceptance)');
  // Restore changes epoch while dialogs and running edit context exist.
  const backup=await f.api('Admin','/backup/run','POST',{});
  for(const page of Object.values(pages))await page.evaluate(id=>{state.v56EditingOrderId=id;document.querySelector('#variant-dialog')?.showModal()},saved.body.id);
  await f.api('Admin','/backup/restore','POST',{name:backup.name});const restored=(await f.api('Cashier','/menu/revision')).epoch;
  for(const page of Object.values(pages)){await page.waitForFunction(epoch=>window.cafeCatalog?.stamp?.epoch===epoch,restored,{timeout:30000});assert.equal(await page.evaluate(()=>state.cart.length),0);assert.equal(await page.evaluate(()=>Boolean(state.v56EditingOrderId)),false);assert.equal(await page.locator('dialog[open]').count(),0)}
  assert.equal(f.sql([['PRAGMA foreign_key_check',[]]])[0].length,0);checks.push('Restore invalidates draft, editing context and open variant dialog in both sessions');
  assert.equal(errors.length,0,JSON.stringify(errors));checks.push('No uncaught JavaScript errors');
  passed=true;console.log('PASS checkout browser: '+checks.join('; '));
 }finally{
  fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/v61-checkout-tests.json',JSON.stringify({checks,errors,complete:passed},null,2));
  if(browser)await browser.close();await f.close();clearTimeout(timeout);
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1});
