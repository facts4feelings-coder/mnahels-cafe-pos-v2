/* Print transport tests against the actual v63 queue; no real printer required.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
async function run(){
 const source=fs.readFileSync(path.join(__dirname,'../src/MnahelsCafe.Pos/wwwroot/v63.js'),'utf8');
 const listeners=new Set(),timers=new Map(),jobs=[],sheet={innerHTML:'',removeAttribute(){}};let timerId=0;
 const window={print(){},__mnahelsDualPrintBridge:true,__mnahelsPrintJobBridge:true,toast(){},chrome:{webview:{addEventListener:(e,h)=>listeners.add(h),removeEventListener:(e,h)=>listeners.delete(h),postMessage:m=>jobs.push({job:JSON.parse(m.slice(18)),html:sheet.innerHTML})}}};
 const document={fonts:{ready:Promise.resolve()},documentElement:{style:{setProperty(){}}},querySelector:()=>sheet};
 const context={window,document,Map,Set,Promise,Date,JSON,Number,String,Error,localStorage:{getItem:()=> '0'},setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id)};
 const prefix=source.slice(0,source.indexOf('function freeze('));
 const transport=source.slice(source.indexOf('function bridge('),source.indexOf('function printStaged('));
 vm.createContext(context);
 vm.runInContext(prefix+'function fromHtml(html){return {html,text:html};}\n'+transport+'window.testQueue={printHtml,once};})();',context);
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 const ack=(id,result='done')=>[...listeners].forEach(handler=>handler({data:'mnahels-print-result:'+id+':'+result}));
 const api=window.testQueue;
 const first=api.printHtml('MC-201 kitchen','kitchen'),second=api.printHtml('MC-202 customer','customer');
 await tick();assert.equal(jobs.length,1);assert.equal(sheet.innerHTML,'MC-201 kitchen');
 ack('wrong-id');await tick();assert.equal(jobs.length,1,'stale reply must not release the next job');
 ack(jobs[0].job.id);await first;await tick();assert.equal(jobs.length,2);assert.equal(jobs[0].html,'MC-201 kitchen');assert.equal(jobs[1].html,'MC-202 customer');ack(jobs[1].job.id);await second;
 let actions=0;await Promise.all([api.once('same-action',async()=>{actions++}),api.once('same-action',async()=>{actions++})]);assert.equal(actions,1);
 const cancelled=api.printHtml('MC-203 cancelled');await tick();const count=jobs.length;ack(jobs.at(-1).job.id,'cancelled');assert.equal(await cancelled,false);await tick();assert.equal(jobs.length,count,'cancel must not trigger an automatic retry');
 const timeout=api.printHtml('MC-204 delayed');const rejected=assert.rejects(timeout,/paused/);await tick();const pendingId=jobs.at(-1).job.id;[...timers.values()].at(-1)();await rejected;
 const before=jobs.length;await assert.rejects(api.printHtml('MC-205 must wait'),/unconfirmed/);assert.equal(jobs.length,before,'uncertain job must prevent sheet replacement');assert.equal(sheet.innerHTML,'MC-204 delayed');
 ack(pendingId);const recovered=api.printHtml('MC-206 explicit new attempt');await tick();ack(jobs.at(-1).job.id);await recovered;
 window.__mnahelsPrintJobBridge=false;await assert.rejects(api.printHtml('MC-207 old desktop'),/Update this Windows app/);
 assert(source.includes("['.v43-brand','1 / 1 / 2 / 3']"),'JPG named-grid correction must remain');
 console.log('PASS: FIFO snapshots, correlated replies, single action execution, cancellation without retry, fail-closed timeout, late reply recovery, old desktop warning, JPG grid correction.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
