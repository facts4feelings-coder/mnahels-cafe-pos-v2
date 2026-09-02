/*
 * Mnahel's Cafe POS · v0.15.36 printer recovery and category rail polish
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
(()=>{
'use strict';
const BUILD='0.15.36',REV='20260903-printer-recovery-36',AUTO_KEY='mnahels.receipt-auto-jpg';
const q=(selector,root=document)=>root.querySelector(selector);
let manualDownloadUntil=0;

function say(message){try{if(typeof toast==='function')toast(message)}catch{}}
function forceManualJpgOnly(){
 try{localStorage.setItem(AUTO_KEY,'0')}catch{}
 const toggle=q('#v45-auto-jpg');
 if(toggle){toggle.checked=false;toggle.disabled=true;const label=toggle.closest('label');if(label){label.classList.add('v56-manual-only');const title=q('b',label),note=q('small',label);if(title)title.textContent='Automatic JPG download off';if(note)note.textContent='Use Download JPG slip only when needed'}}
}
function lockAutoJpgPreference(){
 const proto=window.Storage?.prototype;if(!proto||proto.setItem.__v56ManualOnly)return;
 const original=proto.setItem;
 const wrapped=function(key,value){return original.call(this,key,String(key)===AUTO_KEY?'0':value)};
 wrapped.__v56ManualOnly=true;proto.setItem=wrapped;forceManualJpgOnly();
}
function installSlipDownloadGate(){
 const proto=window.HTMLAnchorElement?.prototype;if(!proto||proto.click.__v56SlipGate)return;
 const previous=proto.click;
 const guarded=function(){
  const name=String(this.download||''),isSlip=/mnahels-.*-slip\.jpe?g$/i.test(name)&&String(this.href||'').startsWith('blob:');
  if(isSlip&&Date.now()>manualDownloadUntil){try{URL.revokeObjectURL(this.href)}catch{}return}
  return previous.apply(this,arguments);
 };
 guarded.__v56SlipGate=true;proto.click=guarded;
}
function markManualDownload(event){
 const button=event.target.closest?.('#v45-preview-download,#v45-v31-download,#v45-settings-download,.v45-download');
 if(button)manualDownloadUntil=Date.now()+5000;
 const autoToggle=event.target.closest?.('#v45-auto-jpg');
 if(autoToggle){event.preventDefault();event.stopImmediatePropagation();forceManualJpgOnly();say('Automatic JPG download off hai. Manual Download JPG button use karein.')}
}
function decoratePrintButton(event){
 const button=event.target.closest?.('#v31-preview [data-pv="print"],#v31-now');if(!button)return;
 forceManualJpgOnly();
 if(button.dataset.v56Printing==='1'){event.preventDefault();event.stopImmediatePropagation();return}
 button.dataset.v56Printing='1';button.classList.add('v56-printing');
 const old=button.textContent;button.textContent='Printing…';
 setTimeout(()=>{button.dataset.v56Printing='0';button.classList.remove('v56-printing');button.textContent=old},2400);
}
function boot(){
 document.documentElement.dataset.uiRevision=REV;window.__MNAHELS_UI_REVISION__=REV;
 document.documentElement.classList.add('v56-manual-jpg');
 lockAutoJpgPreference();installSlipDownloadGate();forceManualJpgOnly();
}
document.addEventListener('click',markManualDownload,true);
document.addEventListener('click',decoratePrintButton,true);
document.addEventListener('mnahels-shared-print-settings-applied',forceManualJpgOnly);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,250);setTimeout(boot,1000);setTimeout(forceManualJpgOnly,2200);
window.mnahelsV56={build:BUILD,uiRevision:REV,forceManualJpgOnly};
})();
