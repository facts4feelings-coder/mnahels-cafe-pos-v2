/* Mnahel's Cafe POS · v0.15.25 shared print settings and cashier performance */
(()=>{
'use strict';
const BUILD='0.15.25',UI_REVISION='20260901-receipt-speed-25';
const KEYS={width:'mnahels.print-width',pad:'mnahels.print-pad',left:'mnahels.print-left',font:'mnahels.print-font',header:'mnahels.receipt-header',auto:'mnahels.receipt-auto-jpg'};
let syncing=false,ready=false,applying=false,saveTimer=0;
const user=()=>typeof state!=='undefined'?state.user:null;
const isAdmin=()=>String(user()?.role||'').toLowerCase()==='admin';
function number(key,fallback,min,max){const value=parseFloat(localStorage.getItem(key)||'');return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback}
function localSettings(){return{widthMm:number(KEYS.width,80,40,210),sideMarginMm:number(KEYS.pad,0,0,8),leftOffsetMm:number(KEYS.left,1,-8,8),fontPx:number(KEYS.font,12,8,15),headerStyle:localStorage.getItem(KEYS.header)==='white'?'white':'black',autoDownloadJpg:localStorage.getItem(KEYS.auto)!=='0'}}
function applyShared(value){
 if(!value?.configured)return;
 applying=true;
 try{
  localStorage.setItem(KEYS.width,String(value.widthMm));
  localStorage.setItem(KEYS.pad,String(value.sideMarginMm));
  localStorage.setItem(KEYS.left,String(value.leftOffsetMm));
  localStorage.setItem(KEYS.font,String(value.fontPx));
  localStorage.setItem(KEYS.header,value.headerStyle==='white'?'white':'black');
  localStorage.setItem(KEYS.auto,value.autoDownloadJpg===false?'0':'1');
  document.documentElement.dataset.receiptHeader=value.headerStyle==='white'?'white':'black';
  document.dispatchEvent(new Event('mnahels-print-settings-changed'));
  document.dispatchEvent(new Event('mnahels-shared-print-settings-applied'));
 }finally{applying=false}
}
async function saveShared(){
 if(!isAdmin()||typeof window.api!=='function')return false;
 try{await window.api('/api/receipt-settings',{method:'PUT',body:JSON.stringify(localSettings())});return true}catch(error){console.warn('[shared print settings]',error?.message||error);return false}
}
function queueSave(){if(applying||!isAdmin())return;clearTimeout(saveTimer);saveTimer=setTimeout(saveShared,220)}
async function syncShared(){
 if(syncing||!user()||typeof window.api!=='function'||document.visibilityState==='hidden')return false;
 syncing=true;
 try{
  const remote=await window.api('/api/receipt-settings');
  if(remote?.configured)applyShared(remote);
  else if(isAdmin())await saveShared();
  ready=true;return true;
 }catch(error){console.warn('[shared print settings]',error?.message||error);return false}
 finally{syncing=false}
}
document.addEventListener('mnahels-print-settings-changed',queueSave);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncShared()});
window.addEventListener('focus',syncShared);
const startup=setInterval(()=>{syncShared().then(ok=>{if(ok)clearInterval(startup)})},700);
setTimeout(syncShared,250);
setInterval(()=>{if(ready)syncShared()},15000);
document.documentElement.dataset.uiRevision=UI_REVISION;
window.mnahelsV47={build:BUILD,uiRevision:UI_REVISION,syncShared,saveShared};
})();
