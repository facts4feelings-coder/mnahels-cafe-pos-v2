/* Receipt transport only; keeps v63's current HTML/layout and JPG renderer.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
(()=>{
'use strict';
// Do not discard distinct JPG updates merely because they share a token/kind.
// v59 installs its legacy anchor hook on DOMContentLoaded, after this script.
window.__v59PrintDedupe=true;
const doneActions=new Map(),claimed=new Set();
let queue=Promise.resolve(),uncertain=false,serial=0;
const say=message=>window.toast?.(message);
function once(key,task){if(doneActions.has(key))return doneActions.get(key);const run=Promise.resolve().then(task);doneActions.set(key,run);while(doneActions.size>512)doneActions.delete(doneActions.keys().next().value);return run}
function claim(key){if(claimed.has(key))return false;claimed.add(key);if(claimed.size>512)claimed.delete(claimed.values().next().value);return true}
function amendmentKey(order,result){return 'amend:'+order.id+':'+(result?.amendmentId||result?.amendedAt||JSON.stringify([result?.additions,result?.cancellations,result?.updatedTotal]))}
function bridge(type){
 if(!(window.__mnahelsDualPrintBridge&&window.chrome?.webview?.postMessage)){window.print();return Promise.resolve(true)}
 if(!window.__mnahelsPrintJobBridge)return Promise.reject(Error('Update this Windows app to v0.15.58 before printing. Your order is saved.'));
 const id=Date.now().toString(36)+'-'+(++serial);
 return new Promise((resolve,reject)=>{
  let timedOut=false;
  const handler=event=>{
   const message=String(event.data||'');
   if(message!=='mnahels-print-result:'+id+':done'&&message!=='mnahels-print-result:'+id+':cancelled')return;
   clearTimeout(timer);window.chrome.webview.removeEventListener('message',handler);
   if(timedOut){uncertain=false;say('Printer replied. Check existing copies before manually reprinting.');return}
   resolve(message.endsWith(':done'));
  };
  const timer=setTimeout(()=>{timedOut=true;uncertain=true;reject(Error('Printer response delayed. Printing paused; check Windows print queue before reprinting.'));},30000);
  window.chrome.webview.addEventListener('message',handler);
  try{window.chrome.webview.postMessage('mnahels-print-job:'+JSON.stringify({id,type}))}
  catch(error){clearTimeout(timer);window.chrome.webview.removeEventListener('message',handler);reject(error)}
 });
}
async function stage(source,type){
 const sheet=document.querySelector('#print-sheet');if(!sheet)throw Error('Print sheet is missing.');
 document.dispatchEvent(new Event('mnahels-print-stage'));
 sheet.removeAttribute('style');sheet.className='print-sheet tp-sheet '+type+' v64-print';
 sheet.innerHTML=window.mnahelsV63?.cleanHtml(source)||source;
 if(String(sheet.textContent||'').replace(/\s+/g,' ').trim().length<20)throw Error('Receipt is empty; nothing was printed.');
 window.mnahelsV63?.apply();
 await document.fonts?.ready;
 await Promise.all([...sheet.querySelectorAll('img')].map(i=>i.decode?i.decode().catch(()=>{}):Promise.resolve()));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
function printHtml(html,type='customer'){
 const source=String(html||'');
 const task=async()=>{
  if(uncertain)throw Error('Previous printer job is unconfirmed. Automatic retry is disabled.');
  await stage(source,type);
  const ok=await bridge(type);
  if(!ok)say('Print not accepted. Order remains saved; check printer and use manual reprint.');
  return ok;
 };
 const run=queue.then(task,task);queue=run.catch(error=>say(error.message));return run;
}
window.mnahelsV64={once,claim,amendmentKey,printHtml};
})();
