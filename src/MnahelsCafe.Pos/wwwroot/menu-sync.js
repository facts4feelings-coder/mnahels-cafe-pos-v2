/* Shared Admin/Cashier catalog. Copyright (c) 2026 Eastern Cross Technology. */
(()=>{'use strict';
const app=()=>{try{return window.state||state}catch{return null}},stats={probes:0,reloads:0,renders:0,failures:0};
let stamp=null,pending=null,timer=0,backoff=3000,stopped=false,channel=null;try{channel=new BroadcastChannel('mnahels-catalog')}catch{}
const say=text=>{try{window.toast?.(text)}catch{}};
async function get(path){const r=await fetch(path,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Catalog '+r.status);return r.json()}
function arm(){clearTimeout(timer);if(!stopped&&document.visibilityState!=='hidden')timer=setTimeout(()=>check().finally(arm),backoff)}
function reloadForReset(){stopped=true;clearTimeout(timer);try{sessionStorage.setItem('cafe.catalog.notice','Database reset/restore hua hai. Naya menu load ho gaya; purana draft clear kar diya gaya.')}catch{}location.reload()}
async function synchronize(force=false){const s=app();if(!s?.user||stopped)return false;stats.probes++;const next=await get('/api/menu/revision');if(stamp&&stamp.epoch!==next.epoch){reloadForReset();return false}if(!force&&stamp?.revision===next.revision)return false;
 const menu=await get('/api/menu'),verified=await get('/api/menu/revision');if(verified.revision!==next.revision||verified.epoch!==next.epoch){backoff=500;return false}if(app()!==s||!s.user||stopped)return false;
 const changed=JSON.stringify(s.menu)!==JSON.stringify(menu),previous=stamp;
 if(changed){s.menu=menu;if(s.category!=='All'&&!menu.some(c=>c.name===s.category||String(c.id)===String(s.category)))s.category='All';window.renderCategories?.();window.renderProducts?.();stats.renders++;if(Array.isArray(s.cart)&&s.cart.length&&previous)say('Menu update hua hai. Cart ki prices aur availability confirm karein.')}
 stamp=verified;stats.reloads++;document.dispatchEvent(new CustomEvent('cafe:catalog-updated',{detail:{menu,stamp:verified}}));if(previous&&previous.revision!==verified.revision)try{channel?.postMessage('changed')}catch{}return changed;
}
function check(force=false){if(pending)return pending;pending=synchronize(force).then(result=>{backoff=3000;return result}).catch(()=>{stats.failures++;backoff=Math.min(30000,backoff*2);return false}).finally(()=>{pending=null});return pending}
function wake(){if(document.visibilityState==='hidden'){clearTimeout(timer);return}clearTimeout(timer);check().finally(arm)}
window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);channel?.close()},{once:true});if(channel)channel.onmessage=()=>check().finally(arm);
window.cafeCatalog={check,stats,get stamp(){return stamp}};
setTimeout(()=>{try{const notice=sessionStorage.getItem('cafe.catalog.notice');if(notice){sessionStorage.removeItem('cafe.catalog.notice');say(notice)}}catch{}wake()},1200);
})();
