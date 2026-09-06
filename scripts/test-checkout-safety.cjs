/* Tests actual catalog/print source; mocked transport, no server or customer data. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root='src/MnahelsCafe.Pos/wwwroot/';
const watchdog=setTimeout(()=>{console.error('Checkout safety test did not finish');process.exit(1)},10000);
function fixture(print=false){
 const listeners={},timers=new Map(),events=[],sent=[],requests=[];let sequence=0,reloads=0;
 const remote={epoch:'e1',revision:'r1'},state={user:{id:1,role:'Cashier'},menu:[],category:'All',cart:[{variantId:1,quantity:2,price:100}]};
 const sheet={textContent:'A valid receipt with more than twenty characters',removeAttribute(){},querySelectorAll(){return[]}};
 const document={visibilityState:'visible',fonts:{ready:Promise.resolve()},querySelector:()=>sheet,dispatchEvent(e){events.push(e.type);for(const f of listeners[e.type]||[])f(e)},addEventListener(e,f){(listeners[e]??=[]).push(f)}};
 const handlers=new Set(),context={state,document,Headers,URL,Request,Response,Event,CustomEvent:class extends Event{constructor(t,o){super(t);this.detail=o.detail}},location:{href:'http://localhost/',origin:'http://localhost',reload(){reloads++}},sessionStorage:{setItem(){},getItem(){return null},removeItem(){}},setTimeout(f,ms){timers.set(++sequence,{f,ms});return sequence},clearTimeout(id){timers.delete(id)},requestAnimationFrame(f){queueMicrotask(f)},queueMicrotask,console,toast(){},addEventListener(e,f){(listeners[e]??=[]).push(f)},renderCategories(){},renderProducts(){},chrome:{webview:{postMessage(text){sent.push(JSON.parse(text.slice(text.indexOf(':')+1)))},addEventListener(e,f){handlers.add(f)},removeEventListener(e,f){handlers.delete(f)}}},__mnahelsDualPrintBridge:true,__mnahelsPrintJobBridge:true};
 context.fetch=async(input,options={})=>{const path=input instanceof URL?input.href:typeof input==='string'?input:input.url;requests.push({path,options});if(path.endsWith('/revision'))return Response.json(remote);if(path.endsWith('/menu'))return Response.json([{id:1,name:'Pizza',products:[{id:1,isActive:true,isAvailable:true,variants:[{id:1,price:100}]}]}]);return Response.json({saved:true})};context.window=context;
 vm.createContext(context);if(print)vm.runInContext(fs.readFileSync(root+'v64.js','utf8'),context);vm.runInContext(fs.readFileSync(root+'menu-sync.js','utf8'),context);
 return{context,state,remote,timers,events,sent,requests,ack(id,status='done'){for(const f of [...handlers])f({data:'mnahels-print-result:'+id+':'+status})},get reloads(){return reloads}};
}
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
(async()=>{
 for(const role of ['Admin','Cashier']){
  const f=fixture();f.state.user.role=role;
  const body=JSON.stringify({items:[{variantId:1,quantity:2}]});
  await assert.rejects(f.context.fetch('/api/orders/book',{method:'POST',body}),/verification/);
  await f.context.cafeCatalog.check();
  for(const path of ['/api/orders','/api/orders/book','/api/orders/7']){
   await f.context.fetch(path,{method:path.endsWith('/7')?'PUT':'POST',headers:{'Content-Type':'application/json','X-Test':'keep'},body});
   const h=f.requests.at(-1).options.headers;assert.equal(h.get('X-Cafe-Epoch'),'e1');assert.equal(h.get('X-Test'),'keep');assert.deepEqual(JSON.parse(h.get('X-Cafe-Cart')),[{variantId:1,quantity:2,unitPrice:100}]);
  }
  await f.context.fetch(new Request(f.context.location.origin+'/api/orders/book',{method:'POST',headers:{'Content-Type':'application/json'},body}));assert.equal(f.requests.at(-1).options.headers.get('X-Cafe-Epoch'),'e1');
  await f.context.fetch(new URL(f.context.location.origin+'/api/orders/book'),{method:'POST',body});assert.equal(f.requests.at(-1).options.headers.get('X-Cafe-Epoch'),'e1');
  f.context.mnahelsV52={priceLines:()=>[...f.state.cart,{variantId:2,notes:'For Pizza A (Small)',price:40,quantity:2}]};
  await f.context.fetch('/api/orders/book',{method:'POST',body:JSON.stringify({items:[{variantId:1,quantity:2},{variantId:2,quantity:2,notes:'For Pizza A (Small)'}]})});assert.deepEqual(JSON.parse(f.requests.at(-1).options.headers.get('X-Cafe-Cart')).map(x=>x.unitPrice),[100,40]);delete f.context.mnahelsV52;
  await f.context.fetch('/api/orders/7/payment',{method:'POST',body:'{}'});assert.equal(f.requests.at(-1).options.headers.has('X-Cafe-Cart'),false);
  const external={method:'POST',body};await f.context.fetch('https://example.test/api/orders',external);assert.equal(f.requests.at(-1).options,external);
  f.state.cart[0].price=0;await f.context.fetch('/api/orders/book',{method:'POST',body});assert.equal(JSON.parse(f.requests.at(-1).options.headers.get('X-Cafe-Cart'))[0].unitPrice,0);
  f.state.cart=[];const before=f.requests.length;await assert.rejects(f.context.fetch('/api/orders/book',{method:'POST',body}),/Cart badal/);assert.equal(f.requests.length,before);
  f.remote.epoch='e2';await f.context.cafeCatalog.check();assert.equal(f.reloads,1);await assert.rejects(f.context.fetch('/api/orders/7/payment',{method:'POST',body:'{}'}),/reload required/);
 }
 // Reset while one native job is in flight: preserve its sheet until acknowledgement,
 // reject queued work, and reload only when the queue is no longer uncertain.
 for(const timeout of [false,true]){
  const f=fixture(true);await f.context.cafeCatalog.check();
  const a=f.context.mnahelsV64.printHtml('<p>First immutable receipt</p>');const outcome=a.catch(e=>e);
  await tick();assert.equal(f.sent.length,1);
  const b=f.context.mnahelsV64.printHtml('<p>Second queued receipt</p>');const rejected=b.catch(e=>e);
  f.remote.epoch='e2';await f.context.cafeCatalog.check();assert.equal(f.reloads,0);
  if(timeout){const timer=[...f.timers.values()].find(t=>t.ms===30000);assert(timer);timer.f();await tick();assert((await outcome) instanceof Error||String(await outcome).includes('delayed'));assert.equal(f.reloads,0);assert.equal(f.context.mnahelsV64.status.uncertain,true)}
  f.ack('unrelated');assert.equal(f.reloads,0);
  f.ack(f.sent[0].id);await outcome;await rejected;await tick();assert.equal(f.sent.length,1,'Queued print crossed database replacement');assert.equal(f.reloads,1);assert.equal(f.context.mnahelsV64.status.pendingJobs,0);
 }
 const staged=fixture(true);await staged.context.cafeCatalog.check();const job=staged.context.mnahelsV64.printHtml('Queued before stage');const result=job.catch(e=>e);staged.remote.epoch='e2';await staged.context.cafeCatalog.check();await result;await tick();assert.equal(staged.sent.length,0,'Unsubmitted receipt printed after reset');assert.equal(staged.reloads,1);
 console.log('PASS: checkout headers, both roles/routes, Request inputs, preserved headers, zero price, later-payment exclusion, missing cart fail-closed, epoch blocking, reset pending/queued prints, timeout and correlated late acknowledgement.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>clearTimeout(watchdog));
