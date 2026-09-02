/* Mnahel's Cafe POS v0.15.32 · viewport, performance, and service visibility */
(()=>{'use strict';
const BUILD='0.15.32',REV='20260901-performance-service-32';
const q=(s,r=document)=>r.querySelector(s);
function resetViewport(){try{history.scrollRestoration='manual'}catch{}try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch{window.scrollTo(0,0)}document.documentElement.scrollTop=0;document.body.scrollTop=0;q('.main')?.scrollTo?.(0,0)}
function loginViewport(){const login=q('#login-screen');if(login&&!login.classList.contains('hidden')){document.documentElement.classList.add('v54-login-visible');resetViewport()}else document.documentElement.classList.remove('v54-login-visible')}
document.addEventListener('click',event=>{if(event.target.closest?.('#logout')){try{sessionStorage.setItem('mnahels-reset-scroll','1')}catch{}resetViewport()}},true);
window.addEventListener('pageshow',()=>{let reset=false;try{reset=sessionStorage.getItem('mnahels-reset-scroll')==='1';sessionStorage.removeItem('mnahels-reset-scroll')}catch{}if(reset||!q('#login-screen')?.classList.contains('hidden'))resetViewport();loginViewport()});
function boot(){document.documentElement.dataset.uiRevision=REV;window.__MNAHELS_UI_REVISION__=REV;loginViewport();const service=q('#screen-service');if(service)service.classList.toggle('v54-readonly',state?.user?.role!=='Admin')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();setTimeout(boot,650);setTimeout(boot,1600);
window.mnahelsV54={build:BUILD,uiRevision:REV,resetViewport};
})();
