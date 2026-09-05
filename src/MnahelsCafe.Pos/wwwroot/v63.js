/* Mnahel's Cafe POS · one receipt renderer and serialized print jobs.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * Keeps the existing v43/v61/v62 HTML templates and WebView2 print bridge. */
(()=>{
'use strict';
const q=s=>document.querySelector(s),doneActions=new Map(),claimed=new Set();
let queue=Promise.resolve(),uncertain=false,serial=0;
const nativePrint=window.print.bind(window);
const say=m=>window.toast?.(m);
function once(key,task){
 if(doneActions.has(key))return doneActions.get(key);
 const run=Promise.resolve().then(task);doneActions.set(key,run);
 return run;
}
function claim(key){if(claimed.has(key))return false;claimed.add(key);return true;}
function amendmentKey(order,result){return 'amend:'+order.id+':'+(result?.amendmentId||result?.amendedAt||JSON.stringify([result?.additions,result?.cancellations,result?.updatedTotal]));}
function settings(){return window.mnahelsV45?.printSettings?.()||{widthPx:302};}
function syncWidth(){document.documentElement.style.setProperty('--v63-receipt-width',settings().widthPx+'px');}
function freeze(source){
 if(!source)throw Error('Receipt HTML not found.');
 const receipt=source.matches?.('.v43-receipt,.tp')?source:source.querySelector('.v43-receipt,.tp');
 if(!receipt)throw Error('Receipt HTML not found.');
 const host=document.createElement('div');host.className='v63-capture v31-paper';
 host.style.cssText='position:fixed;left:-20000px;top:0;display:block;visibility:visible;background:white;width:'+settings().widthPx+'px;';
 const live=receipt.cloneNode(true);host.append(live);document.body.append(host);
 try{
  live.style.setProperty('width',settings().widthPx+'px','important');
  live.style.setProperty('max-width','none','important');
  const rect=live.getBoundingClientRect(),copy=live.cloneNode(true);
  const a=[live,...live.querySelectorAll('*')],b=[copy,...copy.querySelectorAll('*')];
  a.forEach((element,i)=>{const css=getComputedStyle(element);for(const prop of css)b[i].style.setProperty(prop,css.getPropertyValue(prop),'important');});
  copy.style.setProperty('margin','0','important');
  const width=Math.ceil(rect.width),height=Math.ceil(rect.height);
  if(!width||!height||width*height>16000000)throw Error('Receipt dimensions are invalid or too large; nothing was cropped.');
  return {html:copy.outerHTML,xml:new XMLSerializer().serializeToString(copy),width,height,kind:receipt.dataset.receiptKind||'customer',text:receipt.textContent||''};
 }finally{host.remove();}
}
function fromHtml(html){const box=document.createElement('div');box.innerHTML=html;return freeze(box);}
async function jpeg(snapshot,name){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+snapshot.width+'" height="'+snapshot.height+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">'+snapshot.xml+'</div></foreignObject></svg>';
 // Data URL avoids the tainted-canvas path used by blob SVG foreignObjects.
 const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 await image.decode();
 const canvas=document.createElement('canvas');canvas.width=snapshot.width*2;canvas.height=snapshot.height*2;
 const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('JPG generation failed.')),'image/jpeg',.98));
 const token=(snapshot.text.match(/MC-\d+/)||['receipt'])[0].replace('-','_');
 const fileName=name||token+'_'+snapshot.kind+'.jpeg',url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 return {name:fileName,width:snapshot.width,height:snapshot.height};
}
async function downloadHtml(source,name){await document.fonts?.ready;syncWidth();return jpeg(freeze(source),name);}
function bridge(type){
 if(!(window.__mnahelsDualPrintBridge&&window.chrome?.webview?.postMessage)){
  nativePrint();return Promise.resolve(true);
 }
 const id=Date.now().toString(36)+'-'+(++serial);
 return new Promise((resolve,reject)=>{
  let timedOut=false;
  const handler=event=>{
   const message=String(event.data||'');
   if(message!=='mnahels-print-result:'+id+':done'&&message!=='mnahels-print-result:'+id+':cancelled')return;
   clearTimeout(timer);window.chrome.webview.removeEventListener('message',handler);
   if(timedOut){uncertain=false;say('Printer replied. Check printed copies before using manual reprint.');return;}
   resolve(message.endsWith(':done'));
  };
  const timer=setTimeout(()=>{timedOut=true;uncertain=true;reject(Error('Printer response delayed. Automatic printing paused; check the printer before reprinting.'));},30000);
  window.chrome.webview.addEventListener('message',handler);
  try{window.chrome.webview.postMessage('mnahels-print-job:'+JSON.stringify({id,type}));}
  catch(error){clearTimeout(timer);window.chrome.webview.removeEventListener('message',handler);reject(error);}
 });
}
function printHtml(html,type='customer'){
 // HTML is captured at the call boundary, never read from a later order.
 const source=String(html||'');
 const task=async()=>{
  if(uncertain)throw Error('Previous printer job is unconfirmed. Check the printer; automatic retry is disabled.');
  await document.fonts?.ready;syncWidth();
  const snapshot=fromHtml(source),sheet=q('#print-sheet');
  if(!sheet||!(/MC-\d+/.test(snapshot.text)))throw Error('Receipt has no valid order number.');
  sheet.removeAttribute('style');sheet.className='print-sheet tp-sheet '+type+' v63-print';sheet.innerHTML=snapshot.html;
  const ok=await bridge(type);
  if(!ok){say('Print was not accepted. Order remains saved; use manual reprint.');return false;}
  let auto=false;try{auto=localStorage.getItem('mnahels.receipt-auto-jpg')!=='0';}catch{}
  if(auto)try{await jpeg(snapshot);}catch(error){say('Printed, but JPG download failed: '+error.message);}
  return true;
 };
 const run=queue.then(task,task);queue=run.catch(error=>say(error.message));return run;
}
function printStaged(){const sheet=q('#print-sheet');return printHtml(sheet?.innerHTML||'',sheet?.classList.contains('kitchen')?'kitchen':'customer');}
const style=document.createElement('style');style.textContent='#receipt-preview-body .v43-receipt,.v31-paper .v43-receipt{width:var(--v63-receipt-width,302px)!important;max-width:none!important} .v63-capture{pointer-events:none} @media print{#print-sheet.v63-print{width:var(--v63-receipt-width,302px)!important}}';document.head.append(style);
document.addEventListener('mnahels-print-settings-changed',syncWidth);document.addEventListener('mnahels-shared-print-settings-applied',syncWidth);syncWidth();
window.mnahelsV63={once,claim,amendmentKey,printHtml,printStaged,downloadHtml,freeze,jpeg};
})();
