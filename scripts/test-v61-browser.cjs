const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
module.exports=async function({base,cookies}){
 const output='reports/browser';fs.mkdirSync(output,{recursive:true});const servers=[],pages={},measurements={},errors=[];
 const persist=()=>fs.writeFileSync('reports/v61-browser-tests.json',JSON.stringify({measurements,errors},null,2));
 async function serve(root,port){const s=http.createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const r=await fetch(base+req.url,{method:req.method,headers:{'Content-Type':'application/json',Cookie:req.headers.cookie||''},body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json'});res.end(Buffer.from(await r.arrayBuffer()));return}
  const name=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e))}});await new Promise(r=>s.listen(port,'127.0.0.1',r));servers.push(s);return'http://127.0.0.1:'+port}
 const oldUrl=await serve(process.env.CAFE_BASELINE_ROOT,5188),newUrl=await serve(path.resolve('src/MnahelsCafe.Pos/wwwroot'),5189),browser=await chromium.launch({channel:'msedge',headless:true});
 async function open(role,url,label){console.log('Browser case: '+label);const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-PK',timezoneId:'Asia/Karachi'}),i=cookies[role].indexOf('=');await context.addCookies([{name:cookies[role].slice(0,i),value:cookies[role].slice(i+1),url,httpOnly:true}]);const page=await context.newPage();let stylesheetRequests=0;
  page.on('request',r=>{if(r.resourceType()==='stylesheet')stylesheetRequests++});page.on('pageerror',e=>errors.push({label,error:e.message,stack:e.stack?.slice(0,1000)}));page.on('dialog',d=>d.dismiss());
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof state!=='undefined'&&state.user&&state.menu?.length>0,{},{timeout:30000});await page.evaluate(()=>window.navigate?.('pos'));await page.waitForTimeout(4500);await page.evaluate(()=>document.fonts.ready);
  const selectors=['.sidebar','.topbar','.categories','.product-grid','.product-card','.cart-panel','.cart-head','#place-order','.search','#clock-time','#total','.ma-food-media'];
  const styles=await page.evaluate(selectors=>Object.fromEntries(selectors.map(selector=>{const el=document.querySelector(selector);if(!el)return[selector,null];const s=getComputedStyle(el);return[selector,Object.fromEntries(['color','backgroundColor','fontSize','fontFamily','fontWeight','lineHeight','padding','margin','borderWidth','borderRadius','display','gap','gridTemplateColumns','flexDirection','letterSpacing'].map(k=>[k,s[k]]))]})),selectors);assert(styles['.product-card'],'Product cards missing');
  await page.evaluate(()=>{window.__qaNavMutations=0;new MutationObserver(rows=>window.__qaNavMutations+=rows.length).observe(document.querySelector('.sidebar nav'),{childList:true,subtree:true,characterData:true,attributes:true})});
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const values=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value])),begin=await values();await page.waitForTimeout(8000);const end=await values(),navMutations=await page.evaluate(()=>window.__qaNavMutations),latencies=[];
  for(const value of ['pizza','coffee',''])latencies.push(await page.evaluate(async value=>{const t=performance.now(),input=document.querySelector('#search');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-t},value));
  await page.screenshot({path:path.join(output,label+'.png'),fullPage:true,timeout:10000});measurements[label]={stylesheetRequests,navMutations,idleScriptSeconds:end.ScriptDuration-begin.ScriptDuration,idleTaskSeconds:end.TaskDuration-begin.TaskDuration,searchFrameMilliseconds:latencies,styles};persist();console.log(JSON.stringify({label,...measurements[label],styles:undefined}));if(label.startsWith('before'))await context.close();return page;
 }
 try{
  for(const role of ['Admin','Cashier'])await open(role,oldUrl,'before-'+role);
  for(const role of ['Admin','Cashier'])pages[role]=await open(role,newUrl,'after-'+role);
  for(const role of ['Admin','Cashier']){const a=measurements['before-'+role],b=measurements['after-'+role];assert.deepEqual(b.styles,a.styles,role+' computed CSS changed');assert(b.stylesheetRequests<a.stylesheetRequests,role+' stylesheet requests not reduced')}
  for(const page of Object.values(pages))await page.waitForFunction(()=>window.cafeCatalog?.stamp,{},{timeout:15000});
  await pages.Cashier.evaluate(()=>{const p=state.menu[0].products[0],v=p.variants[0];state.cart=[{variantId:v.id,name:p.name,variant:v.name,price:v.price,quantity:2}];window.renderCart?.()});
 }catch(e){persist();await browser.close();for(const s of servers)s.close();throw e}
 return{
  async catalog(id,present){for(const page of Object.values(pages))await page.waitForFunction(({id,present})=>state.menu.flatMap(c=>c.products).some(p=>p.id===id)===present,{id,present},{timeout:20000});assert.equal(await pages.Cashier.evaluate(()=>state.cart[0]?.quantity),2,'Ordinary update lost draft')},
  async reset(epoch){for(const page of Object.values(pages)){await page.waitForFunction(epoch=>window.cafeCatalog?.stamp?.epoch===epoch,epoch,{timeout:25000});assert.equal(await page.evaluate(()=>state.cart.length),0,'Reset retained stale cart')}},
  async close(){persist();await browser.close();for(const s of servers)s.close();console.log('Browser report saved.');assert.equal(errors.filter(x=>x.label.startsWith('after')).length,0,'Browser errors: '+JSON.stringify(errors.filter(x=>x.label.startsWith('after')).slice(0,6)))}
 };
};
