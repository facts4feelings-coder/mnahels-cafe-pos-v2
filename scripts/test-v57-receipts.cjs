/* Regression tests against the effective, build-patched application functions.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'src/MnahelsCafe.Pos/wwwroot');
const read=n=>fs.readFileSync(path.join(web,n),'utf8').replace(/\r\n/g,'\n');
const part=(s,a,b)=>{const start=s.indexOf(a),end=s.indexOf(b,start+a.length);assert(start>=0&&end>start,`Missing section ${a}`);return s.slice(start,end);};
async function main(){
 const nodes=new Map();function node(key){if(!nodes.has(key))nodes.set(key,{value:'',disabled:false,innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){},contains(){return false}},remove(){},close(){},querySelector(){return node('child:'+key)},querySelectorAll(){return[]},setAttribute(){},removeAttribute(){},style:{setProperty(){}}});return nodes.get(key);}
 const document={fonts:{ready:Promise.resolve()},head:{append(){}},documentElement:{style:{setProperty(){}},dataset:{}},querySelector:s=>node(s),querySelectorAll:()=>[],createElement:()=>node('created'),addEventListener(){}};
 const window={document,print(){},state:{cart:[]},toast(){}};window.window=window;
 const context={window,document,console,Map,Set,Promise,Date,Number,String,Array,Math,JSON,setTimeout:fn=>{queueMicrotask(fn);return 1},clearTimeout(){},setInterval(){},localStorage:{getItem:()=> '0'},state:window.state};
 vm.createContext(context);
 vm.runInContext(read('v63.js'),context);
 const prints=[];window.mnahelsV63.printHtml=async(html,type)=>{prints.push({html,type});return true;};
 // Use the real HTML generators, not test-only receipt templates.
 vm.runInContext(read('v43.js').split('const hotImages=')[0]+'window.mnahelsV43={receiptHtml};})();',context);
 vm.runInContext(read('v61.js').split('/* ---- printing:')[0]+'window.mnahelsV61={slipHtml};})();',context);
 vm.runInContext(read('v62.js').split('function stage(')[0]+'window.mnahelsV62={updatedReceiptHtml,orderFrom,validOrder};})();',context);
 Object.assign(context,{q:s=>document.querySelector(s),sleep:async()=>{},say(){},printQueue:Promise.resolve(),orderMap:new Map(),enqueuePrint:fn=>fn(),isPaid:o=>o.paymentStatus==='Paid',billHtml:o=>window.mnahelsV43.receiptHtml(o,'customer')});
 vm.runInContext(part(read('v36.js'),"async function printSlip(order,kind='customer',quiet=false){",'function previewSlip'),context);
 window.mnahelsV36={printSlip:(...args)=>context.printSlip(...args),renderOperations:async()=>{},refreshHub:async()=>{}};
 context.receiptHtml=(o,k)=>window.mnahelsV43.receiptHtml(o,k);
 vm.runInContext(part(read('v41.js'),'async function printCustomerBillNow(order','async function setComplete'),context);
 vm.runInContext(part(read('v41.js'),'async function postBookingPrint(order){','\n\nfunction billLine'),context);
 const line=(id,name,quantity,price)=>({variantId:id,productName:name,variantName:'Regular',quantity,unitPrice:price,lineTotal:quantity*price,notes:null});
 const original=[line(1,'Booked Burger',4,1000)],extra=line(2,'Added Tea',1,500);
 let id=1;
 for(const orderType of ['Dine-in','Takeaway','Delivery'])for(const paymentStatus of ['Paid','Unpaid']){
  const order={id:id++,tokenNumber:100+id,orderType,paymentStatus,items:original,subtotal:4000,total:4000};prints.length=0;
  await Promise.all([context.postBookingPrint(order),context.postBookingPrint(order)]);
  assert.equal(prints.length,2,orderType+' '+paymentStatus+' must print exactly two copies');assert.equal(prints[0].type,'kitchen');assert.equal(prints[1].type,'customer');assert(prints[1].html.includes('data-receipt-kind="'+paymentStatus.toLowerCase()+'"'));
 }
 assert(!read('v36.js').includes('setTimeout(()=>autoPrintDine(order),260)'));
 assert(!read('v61.js').includes('try{handleAmendment(result)}catch(e){}'));
 context.printRunningSlip=async(o,lines,type,r)=>window.mnahelsV63.printHtml(window.mnahelsV61.slipHtml(o,lines,type,r),'kitchen');
 Object.assign(context,{currentState:()=>window.state,resetOrderContext(){},showRunningSuccess(){},autoPrintKey:'',appState:()=>window.state,orderFrom:window.mnahelsV62.orderFrom,validOrder:window.mnahelsV62.validOrder,updatedReceiptHtml:window.mnahelsV62.updatedReceiptHtml});
 vm.runInContext(part(read('v58.js'),'async function completeRunningOrder(order,result){','function boot'),context);
 vm.runInContext(part(read('v62.js'),'async function printHtml(html,type,quiet=false){','function showPreview'),context);
 for(const [name,items,additions,cancellations,total] of [
  ['add',[...original,extra],[extra],[],4500],
  ['remove',[line(1,'Booked Burger',3,1000)],[],[line(1,'Booked Burger',1,1000)],3000],
  ['mixed',[line(1,'Booked Burger',3,1000),extra],[extra],[line(1,'Booked Burger',1,1000)],3500]
 ]){
  const order={id:99,tokenNumber:199,orderType:'Dine-in',paymentStatus:'Unpaid',items,subtotal:total,total};
  const result={order,amendedAt:name,previousTotal:4000,updatedTotal:total,additions,cancellations};prints.length=0;
  for(let repeat=0;repeat<2;repeat++){await context.completeRunningOrder(order,result);await context.printUpdatedReceipt(order,result,true);}
  assert.equal(prints.length,(name==='mixed'?3:2),name+' copy count');
  const customer=prints.at(-1);assert.equal(customer.type,'customer');assert(customer.html.includes('PREVIOUS ORDER'));assert(customer.html.includes('FINAL ORDER TOTAL'));assert(customer.html.includes('PAYMENT DUE'));
  if(additions.length){assert(prints[0].html.includes('Added Tea'));assert(!prints[0].html.includes('Booked Burger'));}
  if(cancellations.length){const removal=prints.find(p=>p.html.includes('REMOVAL/CANCELLED'));assert(removal);assert(removal.html.includes('-1'));assert(!removal.html.includes('Added Tea'));}
 }
 const paid={id:500,tokenNumber:600,paymentStatus:'Paid',orderType:'Takeaway',items:original,total:4000,subtotal:4000};
 context.paymentTarget={...paid,paymentStatus:'Unpaid'};context.selectedLateMethod=()=> 'Card';context.refreshDue=async()=>{};context.toast=()=>{};context.cash=String;
 let payments=0;window.api=async()=>{payments++;return paid;};
 vm.runInContext(part(read('v41.js'),'async function submitLatePayment(event){','\n\nfunction ensureDueDialog'),context);prints.length=0;
 await Promise.all([context.submitLatePayment({preventDefault(){}}),context.submitLatePayment({preventDefault(){}})]);
 assert.equal(payments,1);assert.equal(prints.length,1);assert.equal(prints[0].type,'customer');assert(prints[0].html.includes('data-receipt-kind="paid"'));
 assert(read('v45.js').includes('return window.mnahelsV63.downloadHtml(source,name)'));
 assert(read('v45.js').includes('function watchPrintSheet(){return;'));
 const server=fs.readFileSync(path.join(root,'src/MnahelsCafe.Pos/OrderEditingFeatures.cs'),'utf8');assert(server.includes('var previousOrder = JsonSerializer.SerializeToElement(OrderView.From(order))'));assert(server.includes('updatedOrder = JsonSerializer.SerializeToElement'));
 assert(read('v56.js').includes('notes: item.notes || null'));assert(read('v56.js').includes('window.mnahelsV39?.discountAmount?.()'));
 console.log('PASS: 6 new-order modes, duplicate callbacks, add/remove/mixed updates, later payment double-click, HTML/JPG delegation, item notes and history snapshot integration.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
