(()=>{
'use strict';
/* UI-only support layer. Order, payment, database and licensing logic are untouched. */
const BUILD='0.15.25',UI_REVISION='20260901-receipt-speed-25';
const HEADER_KEY='mnahels.receipt-header',AUTO_JPG_KEY='mnahels.receipt-auto-jpg',THEME_KEY='mnahels-theme',FONT_FAMILY_KEY='mnahels.receipt-font-family';
const PX_PER_MM=96/25.4;
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
let exportQueue=Promise.resolve(),autoTimer=0,lastAutoSignature='',lastAutoAt=0;

function pref(key,fallback){try{return localStorage.getItem(key)??fallback}catch{return fallback}}
function setPref(key,value){try{localStorage.setItem(key,value)}catch{}}
function headerStyle(){return pref(HEADER_KEY,'black')==='white'?'white':'black'}
function autoJpgEnabled(){return pref(AUTO_JPG_KEY,'0')!=='0'}
function receiptFontFamily(){const name=pref(FONT_FAMILY_KEY,'Courier New'),families={'Courier New':'"Courier New", monospace','Lucida Console':'"Lucida Console", monospace','Consolas':'Consolas, monospace','Arial Narrow':'"Arial Narrow", Arial, sans-serif','Arial':'Arial, sans-serif','Tahoma':'Tahoma, sans-serif','Verdana':'Verdana, sans-serif','Segoe UI':'"Segoe UI", sans-serif'};return families[name]||families['Courier New']}
function appTheme(){return pref(THEME_KEY,document.documentElement.dataset.theme||'dark')==='light'?'light':'dark'}
function setAppTheme(value){const next=value==='light'?'light':'dark';setPref(THEME_KEY,next);document.documentElement.dataset.theme=next;qa('[data-v45-theme]').forEach(button=>button.classList.toggle('active',button.dataset.v45Theme===next))}
function applyReceiptPrefs(){
  document.documentElement.dataset.receiptHeader=headerStyle();
  const toggle=q('#v45-auto-jpg');if(toggle)toggle.checked=autoJpgEnabled();
  qa('[data-v45-header]').forEach(button=>button.classList.toggle('active',button.dataset.v45Header===headerStyle()));
  setAppTheme(appTheme());
}

function settingNum(key,fallback,min,max){const value=parseFloat(pref(key,String(fallback)));return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback}
function printSettings(){const widthMm=settingNum('mnahels.print-width',80,40,210),padMm=settingNum('mnahels.print-pad',0,0,20),leftMm=settingNum('mnahels.print-left',1,-20,20),fontPx=settingNum('mnahels.print-font',12,8,20);return{widthMm,padMm,leftMm,fontPx,widthPx:Math.max(220,Math.round(widthMm*PX_PER_MM)),padPx:Math.round(padMm*PX_PER_MM),leftPx:Math.round(leftMm*PX_PER_MM),fontScale:fontPx/12}}
function cleanName(value){return String(value||'slip').trim().replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'slip'}
function slipName(source){
  const receipt=source.matches?.('.v43-receipt,.tp')?source:q('.v43-receipt,.tp',source);
  const kind=receipt?.dataset?.receiptKind||(source.classList?.contains('kitchen')?'kitchen':receipt?.classList?.contains('kitchen')?'kitchen':'customer');
  const text=source.textContent||'';
  const token=(text.match(/\bMC-\d+\b/i)||text.match(/\bTOKEN\s*#?\s*\d+\b/i)||[])[0]||new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  return `mnahels-${cleanName(token)}-${cleanName(kind)}-slip.jpg`;
}
function saveBlob(blob,name){
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.style.display='none';document.body.appendChild(anchor);anchor.click();
  setTimeout(()=>{anchor.remove();URL.revokeObjectURL(url)},1500);
}
function queueExport(task){const run=exportQueue.then(task,task);exportQueue=run.catch(()=>{});return run}
function textOf(node,selector,fallback=''){return q(selector,node)?.textContent?.trim()||fallback}

function createPainter(width,fontScale=1){
  const scale=2,scratch=document.createElement('canvas');scratch.width=width*scale;scratch.height=7000;
  const ctx=scratch.getContext('2d',{alpha:false});ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,3500);ctx.textBaseline='top';
  const family=receiptFontFamily();
  const font=(size,weight=700)=>ctx.font=`${weight} ${Math.max(6,size*fontScale)}px ${family}`;
  function wrap(value,maxWidth){
    const text=String(value??'').replace(/\s+/g,' ').trim();if(!text)return[''];
    const words=text.split(' '),lines=[];let line='';
    for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width<=maxWidth||!line)line=next;else{lines.push(line);line=word}}
    if(line)lines.push(line);return lines;
  }
  function drawLines(lines,x,y,lineHeight,align='left'){
    ctx.textAlign=align;for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*lineHeight);ctx.textAlign='left';
  }
  function strokeBox(x,y,w,h,line=1.4){ctx.lineWidth=line;ctx.strokeStyle='#000';ctx.setLineDash([]);ctx.strokeRect(x+.5,y+.5,w-1,h-1)}
  function crop(height){const h=Math.max(80,Math.ceil(height)),out=document.createElement('canvas');out.width=width*scale;out.height=h*scale;const c=out.getContext('2d',{alpha:false});c.fillStyle='#fff';c.fillRect(0,0,out.width,out.height);c.drawImage(scratch,0,0,out.width,out.height,0,0,out.width,out.height);return{canvas:out,width,height:h}}
  return{ctx,font,wrap,drawLines,strokeBox,crop};
}
function drawMetaGrid(p,cells,x,y,width){
  if(!cells.length)return y;const col=width/2;
  for(let i=0;i<cells.length;i+=2){
    const pair=cells.slice(i,i+2),models=pair.map(cell=>{p.font(7.6,900);const label=p.wrap(textOf(cell,'span'),col-12);p.font(11,900);const value=p.wrap(textOf(cell,'b'),col-12);return{label,value}});
    const height=Math.max(36,...models.map(m=>8+m.label.length*9+m.value.length*13));
    models.forEach((m,j)=>{const bx=x+j*col;p.strokeBox(bx,y,col,height,1.2);p.ctx.fillStyle='#000';p.font(7.6,900);p.drawLines(m.label,bx+6,y+5,9);p.font(11,900);p.drawLines(m.value,bx+6,y+14,13)});
    y+=height;
  }
  return y;
}
function drawModeIcon(c,mode,x,y,size,color){
  const cx=x+size/2,cy=y+size/2;c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.8;c.lineCap='round';c.lineJoin='round';c.strokeRect(x+.5,y+.5,size-1,size-1);c.beginPath();
  if(mode==='DINE-IN'){
    c.moveTo(x+7,y+5);c.lineTo(x+7,y+18);c.moveTo(x+4.5,y+5);c.lineTo(x+4.5,y+10);c.quadraticCurveTo(x+7,y+13,x+9.5,y+10);c.lineTo(x+9.5,y+5);c.moveTo(x+7,y+13);c.lineTo(x+7,y+21);c.moveTo(x+17,y+5);c.lineTo(x+17,y+21);c.moveTo(x+17,y+5);c.quadraticCurveTo(x+21,y+9,x+17,y+14);
  }else if(mode==='DELIVERY'){
    c.rect(x+4,y+8,10,9);c.moveTo(x+14,y+11);c.lineTo(x+19,y+11);c.lineTo(x+22,y+15);c.lineTo(x+22,y+17);c.lineTo(x+14,y+17);c.moveTo(x+7,y+20);c.arc(x+7,y+18,2,0,Math.PI*2);c.moveTo(x+21,y+18);c.arc(x+19,y+18,2,0,Math.PI*2);
  }else{
    c.moveTo(x+5,y+8);c.lineTo(x+20,y+8);c.lineTo(x+19,y+21);c.lineTo(x+6,y+21);c.closePath();c.moveTo(x+9,y+8);c.lineTo(x+9,y+6);c.quadraticCurveTo(cx,y+2,cx+3.5,y+6);c.lineTo(cx+3.5,y+8);
  }
  c.stroke();c.restore();
}
function drawCafeLogo(c,x,y,size,color){
  c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.8;c.beginPath();c.arc(x,y,size/2-1,0,Math.PI*2);c.stroke();c.font=`900 ${Math.round(size*.62)}px Georgia, serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('M',x,y+1);c.textAlign='left';c.textBaseline='top';c.restore();
}
function drawV43(receipt,width){
  const settings=printSettings(),p=createPainter(width,settings.fontScale),c=p.ctx,isKitchen=receipt.classList.contains('kitchen'),innerPad=isKitchen?12:8,bodyX=Math.max(0,settings.leftPx)+settings.padPx+innerPad,bodyW=Math.max(100,width-(settings.padPx+innerPad)*2-Math.abs(settings.leftPx));let y=0;
  const blackHeader=headerStyle()==='black',headInk=blackHeader?'#fff':'#000',modeKey=String(receipt.dataset.orderMode||textOf(receipt,'.v43-mode b','Takeaway')).toUpperCase();
  c.fillStyle=blackHeader?'#000':'#fff';c.fillRect(0,0,width,90);c.strokeStyle='#000';c.lineWidth=blackHeader?0:2;if(!blackHeader)c.strokeRect(1,1,width-2,88);c.fillStyle=headInk;
  const brand=textOf(receipt,'.v43-brand b',"MNAHEL'S CAFE"),sub=textOf(receipt,'.v43-brand small','THE WORLD OF TASTE'),mode=textOf(receipt,'.v43-mode b','ORDER'),seal=textOf(receipt,'.v43-seal strong','SLIP'),sealSub=textOf(receipt,'.v43-seal small','');
  const brandSize=Math.min(18.5,Math.max(15,width/18));p.font(brandSize,950);const brandWidth=c.measureText(brand).width,logoSize=28,brandStart=(width-(logoSize+7+brandWidth))/2;drawCafeLogo(c,brandStart+logoSize/2,19,logoSize,headInk);c.fillStyle=headInk;c.fillText(brand,brandStart+logoSize+7,11);p.font(8.2,900);p.drawLines([sub],width/2,37,9,'center');
  drawModeIcon(c,modeKey,8,58,25,headInk);c.fillStyle=headInk;p.font(10.8,950);c.fillText(mode,39,64);
  const sealW=102,sealH=31,sealX=width-sealW-8,sealY=54;c.lineWidth=1.8;c.strokeStyle=headInk;c.fillStyle=headInk;c.strokeRect(sealX+.5,sealY+.5,sealW-1,sealH-1);p.font(11.2,950);p.drawLines(p.wrap(seal,sealW-10),sealX+sealW/2,sealY+5,11,'center');p.font(7.2,900);p.drawLines(p.wrap(sealSub,sealW-10),sealX+sealW/2,sealY+18,8,'center');c.fillStyle='#000';y=96;
  const meta=qa(':scope > .v43-body > .v43-meta-grid > .v43-meta-cell',receipt);y=drawMetaGrid(p,meta,bodyX,y,bodyW)+6;
  const items=q('.v43-items',receipt);
  if(items){
    const qtyW=30,thirdW=Math.min(72,Math.round(bodyW*.25)),nameW=bodyW-qtyW-thirdW;
    p.strokeBox(bodyX,y,bodyW,24,1.5);p.font(8.6,950);c.textAlign='center';c.fillText('QTY',bodyX+qtyW/2,y+7);c.textAlign='left';c.fillText('ITEM',bodyX+qtyW+5,y+7);c.textAlign='center';c.fillText(textOf(items,'.tp-th b','AMOUNT'),bodyX+qtyW+nameW+thirdW/2,y+7);c.textAlign='left';y+=24;
    for(const row of qa('.v43-item-row',items)){
      const qty=textOf(row,'.v43-qty','1'),name=textOf(row,'.v43-item-name b','Item'),detail=textOf(row,'.v43-item-name small',''),third=textOf(row,'.v43-third','');
      p.font(11.2,950);const nameLines=p.wrap(name,nameW-10);p.font(8.4,800);const detailLines=detail?p.wrap(detail,nameW-10):[];p.font(11.5,950);const thirdLines=p.wrap(third,thirdW-10);
      const h=Math.max(31,10+nameLines.length*13+detailLines.length*10,10+thirdLines.length*13);
      p.strokeBox(bodyX,y,qtyW,h,1);p.strokeBox(bodyX+qtyW,y,nameW,h,1);p.strokeBox(bodyX+qtyW+nameW,y,thirdW,h,1);
      p.font(12.5,950);p.drawLines([qty],bodyX+qtyW/2,y+(h-13)/2,13,'center');p.font(11.2,950);p.drawLines(nameLines,bodyX+qtyW+5,y+5,13);if(detailLines.length){p.font(8.4,800);p.drawLines(detailLines,bodyX+qtyW+5,y+6+nameLines.length*13,10)}p.font(11.5,950);p.drawLines(thirdLines,bodyX+qtyW+nameW+thirdW/2,y+(h-thirdLines.length*13)/2,13,'center');y+=h;
    }
    y+=6;
  }
  const summary=q('.v43-summary',receipt);if(summary){const rows=qa(':scope > .tp-line,:scope > .tp-total',summary);rows.forEach(row=>{const total=row.classList.contains('tp-total'),h=total?31:23;p.strokeBox(bodyX,y,bodyW,h,total?1.5:1);p.font(total?13:9,total?950:850);c.fillText(textOf(row,'span'),bodyX+6,y+(total?8:7));c.textAlign='right';c.fillText(textOf(row,'b'),bodyX+bodyW-6,y+(total?8:7));c.textAlign='left';y+=h});y+=5}
  const payment=qa(':scope > .v43-body > .v43-payment-grid > .v43-meta-cell',receipt);if(payment.length)y=drawMetaGrid(p,payment,bodyX,y,bodyW)+5;
  const footer=q('.tp-foot',receipt);if(footer){c.setLineDash([4,3]);c.lineWidth=1;c.beginPath();c.moveTo(bodyX,y+.5);c.lineTo(bodyX+bodyW,y+.5);c.stroke();c.setLineDash([]);p.font(6.5,800);const credit=p.wrap(textOf(footer,'b','A product by Eastern Cross Technology'),bodyW);p.drawLines(credit,bodyX+bodyW/2,y+5,8,'center');let fy=y+7+credit.length*8;p.font(12.5,950);const thanks=p.wrap(textOf(footer,'strong','THANK YOU!'),bodyW);p.drawLines(thanks,bodyX+bodyW/2,fy,13,'center');fy+=thanks.length*13+2;p.font(8.4,850);const copy=p.wrap(textOf(footer,':scope > span',''),bodyW);p.drawLines(copy,bodyX+bodyW/2,fy,10,'center');y=fy+copy.length*10}
  return p.crop(y+7);
}
function drawGeneric(receipt,width){
  const settings=printSettings(),p=createPainter(width,settings.fontScale),c=p.ctx,left=Math.max(0,settings.leftPx)+settings.padPx+8,contentW=Math.max(100,width-(settings.padPx+8)*2-Math.abs(settings.leftPx));let y=0;c.fillStyle='#000';c.fillRect(0,0,width,46);c.fillStyle='#fff';p.font(15,950);p.drawLines([textOf(receipt,'.tp-head b',"MNAHEL'S CAFE")],width/2,9,18,'center');p.font(8,850);p.drawLines([textOf(receipt,'.tp-head small','PRINTABLE SLIP')],width/2,29,10,'center');c.fillStyle='#000';y=54;
  const clone=receipt.cloneNode(true);qa('.tp-head',clone).forEach(x=>x.remove());const text=(clone.innerText||clone.textContent||'').replace(/\s+/g,' ').trim();p.font(10,800);const lineH=Math.max(10,13*settings.fontScale),lines=p.wrap(text,contentW-12),boxH=Math.max(34,lines.length*lineH+14);p.strokeBox(left,y,contentW,boxH,1.2);p.drawLines(lines,left+6,y+7,lineH);y+=boxH+8;
  p.font(6.5,800);p.drawLines(['A product by Eastern Cross Technology'],width/2,y,8,'center');return p.crop(y+14);
}
async function renderJpg(source,name){
  if(!source)throw Error('Slip preview not found.');const receipt=source.matches?.('.v43-receipt,.tp')?source:q('.v43-receipt,.tp',source);
  if(!receipt||!(receipt.textContent||'').trim())throw Error('Slip is empty.');
  const width=printSettings().widthPx,rendered=receipt.classList.contains('v43-receipt')?drawV43(receipt,width):drawGeneric(receipt,width);
  const jpg=await new Promise((resolve,reject)=>rendered.canvas.toBlob(blob=>blob?resolve(blob):reject(Error('JPG could not be created.')),'image/jpeg',0.98));
  const fileName=name||slipName(receipt);saveBlob(jpg,fileName);return{name:fileName,width:rendered.width,height:rendered.height};
}
function downloadElement(source,name,quiet=false){return queueExport(async()=>{try{const result=await renderJpg(source,name);if(!quiet&&typeof toast==='function')toast('Cropped JPG slip downloaded.');return result}catch(error){console.error('[JPG slip]',error);if(!quiet&&typeof toast==='function')toast(error.message||'JPG slip download failed.');return null}})}
function downloadCurrentPreview(){const settings=q('#v31-preview[open] #v31-paper .v43-receipt, #v31-preview[open] #v31-paper .tp'),receipt=q('#receipt-preview[open] #receipt-preview-body .v43-receipt, #receipt-preview[open] #receipt-preview-body .tp');return downloadElement(settings||receipt)}
function downloadStaged(quiet=false){return downloadElement(q('#print-sheet'),undefined,quiet)}

function enhanceSettings(){
  const card=q('#v31-print-card');if(card){
    card.classList.add('v45-compact');
    if(!q('#v45-receipt-options',card)){
      const options=document.createElement('div');options.id='v45-receipt-options';options.innerHTML='<div class="v45-option-line"><b>Receipt header</b><div class="v45-header-buttons"><button type="button" data-v45-header="black">Black Header</button><button type="button" data-v45-header="white">White Header</button></div></div><div class="v45-option-line"><b>App theme</b><div class="v45-theme-buttons"><button type="button" data-v45-theme="dark">☾ Dark</button><button type="button" data-v45-theme="light">☀ Light</button></div></div><label class="v45-auto-toggle"><input id="v45-auto-jpg" type="checkbox"><span><b>Download receipt JPG</b><small>Automatic when a slip prints</small></span></label>';
      (q('h3',card)||card.firstChild)?.after(options);
      qa('[data-v45-header]',options).forEach(button=>button.onclick=()=>{setPref(HEADER_KEY,button.dataset.v45Header);applyReceiptPrefs();document.dispatchEvent(new Event('mnahels-print-settings-changed'))});
      qa('[data-v45-theme]',options).forEach(button=>button.onclick=()=>setAppTheme(button.dataset.v45Theme));
      q('#v45-auto-jpg',options).onchange=event=>{setPref(AUTO_JPG_KEY,event.currentTarget.checked?'1':'0');applyReceiptPrefs();document.dispatchEvent(new Event('mnahels-print-settings-changed'))};
    }
    const row=q('.v31-row',card),preview=q('#v31-preview-btn',card);if(row&&preview&&!q('#v45-settings-download',card)){const button=document.createElement('button');button.id='v45-settings-download';button.type='button';button.className='v45-download';button.textContent='⇩ Download JPG slip';preview.after(button);button.onclick=()=>{preview.click();setTimeout(()=>downloadElement(q('#v31-paper')),100)}}
  }
  const dialog=q('#v31-preview');if(dialog&&!q('#v45-v31-download',dialog)){const button=document.createElement('button');button.id='v45-v31-download';button.type='button';button.className='v45-download';button.textContent='⇩ Download JPG slip';q('.v31-pv-foot',dialog)?.appendChild(button);button.onclick=()=>downloadElement(q('#v31-paper'))}
  applyReceiptPrefs();
}
function enhanceReceiptPreview(){const dialog=q('#receipt-preview');if(!dialog||q('#v45-preview-download',dialog))return;const actions=document.createElement('div');actions.className='v45-preview-actions';actions.innerHTML='<button id="v45-preview-download" type="button">⇩ Download JPG slip</button>';dialog.appendChild(actions);q('#v45-preview-download',dialog).onclick=downloadCurrentPreview}
function autoDownloadStaged(){clearTimeout(autoTimer);autoTimer=setTimeout(()=>{if(!autoJpgEnabled())return;const sheet=q('#print-sheet'),receipt=q('.v43-receipt,.tp',sheet);if(!sheet||!receipt||!(receipt.textContent||'').trim())return;const signature=`${sheet.className}|${receipt.outerHTML}`,now=Date.now();if(signature===lastAutoSignature&&now-lastAutoAt<1100)return;lastAutoSignature=signature;lastAutoAt=now;downloadStaged(true)},55)}
function watchPrintSheet(){const sheet=q('#print-sheet');if(!sheet||sheet.dataset.v45Watching)return;sheet.dataset.v45Watching='1';new MutationObserver(autoDownloadStaged).observe(sheet,{childList:true,subtree:true})}
function boot(){applyReceiptPrefs();enhanceSettings();enhanceReceiptPreview();watchPrintSheet()}
let bootQueued=false;const observer=new MutationObserver(records=>{const relevant=records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('#v31-print-card,#receipt-preview,.tp,.v43-receipt')||node.querySelector?.('#v31-print-card,#receipt-preview,.tp,.v43-receipt'))));if(!relevant||bootQueued)return;bootQueued=true;requestAnimationFrame(()=>{bootQueued=false;boot()})});observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('mnahels-shared-print-settings-applied',applyReceiptPrefs);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,900);setInterval(boot,5000);
document.documentElement.dataset.uiRevision=UI_REVISION;window.mnahelsV45={build:BUILD,uiRevision:UI_REVISION,downloadElementToJpg:downloadElement,downloadCurrentPreview,downloadStaged,printSettings,setAppTheme};
})();
