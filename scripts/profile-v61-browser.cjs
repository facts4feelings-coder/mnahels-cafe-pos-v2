/* Repeated frontend measurements only. Not native startup or whole-process memory.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{performance}=require('perf_hooks'),{chromium}=require('playwright');
const deadline=setTimeout(()=>{console.error('Profiling exceeded eight minutes');process.exit(1)},480000);deadline.unref();
const median=xs=>{const a=[...xs].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2};
(async()=>{
 const f=await require('./fixtures/cafe-server.cjs')();const servers=[],samples=[],idle=[],memory=[],errors=[];let browser,complete=false;
 const report={scope:'Windows Headless Edge frontend on warmed synthetic server; fresh browser context and warm reload, not cold OS/native startup',baseline:'2d0ae1c394907c428e6430d9fd5ef7485482d606',head:process.env.CAFE_HEAD_SHA||process.env.GITHUB_SHA,rounds:5,samples,idle,memory,errors};
 async function serve(root){root=path.resolve(root);const server=http.createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/')){const r=await fetch(f.base+req.url,{headers:{Cookie:req.headers.cookie||''}});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(Buffer.from(await r.arrayBuffer()));return}
  const name=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':name.startsWith('/assets/menu/')?'public, max-age=31536000, immutable':'no-store'});fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e))}});await new Promise(r=>server.listen(0,'127.0.0.1',r));servers.push(server);return'http://127.0.0.1:'+server.address().port}
 async function ready(page,url,reload){const start=performance.now();if(reload)await page.reload({waitUntil:'domcontentloaded'});else await page.goto(url+'/?screen=pos',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>state.user&&state.menu.length>0&&document.querySelectorAll('.product-card').length>0,null,{timeout:30000});await page.evaluate(()=>document.fonts.ready);return performance.now()-start}
 try{
  assert(process.env.CAFE_BASELINE_ROOT,'Baseline root required');const urls={before:await serve(process.env.CAFE_BASELINE_ROOT),after:await serve('src/MnahelsCafe.Pos/wwwroot')};
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();report.platform=process.platform;report.arch=process.arch;
  for(let round=0;round<5;round++)for(const role of ['Admin','Cashier'])for(const label of (round%2?['after','before']:['before','after'])){
   const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-PK',timezoneId:'Asia/Karachi'}),url=urls[label],i=f.cookies[role].indexOf('=');
   try{
    await context.addCookies([{name:f.cookies[role].slice(0,i),value:f.cookies[role].slice(i+1),url,httpOnly:true}]);const page=await context.newPage();page.on('pageerror',e=>errors.push({round,role,label,error:e.message}));
    const fresh=await ready(page,url,false),warm=await ready(page,url,true);samples.push({round,role,label,freshContextMilliseconds:fresh,warmReloadMilliseconds:warm});
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    // Same settle/idle duration in every paired run; no first-run-only comparison.
    await page.waitForTimeout(2000);const begin=await metrics();await page.waitForTimeout(5000);const end=await metrics();
    idle.push({round,role,label,seconds:5,scriptMilliseconds:1000*(end.ScriptDuration-begin.ScriptDuration),taskMilliseconds:1000*(end.TaskDuration-begin.TaskDuration)});
    if(round===0){
     const snapshots=[];for(let cycle=0;cycle<=100;cycle+=25){
      if(cycle)await page.evaluate(async()=>{const p=state.menu.flatMap(c=>c.products).find(p=>p.isAvailable&&p.variants.length),v=p.variants[0];for(let n=0;n<25;n++){state.cart=[{variantId:v.id,name:p.name,variant:v.name,price:v.price,quantity:n%5+1}];window.renderCart();state.cart=[];window.renderCart();await new Promise(r=>requestAnimationFrame(r))}});
      await page.waitForTimeout(300);await cdp.send('HeapProfiler.collectGarbage');const m=await metrics();snapshots.push({cycles:cycle,heapBytes:m.JSHeapUsedSize,domNodes:m.Nodes,jsEventListeners:m.JSEventListeners});
     }memory.push({role,label,scope:'100 cart fill/clear cycles, forced GC; not completed orders/native process memory',snapshots});
    }
    console.log(JSON.stringify({round,role,label,fresh,warm}));
   }finally{await context.close()}
  }
  assert.equal(samples.length,20);assert.equal(idle.length,20);assert.equal(memory.length,4);assert(samples.every(s=>Number.isFinite(s.freshContextMilliseconds)&&s.freshContextMilliseconds>0&&s.warmReloadMilliseconds>0));assert.equal(errors.filter(e=>e.label==='after').length,0,JSON.stringify(errors));
  report.summary=['Admin','Cashier'].flatMap(role=>['before','after'].map(label=>{const s=samples.filter(s=>s.role===role&&s.label===label),d=idle.filter(s=>s.role===role&&s.label===label);return{role,label,runs:s.length,freshContextMedianMs:median(s.map(s=>s.freshContextMilliseconds)),warmReloadMedianMs:median(s.map(s=>s.warmReloadMilliseconds)),idleScriptMedianMs:median(d.map(s=>s.scriptMilliseconds)),idleTaskMedianMs:median(d.map(s=>s.taskMilliseconds))}}));
  complete=true;console.log('PROFILE SUMMARY '+JSON.stringify(report.summary));
 }finally{
  report.complete=complete;fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/v61-repeated-profile.json',JSON.stringify(report,null,2));
  if(browser)await browser.close();for(const server of servers)server.close();await f.close();clearTimeout(deadline);
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1});
