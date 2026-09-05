/* Final v0.15.57 presentation/performance patch; runs AFTER the existing patches.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path');
const web=path.resolve(__dirname,'../src/MnahelsCafe.Pos/wwwroot');
const read=n=>fs.readFileSync(path.join(web,n),'utf8').replace(/\r\n/g,'\n');
const write=(n,s)=>{if(n.endsWith('.js'))new Function(s);fs.writeFileSync(path.join(web,n),s)};
function required(s,a,b,label){if(s.includes(b))return s;if(!s.includes(a))throw Error('v57 missing '+label);return s.replace(a,b)}
for(const name of ['v43.js','v61.js','v62.js']){
 let s=read(name);
 if(!s.includes('/*v63-clean*/')){
  const start=s.indexOf(name==='v61.js'?"return '<article class=":"return`<article class=");
  const end=s.indexOf(name==='v61.js'?"</article>'":"</article>`",start);
  if(start<0||end<start)throw Error('Receipt expression missing '+name);
  const expression=s.slice(start+6,end+11).trimStart();
  s=s.slice(0,start)+'return (window.mnahelsV63?.cleanHtml||String)('+expression+');/*v63-clean*/'+s.slice(end+11).replace(/^;/,'');
 }
 write(name,s);
}
let v31=read('v31.js');
v31=required(v31,"const FONTS=[9,10,11,12];","const FONTS=[9,10,11,12,14,16,18,20];",'font buttons');
v31=required(v31,"const font=()=>num(FKEY,12,8,15);","const font=()=>num(FKEY,11,8,20);",'font default');
v31=required(v31,"if(!isFinite(savedF)||savedF<12)localStorage.setItem(FKEY,'12');","if(!isFinite(savedF))localStorage.setItem(FKEY,'11');",'preserve saved font');
v31=v31.replace('n<8||n>15','n<8||n>20').replace('between 8 and 15 px','between 8 and 20 px').replace('font 12 px</b>','font 11 px</b>');write('v31.js',v31);
let v45=read('v45.js');
v45=required(v45,"fontPx=settingNum('mnahels.print-font',12,8,20)","fontPx=settingNum('mnahels.print-font',11,8,20)",'JPG font default');
v45=required(v45,"const width=printSettings().widthPx,rendered=receipt.classList.contains('v43-receipt')?drawV43(receipt,width):drawGeneric(receipt,width);","const width=printSettings().widthPx,rendered=receipt.classList.contains('v43-receipt')&&window.mnahelsV63?await window.mnahelsV63.renderCanvas(receipt,printSettings()):receipt.classList.contains('v43-receipt')?drawV43(receipt,width):drawGeneric(receipt,width);",'actual-layout JPG');
v45=required(v45,'function downloadElement(source,name,quiet=false){return queueExport','function downloadElement(source,name,quiet=false){if(source)source=source.cloneNode(true);return queueExport','snapshot queued receipt');write('v45.js',v45);
let v41=read('v41.js');
v41=required(v41,"if(payLabel)payLabel.textContent=isPaid(order)?order.paymentMethod||'Paid':'Payment due';","if(payLabel){const want=isPaid(order)?order.paymentMethod||'Paid':'Payment due';if(payLabel.textContent!==want)payLabel.textContent=want;}",'payment-card feedback');
for(const [i,label]of ['Paid sales','Booked active','Outstanding','Active kitchen'].entries())v41=required(v41,`q('small',cards[${i}]).textContent='${label}';`,`if(q('small',cards[${i}]).textContent!=='${label}')q('small',cards[${i}]).textContent='${label}';`,'metric feedback '+i);
write('v41.js',v41);
let v51=read('v51.js');for(const key of ['cartHook','totalsHook','productsHook','apiHook'])v51=required(v51,'current==='+key,key+'!==null','one-time '+key);write('v51.js',v51);
let v43=read('v43.js');v43=required(v43,'new MutationObserver(()=>requestAnimationFrame(applyHotImages)).observe(document.body,{childList:true,subtree:true});',"let imageFrame=0;new MutationObserver(records=>{if(imageFrame||!records.some(r=>r.target.closest?.('#product-grid')))return;imageFrame=requestAnimationFrame(()=>{imageFrame=0;applyHotImages()})}).observe(document.body,{childList:true,subtree:true});",'coalesced product images');write('v43.js',v43);
for(const name of ['v56.js','v57.js','v58.js','v59.js','v60.js','v61.js','v62.js']){let s=read(name).replace(/const RELEASE = '[^']+'/g,"const RELEASE = '0.15.57'").replace(/const BUILD='[^']+'/g,"const BUILD='0.15.57'");write(name,s)}
let v63=read('v63.js');v63=v63.replace('Math.max(18.5,f+5)','f').replace("rule(' .v43-seal *','font-size:10px!important;line-height:1.3!important;');","rule(' .v43-seal *',`font-size:${f}px!important;line-height:1.3!important;`);");v63=v63.replaceAll('minmax(0,13%)','minmax(2.2em,13%)').replaceAll('minmax(0,16%)','minmax(2.2em,16%)');write('v63.js',v63);
let index=read('index.html');if(!index.includes('/v63.js'))index=index.replace('</body>','<script src="/v63.js?v=20260905-receipt-wrap-57"></script>\n</body>');index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="0.15.57">');write('index.html',index);
console.log('v0.15.57 existing receipt layout, wrap, JPG and observer fixes applied.');
