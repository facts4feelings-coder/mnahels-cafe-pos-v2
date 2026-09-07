'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
// Deterministic scheduling test of the actual delayed-focus source statement.
// This isolates the race; the full real-UI matrix remains a separate required gate.
const original="requestAnimationFrame(()=>q('.v38-resource:not(:disabled),#v38-customer-name',dialog)?.focus());";
const patched="const focusOwner=document.activeElement;requestAnimationFrame(()=>{if(dialog.open&&(document.activeElement===focusOwner||document.activeElement===document.body))q('.v38-resource:not(:disabled),#v38-customer-name',dialog)?.focus()});";
assert(fs.readFileSync('src/MnahelsCafe.Pos/wwwroot/v38.js','utf8').includes(patched),'Test must match the committed production focus statement');
(async()=>{
 const browser=await chromium.launch(process.env.CAFE_CHROMIUM_EXECUTABLE?{executablePath:process.env.CAFE_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']}:{channel:'msedge',headless:true});
 try{
  for(const [name,code] of [['original',original],['patched',patched]]){
   for(const target of ['v38-customer-phone','v38-delivery-address','start','default','closed']){
    const page=await browser.newPage();
    await page.setContent('<dialog id="setup"><button id="close">Close</button><input id="v38-customer-name" value="QA UI Customer"><input id="v38-customer-phone"><input id="v38-delivery-address"><button id="start">Start</button></dialog>');
    await page.evaluate(code=>{
     window.q=(s,r=document)=>r.querySelector(s);window.dialog=q('#setup');dialog.showModal();q('#close').focus();
     window.framesToFlush=[];window.requestAnimationFrame=fn=>framesToFlush.push(fn);
     (0,eval)(code);
    },code);
    if(target==='closed')await page.evaluate(()=>dialog.close());
    else if(target!=='default')await page.locator('#'+target).focus();
    await page.evaluate(()=>framesToFlush.splice(0).forEach(fn=>fn()));
    const focused=await page.evaluate(()=>document.activeElement.id);
    if(target==='v38-customer-phone'||target==='v38-delivery-address'){
     const text=target.endsWith('phone')?'03001234567':'QA delivery address';await page.keyboard.insertText(text);
     const values=await page.evaluate(()=>({name:q('#v38-customer-name').value,phone:q('#v38-customer-phone').value,address:q('#v38-delivery-address').value}));
     if(name==='original'){assert.equal(focused,'v38-customer-name');assert.notEqual(values.name,'QA UI Customer');assert(values.name.includes(text));assert.equal(values.phone,'');assert.equal(values.address,'')}
     else{assert.equal(focused,target);assert.equal(values.name,'QA UI Customer');assert.equal(target.endsWith('phone')?values.phone:values.address,text)}
     console.log(name,target,JSON.stringify(values),name==='original'?'EXPECTED NEGATIVE CONTROL':'PASS');
    }else if(name==='patched'){
     if(target==='start')assert.equal(focused,'start');
     if(target==='default')assert.equal(focused,'v38-customer-name');
     if(target==='closed')assert.notEqual(focused,'v38-customer-name');
     console.log(name,target,'PASS');
    }
    await page.close();
   }
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
