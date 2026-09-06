/* Actual user-control regression: real Edge + HTTP + isolated SQLite.
 * Data setup/cleanup, persisted theme preferences and the final window.print
 * boundary are test-controlled. Theme-switch controls are not covered here.
 * This is not native WebView2, physical printing, JPG or pixel-perfect acceptance. */
'use strict';
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require('playwright');
const report={scope:'UI clicks in Edge; temporary database; persisted light/dark preferences; window.print capture only',checks:[],bookings:[],errors:[],complete:false};
let stage='fixture',f,browser,activePage;
const watchdog=setTimeout(()=>{console.error('UI workflow tests exceeded six minutes at '+stage);process.exit(1)},360000);watchdog.unref();
const money=text=>Number(String(text).replace(/[^0-9.-]/g,''));
const count=()=>f.sql([['SELECT COUNT(*) FROM Orders',[]]])[0][0][0];
async function mutation(page,method,path,action,status=200){
 const [r]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api'+path&&r.request().method()===method,{timeout:15000}),action()]);
 assert.equal(r.status(),status,method+' '+path);
 // Rejected login is deliberately not consumed by app.js; Edge may discard its
 // body. Status plus the login/UI assertions are the contract, not that body.
 if(path.startsWith('/auth/'))return null;
 const text=await r.text();return text?JSON.parse(text):null;
}
async function login(page,role){
 await page.locator('#username').fill(f.credentials[role].username);await page.locator('#password').fill(f.credentials[role].password);
 await mutation(page,'POST','/auth/login',()=>page.locator('#login-form button.primary').click());
 await page.waitForFunction(role=>state.user?.role===role&&window.cafeCatalog?.stamp&&state.menu.length>0&&window.mnahelsV41&&window.mnahelsV64,role,{timeout:30000});
 assert.equal((await page.locator('#user-role').textContent()).trim(),role);
}
async function theme(page,value){assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),value);assert.equal(await page.evaluate(()=>localStorage.getItem('mnahels-theme')),value)}
async function live(page,id,predicate){await page.waitForFunction(({id,predicate})=>{
 const p=state.menu.flatMap(c=>c.products).find(p=>p.id===id);
 if(predicate.absent)return !p;if(predicate.unavailable)return !p||p.isAvailable===false;
 return p&&p.name===predicate.name&&p.variants.some(v=>v.price===predicate.price);
},{id,predicate},{timeout:20000})}
async function startOrder(page,mode){
 report.lastAction='Open '+mode+' guided setup';
 await page.keyboard.press('F2');await page.locator('#v38-order-setup[open] [data-v38-mode="'+mode+'"]').click();
 await page.locator('[data-v38-start]').waitFor({state:'visible'});
 if(mode==='Dine-in'){
  assert.equal(await page.locator('#v38-order-setup #v38-customer-name').count(),0);
  assert.equal(await page.locator('#v38-order-setup [data-v38-resource="waiter"]').count(),0);
  await page.locator('#v38-order-setup [data-v38-resource="table"]:not(:disabled)').first().click();
 }else{
  await page.locator('#v38-customer-name').fill('QA UI Customer');await page.locator('#v38-customer-phone').fill('03001234567');
  if(mode==='Delivery')await page.locator('#v38-delivery-address').fill('QA isolated delivery address');
 }
 report.lastAction='Submit '+mode+' guided setup';
 report.setupBeforeSubmit=await page.evaluate(()=>Object.fromEntries(['v38-customer-name','v38-customer-phone','v38-delivery-address'].map(id=>[id,document.getElementById(id)?.value??null])));
 await page.locator('[data-v38-start]').click();await page.waitForFunction(()=>state.v38SetupDone&&!document.querySelector('#v38-order-setup').open);
 assert.equal(await page.evaluate(()=>state.orderType),mode);
}
async function addTwo(page,product){
 report.lastAction='Search and open product sizes';await page.locator('#search').fill(product.name);
 await page.locator('#product-grid .product-card[data-id="'+product.id+'"]').click();
 report.lastAction='Click the first Regular-size option';await page.locator('#product-grid [data-v38-variant="'+product.variants[0].id+'"]').click();
 await page.waitForFunction(id=>state.cart.find(x=>x.variantId===id)?.quantity===1,product.variants[0].id);
 // Exercise the actual quantity control rather than racing a second size popup
 // against post-add search/grid reset. Rapid repeat-picker behavior is separate.
 report.lastAction='Increase cart quantity using the plus button';
 await page.locator('#cart-items .cart-line[data-variant-id="'+product.variants[0].id+'"] [data-a="+"]').click();
 await page.waitForFunction(id=>state.cart.find(x=>x.variantId===id)?.quantity===2,product.variants[0].id);
 report.lastAction='Cart quantity two confirmed';
}
async function settlePrints(page,expected){
 await page.waitForFunction(n=>window.__qaPrints.length>=n&&window.mnahelsV64.status.pendingJobs===0,expected,{timeout:15000});
 await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__qaPrints.length),expected,'No duplicate automatic print calls');
}
async function finishBookingUi(page){
 if(await page.locator('#success-dialog').evaluate(d=>d.open))await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#v40-order-success.show'),null,{timeout:10000});
}
async function run(){
 f=await require('./fixtures/cafe-server.cjs')();
 // Guarantee a disposable dining resource, independent of the initial seed.
 const hub=await f.api('Admin','/service-hub');if(!hub.tables.some(t=>t.isActive&&!t.booked))await f.api('Admin','/service/tables','POST',{name:'QA UI isolated table'});
 browser=await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync('reports/browser',{recursive:true});
 for(const appearance of ['light','dark']){
  const pages={},contexts=[];
  for(const role of ['Admin','Cashier']){
   const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-PK',timezoneId:'Asia/Karachi'});contexts.push(context);
   await context.addInitScript(require('./fixtures/ui-field-trace.cjs'));
   await context.addInitScript(appearance=>{
    localStorage.setItem('mnahels-theme',appearance);
    localStorage.setItem('mnahels.receipt-auto-jpg','0');localStorage.setItem('mnahels.receipt-auto-jpg-restored-v39','1');
    window.__qaPrints=[];window.print=()=>{const s=document.querySelector('#print-sheet');window.__qaPrints.push({type:s?.classList.contains('kitchen')?'kitchen':'customer',text:s?.textContent||''})};
   },appearance);
   const page=pages[role]=activePage=await context.newPage();page.setDefaultTimeout(15000);
   page.on('pageerror',e=>report.errors.push({role,appearance,error:e.message}));
   page.on('dialog',async d=>{if(d.type()==='confirm'&&/^Archive QA UI /.test(d.message()))await d.accept();else{report.errors.push({role,appearance,unexpectedDialog:d.message()});await d.dismiss()}});
   stage=appearance+' '+role+' login';await page.goto(f.base+'/?screen=pos',{waitUntil:'domcontentloaded'});
   if(role==='Admin'&&appearance==='light'){
    await page.locator('#username').fill('qa_admin');await page.locator('#password').fill('deliberately-wrong');
    await mutation(page,'POST','/auth/login',()=>page.locator('#login-form button.primary').click(),401);
    assert.equal(await page.locator('#login-screen').isVisible(),true);report.checks.push('Wrong password rejected by actual login form');
   }
   await login(page,role);await theme(page,appearance);
   if(role==='Admin'&&appearance==='light'){
    stage='closed shift F2 and real opening cash';const before=count();await page.keyboard.press('F2');
    await page.locator('#v46-start-dialog[open]').waitFor({state:'visible'});assert.equal(await page.locator('#v38-order-setup[open]').count(),0);assert.equal(count(),before);
    await page.locator('#v46-opening').fill('1000');await mutation(page,'POST','/shifts/open',()=>page.locator('#v46-start-form button[type="submit"]').click());
    await page.locator('#v46-start-dialog[open]').waitFor({state:'hidden'});report.checks.push('Closed-shift F2 blocks setup; real Start Shift form succeeds');
   }
  }
  const admin=pages.Admin,cashier=pages.Cashier;activePage=admin;stage=appearance+' Menu Manager';
  await admin.locator('.sidebar [data-screen="menu-admin"]').click();await admin.locator('#screen-menu-admin.active').waitFor();
  // The final Midnight Amber heading capitalizes Manager; both layers name this screen.
  assert.equal((await admin.locator('#page-title').textContent()).trim().toLowerCase(),'menu manager');
  await admin.locator('#add-menu-item').click();await admin.locator('#menu-drawer-backdrop.open').waitFor();
  assert.equal((await admin.locator('#drawer-title').textContent()).trim(),'Add product');
  const categories=await admin.locator('#edit-category option').evaluateAll(xs=>xs.map(x=>x.value));assert(categories.length>=2);
  const originalName='QA UI '+appearance+' Item',name='QA UI '+appearance+' Renamed';
  await admin.locator('#edit-product-name').fill(originalName);await admin.locator('#edit-product-description').fill('Disposable UI regression item');
  await admin.locator('#variant-editor .variant-name').fill('Regular');await admin.locator('#variant-editor .variant-price').fill('120');
  await admin.locator('#add-variant').click();await admin.locator('#variant-editor .variant-name').nth(1).fill('Large');await admin.locator('#variant-editor .variant-price').nth(1).fill('240');
  const created=await mutation(admin,'POST','/products',()=>admin.locator('#menu-item-form button[type="submit"]').click());
  await admin.locator('#menu-drawer-backdrop.open').waitFor({state:'hidden'});const id=created.id;assert(id>0);
  await live(cashier,id,{name:originalName,price:120});
  await admin.locator('[data-edit-product="'+id+'"]').click();assert.equal((await admin.locator('#drawer-title').textContent()).trim(),'Edit product');
  await admin.locator('#edit-product-name').fill(name);await admin.locator('#edit-category').selectOption(categories[1]);await admin.locator('#variant-editor .variant-price').first().fill('135');
  await mutation(admin,'PUT','/products/'+id,()=>admin.locator('#menu-item-form button[type="submit"]').click());
  await admin.locator('#menu-drawer-backdrop.open').waitFor({state:'hidden'});await live(cashier,id,{name,price:135});
  let menu=await f.api('Admin','/admin/menu');assert(menu.find(c=>String(c.id)===categories[1]).products.some(p=>p.id===id));
  for(const available of ['false','true']){
   await admin.locator('[data-edit-product="'+id+'"]').click();await admin.locator('#edit-available').selectOption(available);
   await mutation(admin,'PUT','/products/'+id,()=>admin.locator('#menu-item-form button[type="submit"]').click());
   await admin.locator('#menu-drawer-backdrop.open').waitFor({state:'hidden'});await live(cashier,id,available==='false'?{unavailable:true}:{name,price:135});
  }
  await mutation(admin,'DELETE','/products/'+id,()=>admin.locator('[data-toggle-product="'+id+'"]').click());await live(cashier,id,{absent:true});
  await admin.locator('[data-toggle-product="'+id+'"]:text-is("Restore")').waitFor();
  await mutation(admin,'PUT','/products/'+id,()=>admin.locator('[data-toggle-product="'+id+'"]').click());await live(cashier,id,{name,price:135});
  await admin.screenshot({path:'reports/browser/ui-menu-'+appearance+'.png',fullPage:true});
  report.checks.push(appearance+': Menu Manager headings; create two sizes, rename, move category, price, availability, archive/restore and live Cashier propagation');
  menu=await f.api('Admin','/admin/menu');const product=menu.flatMap(c=>c.products).find(p=>p.id===id);assert.equal(product.variants[0].price,135);
  for(const role of ['Admin','Cashier']){
   const page=activePage=pages[role];await page.locator('.sidebar [data-screen="pos"]').first().click();
   for(const mode of ['Takeaway','Dine-in','Delivery'])for(const method of ['Cash','Card','Online']){
    // Each method gets a paid booking. Cash also gets the Pay Later + real payment-dialog path.
    for(const payNow of method==='Cash'?[true,false]:[true]){
     stage=[appearance,role,mode,method,payNow?'Pay Now':'Pay Later'].join(' / ');
     await startOrder(page,mode);await addTwo(page,product);await page.locator('#discount').fill('10');await page.locator('#order-note').fill('QA UI workflow note');
     await page.waitForFunction(()=>Number(document.querySelector('#total').textContent.replace(/[^0-9.]/g,''))===243);
     const shown=money(await page.locator('#total').textContent());assert.equal(shown,243);
     if(payNow){await page.locator('#v41-pay-now').click();await page.locator('#screen-pos [data-payment="'+method+'"]').click();if(method==='Cash')await page.locator('#v36-cash-received').fill('343');else await page.locator('#v41-book-reference-input').fill('QA UI reference')}
     const before=count(),printBefore=await page.evaluate(()=>window.__qaPrints.length);
     const body=await mutation(page,'POST','/orders/book',()=>page.locator('#place-order').click()),order=body.order||body;
     assert.equal(count(),before+1);assert.equal(order.total,shown);assert.equal(order.discount,27);assert.equal(order.orderType,mode);assert.equal(order.items[0].quantity,2);assert.equal(order.items[0].unitPrice,135);assert.equal(order.paymentStatus,payNow?'Paid':'Unpaid');assert.equal(order.notes,'QA UI workflow note');
     if(payNow){assert.equal(order.paymentMethod,method);if(method==='Cash')assert.equal(order.changeDue,100)}
     if(mode==='Dine-in'){assert(order.tableId||order.tableNumber);assert(!order.waiterId)}else{assert.equal(order.customerName,'QA UI Customer');assert.equal(order.customerPhone,'03001234567');if(mode==='Delivery')assert.equal(order.deliveryAddress,'QA isolated delivery address')}
     await finishBookingUi(page);await settlePrints(page,printBefore+2);
     const prints=await page.evaluate(n=>window.__qaPrints.slice(n),printBefore);assert.deepEqual(prints.map(p=>p.type),['kitchen','customer']);for(const p of prints){assert(p.text.includes(String(order.tokenNumber)));assert(p.text.includes(product.name))}
     if(!payNow){
      await page.locator('#v41-due-button').click();await page.locator('#v41-due-dialog [data-v41-pay="'+order.id+'"]').click();
      await page.locator('#v41-payment-dialog[open]').waitFor();assert.equal(money(await page.locator('#v41-payment-due').textContent()),243);
      assert.equal(await page.locator('#v41-confirm-payment').isDisabled(),true);
      const lateMethod=mode==='Takeaway'?'Cash':mode==='Dine-in'?'Card':'Online';await page.locator('#v41-payment-dialog [data-v41-method="'+lateMethod+'"]').click();
      if(lateMethod==='Cash')await page.locator('#v41-payment-received').fill('343');else await page.locator('#v41-payment-reference').fill('QA late reference');
      const paid=await mutation(page,'POST','/orders/'+order.id+'/payment',()=>page.locator('#v41-confirm-payment').click());
      assert.equal(paid.total,243);assert.equal(paid.paymentStatus,'Paid');assert.equal(paid.status,'Completed');assert.equal(paid.paymentMethod,lateMethod);assert.equal(count(),before+1);
      await settlePrints(page,printBefore+3);assert.equal(await page.evaluate(()=>window.__qaPrints.at(-1).type),'customer');
      await page.locator('[data-v41-due-close]').click();
     }else{
      // Fixture cleanup releases a paid order's table; not claimed as UI status acceptance.
      await f.api('Admin','/orders/'+order.id+'/status','PUT',{status:'Completed'});
     }
     assert.equal(await page.evaluate(()=>state.cart.length),0);report.bookings.push({appearance,role,mode,method,payNow,total:order.total,orderId:order.id,printCalls:payNow?2:3});
    }
   }
   await page.screenshot({path:'reports/browser/ui-orders-'+role+'-'+appearance+'.png',fullPage:true});
  }
  activePage=admin;stage=appearance+' same-browser account switch';await startOrder(admin,'Takeaway');await addTwo(admin,product);
  await admin.locator('#logout').click();await admin.locator('#login-screen').waitFor({state:'visible'});await login(admin,'Cashier');
  assert.equal(await admin.evaluate(()=>state.cart.length),0);assert.equal(await admin.evaluate(()=>Boolean(state.v56EditingOrderId||state.v38SetupDone)),false);
  assert.equal(await admin.locator('.sidebar [data-screen="menu-admin"]:visible').count(),0);
  await admin.locator('#logout').click();await admin.locator('#login-screen').waitFor({state:'visible'});await login(admin,'Admin');
  await admin.locator('.sidebar [data-screen="menu-admin"]').waitFor({state:'visible'});
  report.checks.push(appearance+': Admin -> logout -> Cashier -> logout -> Admin using login controls; draft/setup cleared and menu-management navigation hidden for Cashier');
  for(const c of contexts)await c.close();activePage=null;
 }
 assert.equal(report.bookings.length,48);assert.equal(report.errors.length,0,JSON.stringify(report.errors));
 report.checks.push('48 UI bookings: both roles/themes, all three service modes, every Pay Now payment method; 12 Pay Later orders settled through the actual payment dialog with all methods represented');
 report.checks.push('Actual size selection and cart quantity-plus control; displayed/saved totals, percent discounts, cash change, customer/address/table data, notes, cart reset; exactly two print-boundary calls per booking and one extra customer call per later payment');
 report.complete=true;console.log('PASS UI workflows: '+report.checks.join('; '));
}
run().catch(async e=>{
 report.failure={stage,message:e.stack};console.error('FAIL UI stage: '+stage+'\n'+e.stack);
 if(activePage&&!activePage.isClosed()){
  try{report.diagnostics=await activePage.evaluate(()=>({screen:state?.currentScreen,role:state?.user?.role,theme:document.documentElement.dataset.theme,cart:state?.cart,setup:state?.v38SetupDone,edit:state?.v56EditingOrderId,toast:document.querySelector('#toast')?.textContent,dialogs:[...document.querySelectorAll('dialog[open]')].map(x=>x.id),title:document.querySelector('#page-title')?.textContent,drawer:document.querySelector('#drawer-title')?.textContent,visibleButtons:[...document.querySelectorAll('button')].filter(x=>x.checkVisibility()).map(x=>({id:x.id,text:x.textContent.trim().slice(0,80),disabled:x.disabled})).slice(0,70),invalidFields:[...document.querySelectorAll('input:invalid,textarea:invalid,select:invalid')].filter(x=>x.checkVisibility()).map(x=>({id:x.id,reason:x.validationMessage}))}));await activePage.screenshot({path:'reports/browser/ui-failure.png',fullPage:true})}catch{}
  try{report.setupTrace=await activePage.evaluate(()=>window.__qaSetupTrace||[])}catch{}
 }
 process.exitCode=1;
}).finally(async()=>{
 report.summary={complete:report.complete,completedBookings:report.bookings.length,completedLaterPayments:report.bookings.filter(x=>!x.payNow).length,errors:report.errors.length};
 fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/v61-ui-workflows.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();if(f)await f.close();clearTimeout(watchdog);
});
