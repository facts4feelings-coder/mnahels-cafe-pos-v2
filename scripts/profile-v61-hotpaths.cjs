/* Focused remaining-work diagnosis. Synthetic Windows/Edge, not native acceptance.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require('playwright');
const deadline=setTimeout(()=>{console.error('Hot-path profile exceeded six minutes');process.exit(1)},360000);deadline.unref();
(async()=>{
 const f=await require('./fixtures/cafe-server.cjs')();let browser,complete=false;const report={head:process.env.GITHUB_SHA,scope:'Current frontend only; two isolated Edge sessions, 30-second idle CPU sampling, repeated search input and 500 synthetic cart fill/clear cycles with forced GC. Not completed orders or native process memory.',roles:[],errors:[]};
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
  for(const role of ['Admin','Cashier']){
   const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-PK'}),i=f.cookies[role].indexOf('=');
   try{
    await context.addCookies([{name:f.cookies[role].slice(0,i),value:f.cookies[role].slice(i+1),url:f.base,httpOnly:true}]);const page=await context.newPage();page.on('pageerror',e=>report.errors.push({role,error:e.message}));
    await page.goto(f.base+'/?screen=pos',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>state.user&&state.menu.length>0&&window.cafeCatalog?.stamp,null,{timeout:30000});await page.waitForTimeout(2500);
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');await page.waitForTimeout(30000);const {profile}=await cdp.send('Profiler.stop');
    fs.mkdirSync('reports/hotpaths',{recursive:true});fs.writeFileSync('reports/hotpaths/'+role+'-idle.cpuprofile',JSON.stringify(profile));
    const nodes=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map();for(let n=0;n<(profile.samples||[]).length;n++){const id=profile.samples[n];self.set(id,(self.get(id)||0)+(profile.timeDeltas?.[n]||0))}
    const all=[...self].map(([id,microseconds])=>{const x=nodes.get(id).callFrame;return{function:x.functionName||'(anonymous)',file:x.url.replace(f.base,''),line:x.lineNumber+1,column:x.columnNumber+1,sampledSelfMs:microseconds/1000}}).sort((a,b)=>b.sampledSelfMs-a.sampledSelfMs);
    const input=[];for(let round=0;round<5;round++)for(const query of ['pizza','shake','']){
     input.push(await page.evaluate(async({round,query})=>{const box=document.querySelector('#search');if(!box)throw Error('Search input missing');const start=performance.now();box.value=query;box.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{round,query,twoFrameMilliseconds:performance.now()-start,visibleProductCards:document.querySelectorAll('#product-grid .product-card').length}},{round,query}));
    }
    const memory=[];for(let cycles=0;cycles<=500;cycles+=100){
     if(cycles)await page.evaluate(async()=>{const p=state.menu.flatMap(c=>c.products).find(p=>p.isAvailable&&p.variants.length),v=p.variants[0];for(let n=0;n<100;n++){state.cart=[{variantId:v.id,name:p.name,variant:v.name,price:v.price,quantity:n%5+1}];window.renderCart();state.cart=[];window.renderCart();await new Promise(r=>requestAnimationFrame(r))}});
     await page.waitForTimeout(1000);await cdp.send('HeapProfiler.collectGarbage');const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));memory.push({cycles,heapBytes:metrics.JSHeapUsedSize,nodes:metrics.Nodes,listeners:metrics.JSEventListeners});
    }
    assert.equal(input.length,15);assert.equal(memory.length,6);
    report.roles.push({role,idleSeconds:30,topApplicationFrames:all.filter(x=>x.file.startsWith('/')).slice(0,25),topRuntimeFrames:all.filter(x=>!x.file.startsWith('/')).slice(0,5),input,memory});console.log('Profiled '+role);
   }finally{await context.close()}
  }
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.roles.length,2);complete=true;
 }finally{report.complete=complete;fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/v61-hotpaths.json',JSON.stringify(report,null,2));if(browser)await browser.close();await f.close();clearTimeout(deadline)}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
