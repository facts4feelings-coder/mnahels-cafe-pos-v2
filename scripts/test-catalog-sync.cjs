const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(process.argv[2]||'src/MnahelsCafe.Pos/wwwroot/menu-sync.js','utf8');
function fixture(){
 let remote={revision:'r1',epoch:'e1'},menu=[{id:1,name:'Pizza',products:[{id:1,name:'Pizza',variants:[{id:1,price:100}]}]}],fail=false,delay=null,reloads=0,renders=0,requests=0,intercept=()=>{};
 const state={user:{id:1,role:'Cashier'},category:'All',menu:[],cart:[{variantId:1,quantity:2,price:100}]},events=[],listeners={},timeouts=new Map(),channels=[];let id=0;
 const document={visibilityState:'visible',addEventListener:(e,fn)=>listeners[e]=fn,dispatchEvent:e=>events.push(e)},window={state,renderCategories:()=>renders++,renderProducts:()=>renders++,toast(){},addEventListener:(e,fn)=>listeners[e]=fn};
 const sandbox={window,state,document,BroadcastChannel:class{constructor(){channels.push(this)}postMessage(){}close(){this.closed=true}},location:{reload:()=>reloads++},sessionStorage:{setItem(){},getItem(){return null},removeItem(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},setTimeout:(fn,ms)=>{timeouts.set(++id,{fn,ms});return id},clearTimeout:i=>timeouts.delete(i),console,fetch:async path=>{requests++;if(delay)await delay;if(fail)throw Error('offline');intercept(path,requests);return{ok:true,json:async()=>structuredClone(path.endsWith('/revision')?remote:menu)}}};
 vm.runInNewContext(source,sandbox);
 return{state,window,document,events,listeners,timeouts,channels,intercept:fn=>intercept=fn,remote:next=>remote=next,menu:next=>menu=next,fail:next=>fail=next,delay:next=>delay=next,get counts(){return{reloads,renders,requests}},sync:force=>window.cafeCatalog.check(force)};
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
 const hidden=fixture();hidden.document.visibilityState='hidden';hidden.listeners.visibilitychange();hidden.channels[0].onmessage();assert.equal(hidden.counts.requests,0,'Hidden broadcast caused network work');
 const race=fixture();race.intercept((path,n)=>{if(n===3)race.remote({revision:'r2',epoch:'e1'})});race.listeners.focus();await race.sync();await Promise.resolve();assert.equal(race.counts.renders,0,'Inconsistent snapshot rendered');assert([...race.timeouts.values()].some(t=>t.ms===500),'Snapshot retry delay was lost');race.intercept(()=>{});await race.sync();assert.equal(race.window.cafeCatalog.stamp.revision,'r2');
 const switched=fixture();let release;switched.delay(new Promise(r=>release=r));const old=switched.sync();switched.state.user={id:2,role:'Admin'};release();await old;assert.equal(switched.counts.renders,0,'Old session painted new session');switched.delay(null);await switched.sync();assert.equal(switched.counts.renders,2);
 const resumed=fixture();await resumed.sync();for(let n=2;n<=3;n++){resumed.listeners.pagehide({persisted:true});const before=resumed.counts.requests;await resumed.sync();assert.equal(resumed.counts.requests,before);resumed.remote({revision:'r'+n,epoch:'e1'});resumed.listeners.pageshow({persisted:true});await resumed.sync();assert.equal(resumed.window.cafeCatalog.stamp.revision,'r'+n);assert.equal(resumed.channels.length,n)}
 console.log('PASS: both roles; change-only repaint; draft/category/offline safety; coalescing; one-time epoch reload; hidden broadcasts; 500ms snapshot retry; session-switch race; repeated back-forward-cache recovery.');
})().catch(e=>{console.error(e);process.exitCode=1});
