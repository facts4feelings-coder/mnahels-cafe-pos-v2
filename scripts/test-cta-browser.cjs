/* Actual v61 source + real MutationObserver regression. Default: full application
 * in Windows Edge with an owned disposable HTTP/SQLite fixture. --source-only:
 * isolated DOM contract test (no server/payment/native/visual acceptance claim).
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const sourceOnly=process.argv.includes('--source-only');
const timeout=setTimeout(()=>{console.error('CTA tests exceeded four minutes');process.exit(1)},240000);timeout.unref();
(async()=>{
 let f,browser,complete=false;const checks=[],errors=[],measurements=[];
 try{
  if(!sourceOnly)f=await require('./fixtures/cafe-server.cjs')();
  const launch=process.env.CAFE_CHROMIUM_EXECUTABLE?{executablePath:process.env.CAFE_CHROMIUM_EXECUTABLE}:{channel:'msedge'};
  browser=await chromium.launch({...launch,headless:true});
  for(const role of ['Admin','Cashier'])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-PK',timezoneId:'Asia/Karachi'});
   try{
    if(f){const i=f.cookies[role].indexOf('=');await context.addCookies([{name:f.cookies[role].slice(0,i),value:f.cookies[role].slice(i+1),url:f.base,httpOnly:true}])}
    const page=await context.newPage();page.on('pageerror',e=>errors.push({role,theme,error:e.message}));
    if(sourceOnly){
     await page.setContent('<section id="screen-pos" class="screen active"><div class="catalog-panel" id="product-grid"></div><aside class="cart-panel"><div class="cart-head"></div><div id="cart-items"></div><button id="place-order"><span>Book order</span><b>Rs 0</b></button></aside></section>');
     await page.evaluate(role=>{window.state={user:{role},cart:[],orderType:'Takeaway'}},role);
     await page.addScriptTag({content:fs.readFileSync(process.env.CAFE_CTA_SOURCE||path.resolve('src/MnahelsCafe.Pos/wwwroot/v61.js'),'utf8')});
    }else{
     await page.goto(f.base+'/?screen=pos',{waitUntil:'domcontentloaded'});
     await page.waitForFunction(()=>state.user&&window.cafeCatalog?.stamp&&state.menu.length>0&&window.mnahelsV61,null,{timeout:30000});
    }
    await page.evaluate(theme=>{if(window.setTheme)window.setTheme(theme);else document.documentElement.dataset.theme=theme},theme);
    const result=await page.evaluate(async()=>{
     const root=document.querySelector('#screen-pos'),original=root.querySelectorAll;let scans=0;
     root.querySelectorAll=function(selector){if(selector==='b,strong,small,span')scans++;return original.call(this,selector)};
     try{for(let n=0;n<100;n++)window.mnahelsV61.refresh()}finally{root.querySelectorAll=original}
     const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const saved=state.v56EditingOrderId;
     const probe=document.createElement('span');probe.textContent='Book first';root.append(probe);
     const summary=document.createElement('small');summary.textContent='Order will be Booked + Unpaid';root.append(summary);
     const unrelated=document.createElement('b');unrelated.textContent='Pizza';root.append(unrelated);
     state.v56EditingOrderId=987654;window.mnahelsV61.refresh();
     const immediate=probe.textContent;await frames();
     const editing={probe:probe.textContent,button:document.querySelector('#place-order span').textContent,summary:summary.textContent};
     probe.firstChild.data='Place order';await frames();const repaired=probe.textContent;
     unrelated.firstChild.data='Book first';await frames();const discovered=unrelated.textContent;
     const group=document.createElement('div');group.innerHTML='<div><strong>Book first</strong></div>';root.append(group);await frames();const nested=group.querySelector('strong').textContent;
     // A formerly cached leaf must stop being edited when it acquires children.
     probe.innerHTML='<em>Book first</em>';window.mnahelsV61.refresh();await frames();const childPreserved=!!probe.querySelector('em');
     const heading=document.createElement('span');heading.id='v61-new-added';heading.textContent='Book first';group.append(heading);await frames();const headingPreserved=heading.textContent;
     const detached=group.querySelector('strong');detached.remove();detached.textContent='Place order';window.mnahelsV61.refresh();await frames();const detachedPreserved=detached.textContent;
     group.append(detached);await frames();const reinserted=detached.textContent;
     state.v56EditingOrderId=saved;window.mnahelsV61.refresh();await frames();
     const cancelled={label:unrelated.textContent,button:document.querySelector('#place-order span').textContent,summary:summary.textContent};
     for(let n=0;n<100;n++){const item=document.createElement('span');item.textContent='Book first';group.append(item);item.remove()}
     await frames();
     let mutations=0;const observer=new MutationObserver(rs=>mutations+=rs.length);observer.observe(group,{childList:true,subtree:true,characterData:true});
     for(let n=0;n<100;n++)window.mnahelsV61.refresh();await frames();observer.disconnect();
     probe.remove();summary.remove();unrelated.remove();group.remove();await frames();
     return{scans,immediate,editing,repaired,discovered,nested,childPreserved,headingPreserved,detachedPreserved,reinserted,cancelled,mutations};
    });
    const label=role+'/'+theme;
    assert(result.scans<=1,label+' unnecessary full-root scans: '+result.scans);
    assert.equal(result.immediate,'Update order',label+' same-task discovery');
    assert.deepEqual(result.editing,{probe:'Update order',button:'Update order',summary:'Order will be Updated'});
    for(const key of ['repaired','discovered','nested','reinserted'])assert.equal(result[key],'Update order',label+' '+key);
    assert.equal(result.childPreserved,true,label+' child content was overwritten');
    assert.equal(result.headingPreserved,'Book first');assert.equal(result.detachedPreserved,'Place order');
    assert.deepEqual(result.cancelled,{label:'Book first',button:'Book order',summary:'Order will be Booked + Unpaid'});
    assert.equal(result.mutations,0,label+' idle label mutations');
    measurements.push({role,theme,refreshes:100,fullRootDiscoveryScans:result.scans,idleLabelMutations:result.mutations});
    checks.push(label+': bounded discovery, edit/cancel, same-task/new/nested/text-node labels, exclusions, detach/reinsert, stable repeated refresh');
    if(sourceOnly){
     const replaced=await page.evaluate(async()=>{
      const old=document.querySelector('#screen-pos'),next=old.cloneNode(true);old.replaceWith(next);state.v56EditingOrderId=0;window.mnahelsV61.refresh();
      const label=document.createElement('span');label.textContent='Book first';next.append(label);state.v56EditingOrderId=1;window.mnahelsV61.refresh();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const result=label.textContent;old.querySelector('#place-order span').textContent='detached';
      document.querySelector('#screen-pos').remove();window.mnahelsV61.refresh();document.body.append(next);state.v56EditingOrderId=0;window.mnahelsV61.refresh();
      return{editing:result,restored:label.textContent};
     });assert.deepEqual(replaced,{editing:'Update order',restored:'Book first'});checks.push(label+': replaced/missing/reinserted POS root');
    }
   }finally{await context.close()}
  }
  assert.equal(errors.length,0,JSON.stringify(errors));complete=true;
  console.log('PASS CTA '+(sourceOnly?'source DOM':'full-app browser')+': '+checks.join('; '));
 }finally{
  fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/v61-cta-tests.json',JSON.stringify({scope:sourceOnly?'actual v61 source in isolated Chromium DOM':'full application in Edge + temporary HTTP/SQLite',head:process.env.GITHUB_SHA||null,checks,measurements,errors,complete},null,2));
  try{if(browser)await browser.close()}finally{if(f)await f.close();clearTimeout(timeout)}
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1});
