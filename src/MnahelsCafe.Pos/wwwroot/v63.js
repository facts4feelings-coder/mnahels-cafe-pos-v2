/* v0.15.57 - existing receipt layout; presentation only.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const pref=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}};
const num=(k,d,min,max)=>{const n=parseFloat(pref(k,d));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):d};
function cleanHtml(html){
 if(!html||!String(html).includes('v43-receipt'))return html;
 const t=document.createElement('template');t.innerHTML=html;const r=t.content.querySelector('.v43-receipt');if(!r)return html;
 r.classList.add('v63-receipt');
 qa('.v62-update-banner,.v62-payment-state',r).forEach(n=>n.remove());
 qa('.tp-foot b,.tp-foot small',r).forEach(n=>{if(/eastern\s*cross|easterncrosstech|www\./i.test(n.textContent))n.remove()});
 if(r.dataset.receiptKind==='order-update')qa('.tp-foot',r).forEach(n=>n.remove());
 if(r.classList.contains('kitchen')){
  r.classList.add('v63-kitchen');
  qa('.v61-bill,.v43-summary,.v43-payment-grid,.v61-running-hint,.tp-foot,.v43-third,.tp-th>b',r).forEach(n=>n.remove());
  qa('.v43-item-name small',r).forEach(n=>{qa('.v61-add-tag,.v61-cancel-tag',n).forEach(tag=>tag.remove());n.innerHTML=n.innerHTML.replace(/\s*[-·]\s*Rs\s*[\d,.]+\s*each\s*/i,' ').replace(/\s*·\s*Prep line/,'').trim()});
 }
 return t.innerHTML;
}
function apply(){
 const f=num('mnahels.print-font',11,8,20),w=num('mnahels.print-width',80,40,210),pad=num('mnahels.print-pad',0,0,8),left=num('mnahels.print-left',1,-8,8);
 const families={'Courier New':'"Courier New",monospace','Lucida Console':'"Lucida Console",monospace',Consolas:'Consolas,monospace','Arial Narrow':'"Arial Narrow",Arial,sans-serif',Arial:'Arial,sans-serif',Tahoma:'Tahoma,sans-serif',Verdana:'Verdana,sans-serif','Segoe UI':'"Segoe UI",sans-serif'};
 const family=families[pref('mnahels.receipt-font-family','Courier New')]||families['Courier New'],white=pref('mnahels.receipt-header','black')==='white';
 const scopes=['html body #print-sheet .v43-receipt.v63-receipt','html body #receipt-preview-body .v43-receipt.v63-receipt','html body .v31-paper .v43-receipt.v63-receipt','html body .v63-export .v43-receipt.v63-receipt'];
 let css='';const rule=(suffix,body)=>{css+=scopes.map(p=>p+suffix).join(',')+'{'+body+'}'};
 rule('',`font-family:${family}!important;font-size:${f}px!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;height:auto!important;max-height:none!important;overflow:visible!important;color:#000!important;background:#fff!important;`);
 rule(' *',`font-family:inherit!important;font-size:${f}px!important;line-height:1.35!important;min-width:0!important;max-width:100%!important;max-height:none!important;box-sizing:border-box!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;text-overflow:clip!important;opacity:1!important;color:#000!important;text-shadow:none!important;`);
 for(const s of [' .tp-line',' .tp-total'])rule(s,'display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,38%)!important;align-items:start!important;height:auto!important;min-height:0!important;gap:6px!important;padding:5px 6px!important;overflow:visible!important;');
 for(const s of [' .tp-line b',' .tp-total b'])rule(s,'text-align:right!important;white-space:normal!important;overflow:visible!important;');
 for(const s of [' .tp-line span',' .tp-total span'])rule(s,'white-space:normal!important;overflow:visible!important;');
 rule(' .v43-meta-grid','grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;');
 rule(' .v43-meta-cell','height:auto!important;overflow:visible!important;');
 rule(' .v43-meta-cell *','overflow:visible!important;');
 for(const s of [' .v43-items .tp-th',' .v43-item-row'])rule(s,'display:grid!important;grid-template-columns:minmax(0,13%) minmax(0,1fr) minmax(0,29%)!important;align-items:stretch!important;height:auto!important;min-height:0!important;');
 rule(' .v43-item-row *','height:auto!important;overflow:visible!important;');
 rule('.v63-kitchen .v43-item-row','grid-template-columns:minmax(0,16%) minmax(0,1fr)!important;');
 rule('.v63-kitchen .tp-th','grid-template-columns:minmax(0,16%) minmax(0,1fr)!important;');
 rule(' .v43-dark-head',`height:auto!important;min-height:110px!important;grid-template-rows:auto auto!important;overflow:visible!important;background:${white?'#fff':'#000'}!important;color:${white?'#000':'#fff'}!important;`);
 rule(' .v43-dark-head *',`color:${white?'#000':'#fff'}!important;`);
 rule(' .v43-brand-line','max-width:100%!important;min-width:0!important;');
 rule(' .v43-brand-line>b',`font-size:${Math.max(18.5,f+5)}px!important;white-space:normal!important;`);
 rule(' .v43-brand-logo','width:28px!important;min-width:28px!important;flex:0 0 28px!important;');
 rule(' .v43-seal',`width:102px!important;max-width:100%!important;height:auto!important;min-height:31px!important;background:${white?'#fff':'#000'}!important;border-color:${white?'#000':'#fff'}!important;`);
 rule(' .v43-seal *','font-size:10px!important;line-height:1.3!important;');
 rule(' .v43-mode-icon',`min-width:26px!important;background:${white?'#fff':'#000'}!important;border-color:${white?'#000':'#fff'}!important;`);
 rule(' .v43-mode-icon svg',`stroke:${white?'#000':'#fff'}!important;`);
 rule(' .v61-running-banner','height:auto!important;overflow:visible!important;background:#000!important;color:#fff!important;');
 rule(' .v61-running-banner *','color:#fff!important;');
 for(const s of [' .v62-section-title',' .v62-previous-summary',' .v43-items',' .v43-summary'])rule(s,'height:auto!important;overflow:visible!important;');
 rule(' .v62-section-title','display:flex!important;flex-wrap:wrap!important;gap:4px!important;');
 rule(' .v62-section-title small','text-align:left!important;');
 css+=`html body #receipt-preview-body{max-width:100%;overflow:auto}html body #receipt-preview-body>.v43-receipt.v63-receipt,html body .v63-export>.v43-receipt.v63-receipt{width:${Math.max(30,w-Math.abs(left))}mm!important;padding:0 ${pad}mm!important;left:${Math.max(0,left)}mm!important}@media print{html body #print-sheet .v43-receipt.v63-receipt{width:${Math.max(30,w-Math.abs(left))}mm!important;padding:0 ${pad}mm!important;left:${Math.max(0,left)}mm!important}html body #print-sheet .v43-receipt.v63-receipt .v43-item-row,html body #print-sheet .v43-receipt.v63-receipt .tp-line,html body #print-sheet .v43-receipt.v63-receipt .tp-total{break-inside:avoid!important}}`;
 let style=q('#v63-receipt-style');if(!style){style=document.createElement('style');style.id='v63-receipt-style';document.head.append(style)}if(style.textContent!==css)style.textContent=css;
}
// Same automatic-JPG queue and filenames. Render the actual existing HTML layout,
// avoiding the old painter's hard-coded 90px header / 31px rows / truncated words.
async function renderCanvas(receipt,settings){
 apply();const width=settings.widthPx,host=document.createElement('div');host.className='v63-export';host.style.cssText=`position:fixed;left:-100000px;top:0;width:${width}px;background:#fff;pointer-events:none;`;
 host.innerHTML=cleanHtml(receipt.outerHTML);document.body.append(host);
 try{
  const root=host.firstElementChild;await new Promise(resolve=>requestAnimationFrame(resolve));
  const height=Math.ceil(Math.max(root.scrollHeight,root.getBoundingClientRect().height))+2;if(height>16000)throw Error('Receipt is too long for one JPG. Use print for this order.');
  const clone=root.cloneNode(true),originals=[root,...root.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  originals.forEach((node,i)=>{const c=getComputedStyle(node);let text='';for(const key of c)text+=key+':'+c.getPropertyValue(key)+';';copies[i].setAttribute('style',text)});
  const x=Math.max(0,settings.leftPx||0);clone.style.left='0';clone.style.position='relative';clone.style.margin='0';
  const markup=new XMLSerializer().serializeToString(clone),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width*2}" height="${height*2}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><foreignObject x="${x}" y="0" width="${width-x}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml">${markup}</div></foreignObject></svg>`;
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Receipt image could not be rendered.'));image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
  const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;const c=canvas.getContext('2d',{alpha:false});c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0);image.src='';return{canvas,width,height};
 }finally{host.remove()}
}
window.mnahelsV63={cleanHtml,apply,renderCanvas,build:'0.15.57'};
apply();document.addEventListener('mnahels-print-settings-changed',apply);document.addEventListener('mnahels-shared-print-settings-applied',apply);window.addEventListener('beforeprint',apply);
})();
