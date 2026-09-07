/* v0.15.59: receipt polish only; no booking or printing changes.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
(()=>{'use strict';
function polish(root){
 root.querySelectorAll('.v43-brand-logo text').forEach(n=>{n.setAttribute('y','16');n.setAttribute('dominant-baseline','central')});
 root.querySelectorAll('.v62-section-title b,.v62-summary .tp-line span,.v43-item-name em').forEach(n=>{if(/CANCELLED\s*\/\s*REMOVED(?:\s*ITEMS)?/i.test(n.textContent))n.textContent='CANCELLED ITEMS'});
 root.querySelectorAll('.v62-section-title').forEach(n=>{if(/PREVIOUS BILL/i.test(n.textContent)){n.classList.add('v65-previous-title');n.replaceChildren(Object.assign(document.createElement('b'),{textContent:'PREVIOUS BILL'}))}});
 root.querySelectorAll('.cancellations .v62-section-title small').forEach(n=>n.remove());
 const banner=root.querySelector('.v61-running-banner');
 if(root.dataset.receiptKind==='running-cancellation'){
  if(banner)banner.innerHTML='<b>RUNNING ORDER</b><small>CANCELLED ITEMS</small>';
  const seal=root.querySelector('.v43-seal');if(seal)seal.innerHTML='<strong>CANCELLED</strong><small>ITEMS</small>';
 }
 root.querySelectorAll('.tp-foot').forEach(n=>n.classList.add('v65-centered-footer'));return root;
}
function css(scopes){let out='';const rule=(s,v)=>out+=scopes.map(x=>x+s).join(',')+'{'+v+'}';
 rule('','border:1.5px solid #000!important;padding:0!important;');
 rule(' .v43-dark-head','border:0!important;border-bottom:1.5px solid #000!important;');
 rule(' .v43-brand-logo text','font-size:23px!important;line-height:1!important;font-weight:900!important;stroke:none!important;fill:currentColor!important;');
 rule(' .v65-centered-footer','display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;gap:3px!important;padding:8px 4px!important;');
 rule(' .v65-centered-footer>*','display:block!important;width:100%!important;max-width:100%!important;text-align:center!important;');
 rule(' .v65-previous-title','display:block!important;background:#000!important;color:#fff!important;text-align:center!important;padding:7px!important;');
 rule(' .v65-previous-title *','display:block!important;color:#fff!important;text-align:center!important;');
 rule(' .tp-th','font-weight:800!important;letter-spacing:.02em!important;');rule(' .tp-th>*','padding:7px 5px!important;');rule(' .v43-item-row>*','padding:7px 5px!important;');
 rule(' .v43-item-name small','font-weight:600!important;line-height:1.4!important;');rule(' .v43-item-name b','font-weight:800!important;');rule(' .v61-running-banner','text-align:center!important;padding:7px!important;');return out;
}
function boot(){window.mnahelsV63?.apply();document.querySelectorAll('#receipt-preview-body .v43-receipt').forEach(polish);document.querySelectorAll('#login-screen h1,#login-screen h2,.login-brand h1,.login-brand h2,.brand-title,.sidebar .brand h1,.sidebar .brand h2').forEach(n=>{if(/mnahe?l|mnahel/i.test(n.textContent))n.textContent='MNHEL CAFE'})}
window.mnahelsV65={polish,css};boot();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
