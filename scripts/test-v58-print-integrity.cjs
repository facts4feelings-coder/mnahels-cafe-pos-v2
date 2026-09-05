const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const web=path.resolve(__dirname,'../src/MnahelsCafe.Pos/wwwroot');
const read=n=>fs.readFileSync(path.join(web,n),'utf8').replace(/\r\n/g,'\n');
const part=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return s.slice(i,j)};
const source=fs.existsSync(web)?read('v64.js'):fs.readFileSync(path.join(__dirname,'v64.js'),'utf8');
async function main(){
 const listeners=new Set(),timers=new Map(),jobs=[],staged=[];let id=0;
 const window={__mnahelsDualPrintBridge:true,__mnahelsPrintJobBridge:true,toast(){},chrome:{webview:{addEventListener:(e,h)=>listeners.add(h),removeEventListener:(e,h)=>listeners.delete(h),postMessage:m=>jobs.push(JSON.parse(m.slice(18)))}}};
 const context={window,Map,Set,Promise,Date,JSON,Number,String,Error,console,setTimeout:(fn,ms)=>{if(ms<1000){queueMicrotask(fn);return 0}timers.set(++id,fn);return id},clearTimeout:i=>timers.delete(i),__stage:(html,type)=>staged.push({html,type})};
 vm.createContext(context);
 const staging=part(source,'async function stage(source,type){','function printHtml(');
 vm.runInContext(source.replace(staging,'async function stage(source,type){__stage(source,type)}\n'),context);
 const api=window.mnahelsV64,tick=()=>new Promise(r=>setImmediate(r)),ack=(id,outcome='done')=>[...listeners].forEach(h=>h({data:'mnahels-print-result:'+id+':'+outcome}));
 const first=api.printHtml('MC-1 kitchen','kitchen'),second=api.printHtml('MC-1 customer','customer');await tick();assert.equal(jobs.length,1);assert.equal(staged.length,1);
 ack('wrong');await tick();assert.equal(jobs.length,1);ack(jobs[0].id);await first;await tick();assert.equal(jobs.length,2);assert.equal(staged[1].html,'MC-1 customer');ack(jobs[1].id);await second;assert.equal(listeners.size,0);assert.equal(timers.size,0);
 let executed=0;await Promise.all([api.once('same',async()=>executed++),api.once('same',async()=>executed++)]);assert.equal(executed,1);
 const failed=api.printHtml('MC-2 rejected');await tick();ack(jobs.at(-1).id,'cancelled');assert.equal(await failed,false);
 const slow=api.printHtml('MC-3 delayed');const rejection=assert.rejects(slow,/paused/);await tick();const slowId=jobs.at(-1).id;[...timers.values()].at(-1)();await rejection;
 const count=jobs.length;await assert.rejects(api.printHtml('MC-4 blocked'),/unconfirmed/);assert.equal(jobs.length,count);assert.equal(staged.at(-1).html,'MC-3 delayed');ack(slowId);
 console.log('PASS: immutable FIFO, correlated replies, once-per-action, rejected job, fail-closed timeout, late recovery.');
 if(!fs.existsSync(web)){console.log('Full application flow tests require repository/CI.');return}
 const prints=[],nodes=new Map();const node=s=>{if(!nodes.has(s))nodes.set(s,{disabled:false,value:'',textContent:'',classList:{add(){},remove(){}},close(){}});return nodes.get(s)};
 Object.assign(context,{q:node,sleep:async()=>{},state:{},say(){},toast(){},orderMap:new Map(),printQueue:Promise.resolve(),isPaid:o=>o.paymentStatus==='Paid',billHtml:(o,p)=>'MC-'+o.tokenNumber+(p?' paid':' unpaid')});
 api.printHtml=async(html,type)=>{prints.push({html,type});return true};
 window.mnahelsV36={printSlip:(o,type)=>api.printHtml('MC-'+o.tokenNumber+' kitchen',type),renderOperations:async()=>{},refreshHub:async()=>{}};
 vm.runInContext(part(read('v41.js'),'function enqueuePrint(task){','function billLine')+part(read('v41.js'),'async function printCustomerBillNow(order','async function setComplete'),context);
 let orderId=20;
 for(const orderType of ['Dine-in','Takeaway','Delivery'])for(const paymentStatus of ['Paid','Unpaid']){prints.length=0;const order={id:orderId++,tokenNumber:120,orderType,paymentStatus};await Promise.all([context.postBookingPrint(order),context.postBookingPrint(order)]);assert.equal(prints.length,2);assert.equal(prints[0].type,'kitchen');assert.equal(prints[1].type,'customer');assert(prints[1].html.endsWith(paymentStatus.toLowerCase()))}
 assert(!read('v36.js').includes('setTimeout(()=>autoPrintDine(order),260)'));assert(!read('v61.js').includes('try{handleAmendment(result)}'));
 Object.assign(context,{currentState:()=>context.state,resetOrderContext(){},showRunningSuccess(){},printRunningSlip:(o,lines,type,r)=>api.printHtml(JSON.stringify(lines),'kitchen'),autoPrintKey:'',appState:()=>context.state,orderFrom:o=>o?.order||o,validOrder:o=>!!o?.id,updatedReceiptHtml:(o,r)=>JSON.stringify(r)});
 vm.runInContext(part(read('v58.js'),'async function completeRunningOrder(order,result){','function boot')+part(read('v62.js'),'async function printHtml(html,type,quiet=false){','function showPreview'),context);
 for(const [name,additions,cancellations] of [['add',[{quantity:1,productName:'Tea'}],[]],['remove',[],[{quantity:1,productName:'Burger'}]],['mixed',[{quantity:1,productName:'Tea'}],[{quantity:1,productName:'Burger'}]]]){prints.length=0;const order={id:90,tokenNumber:190,total:4500};const result={amendedAt:name,previousTotal:4000,updatedTotal:4500,additions,cancellations};for(let i=0;i<2;i++){await context.completeRunningOrder(order,result);await context.printUpdatedReceipt(order,result,true)}assert.equal(prints.length,name==='mixed'?3:2);assert.equal(prints.at(-1).type,'customer');if(additions.length)assert(!prints[0].html.includes('Burger'));if(cancellations.length)assert(!prints.at(-2).html.includes('Tea'))}
 context.paymentTarget={id:999,total:4000};context.selectedLateMethod=()=> 'Card';context.refreshDue=async()=>{};let payments=0;window.api=async()=>{payments++;return{id:999,tokenNumber:999,paymentStatus:'Paid'}};
 vm.runInContext(part(read('v41.js'),'async function submitLatePayment(event){','function ensureDueDialog'),context);prints.length=0;await Promise.all([context.submitLatePayment({preventDefault(){}}),context.submitLatePayment({preventDefault(){}})]);assert.equal(payments,1);assert.equal(prints.length,1);assert.equal(prints[0].type,'customer');
 console.log('PASS: six service/payment combinations; duplicate callbacks; add/remove/mixed deltas; later-payment double-submit.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
