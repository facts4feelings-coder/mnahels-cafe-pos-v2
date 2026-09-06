const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(process.argv[2]||'src/MnahelsCafe.Pos/wwwroot/menu-sync.js','utf8');
function fixture(){
 let remote={revision:'r1',epoch:'e1'},menu=[{id:1,name:'Pizza',products:[{id:1,name:'Pizza',variants:[{id:1,price:100}]}]}],fail=false,delay=null,reloads=0,renders=0,requests=0;
 const state={user:{role:'Cashier'},category:'All',menu:[],cart:[{variantId:1,quantity:2,price:100}]},events=[],listeners={},timeouts=new Map();let id=0;
 const document={visibilityState:'visible',addEventListener:(e,fn)=>listeners[e]=fn,dispatchEvent:e=>events.push(e)};
 const window={state,renderCategories:()=>renders++,renderProducts:()=>renders++,toast(){},addEventListener:(e,fn)=>listeners[e]=fn};
 const sandbox={window,state,document,location:{reload:()=>reloads++},sessionStorage:{setItem(){},getItem(){return null},removeItem(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},setTimeout:(fn,ms)=>{timeouts.set(++id,{fn,ms});return id},clearTimeout:i=>timeouts.delete(i),console,fetch:async path=>{requests++;if(delay)await delay;if(fail)throw Error('offline');return{ok:true,json:async()=>structuredClone(path.endsWith('/revision')?remote:menu)}}};
 vm.runInNewContext(source,sandbox);
 return{state,window,document,events,listeners,timeouts,remote:next=>remote=next,menu:next=>menu=next,fail:next=>fail=next,delay:next=>delay=next,get counts(){return{reloads,renders,requests}},sync:force=>window.cafeCatalog.check(force)};
}
(async()=>{
 for(const role of ['Admin','Cashier']){
  const f=fixture();f.state.user.role=role;assert.equal(await f.sync(),true);assert.equal(f.state.menu.length,1);assert.equal(f.state.cart[0].quantity,2);assert.equal(f.counts.renders,2);
  const before=f.counts.requests;assert.equal(await f.sync(),false);assert.equal(f.counts.requests,before+1);assert.equal(f.counts.renders,2,'Unchanged menu repainted');
  f.state.category='Removed category';f.remote({revision:'r2',epoch:'e1'});f.menu([{id:2,name:'Super Deals',products:[]}]);await f.sync();assert.equal(f.state.category,'All');assert.equal(f.state.cart[0].quantity,2);assert.equal(f.counts.renders,4);
  f.fail(true);const saved=JSON.stringify(f.state);await f.sync();assert.equal(JSON.stringify(f.state),saved,'Offline error corrupted state');f.fail(false);
  let release;f.delay(new Promise(r=>release=r));const a=f.sync(),b=f.sync();assert.equal(a,b,'Concurrent refresh not coalesced');release();await a;f.delay(null);
  f.remote({revision:'r3',epoch:'e2'});await f.sync();assert.equal(f.counts.reloads,1,'Reset epoch did not invalidate old app');await f.sync();assert.equal(f.counts.reloads,1,'Repeated reload loop');
 }
 const inactive=fixture();inactive.state.user=null;await inactive.sync();assert.equal(inactive.counts.requests,0);
 const hidden=fixture();hidden.document.visibilityState='hidden';hidden.listeners.visibilitychange();assert.equal(hidden.counts.requests,0);
 console.log('PASS: both roles; change-only repaint; preserved drafts; stale category reset; offline state safety; coalesced requests; epoch reload exactly once; no anonymous/hidden probes.');
})().catch(e=>{console.error(e);process.exitCode=1});
