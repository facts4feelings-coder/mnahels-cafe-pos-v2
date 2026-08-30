(()=>{
/* ==========================================================================
   Mnahel's Cafe POS - v31 layer - build 0.15.24
   Owner    : TechMint Software Solutions - https://techmint.org
   Copyright: (c) 2026 TechMint Software Solutions. All rights reserved.
   A product by TechMint Software Solutions.

   Print control (Settings > Receipt print size):
     - width / left offset / side margin / font size app ke andar se set
     - defaults: 80 mm width, 1 mm left offset, 0 side margin, 12 px font
       (Black Copper 80 par tested)
     - BLANK PAGE ka ilaaj (0.14.9):
         * PRINT ISOLATION: print ke waqt sirf #print-sheet chapta hai,
           baqi poora app (screens, sidebar, dialogs, cards) hide ho jata hai
         * receipt ka text zabardasti #000 (app dark theme me light text
           safaid kagaz par nazar nahi aata tha)
         * sheet ka purana inline style hata diya jata hai
         * content khali ho to print bheji hi nahi jati (khali parchi nahi)
     - Direct print (koi window nahi):
         * desktop app (POS icon) -> WebView2 silent print, printers.json
         * browser -> Chrome ko --kiosk-printing ke sath kholein (card me
           ready shortcut + copy button)
     - WIDTH FINDER: printer ka asli printable width ek print me
   ========================================================================== */
const BUILD='0.15.24';
const WKEY='mnahels.print-width';
const PKEY='mnahels.print-pad';
const LKEY='mnahels.print-left';
const FKEY='mnahels.print-font';
const OPTS=[48,58,68,70,72,76,80];
const FONTS=[9,10,11,12];
const LEFTS=[-4,-3,-2,-1,-0.5,0,0.5,1,2,3,4];
const FIT=[60,62,64,66,68,70,72,74,76,78,80];
const el=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function say(t){if(typeof toast==='function')toast(t)}
function num(k,def,min,max){const v=parseFloat(localStorage.getItem(k)||'');return (isFinite(v)&&v>=min&&v<=max)?v:def}
const width=()=>num(WKEY,80,40,210);
const pad=()=>num(PKEY,0,0,8);
const left=()=>num(LKEY,1,-8,8);
const font=()=>num(FKEY,12,8,15);
const LAYOUTKEY='mnahels.print-layout-compact-21';
try{if(localStorage.getItem(LAYOUTKEY)!=='1'){const savedW=localStorage.getItem(WKEY),savedF=parseFloat(localStorage.getItem(FKEY)||'');if(savedW===null||savedW==='70')localStorage.setItem(WKEY,'80');if(!isFinite(savedF)||savedF<12)localStorage.setItem(FKEY,'12');localStorage.setItem(LAYOUTKEY,'1')}}catch(e){}
const bridgeReady=()=>!!(window.__mnahelsDualPrintBridge&&window.chrome&&window.chrome.webview&&window.chrome.webview.postMessage);
const KIOSK='"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --app='+location.origin;
let probe=null; /* width finder ke liye asthai width */
let printing=false; /* print chal rahi ho to sheet ka content na badlein */
const effW=()=>probe||width();
const effP=()=>probe?0:pad();
const effL=()=>probe?0:left();
function sheetText(){const s=el('#print-sheet');return s?String(s.textContent||'').replace(/\s+/g,' ').trim():''}

/* ------------------------------------------------- font size ke rules */
function fontRules(p,f){const s=(sel,v)=>p+' '+sel+'{font-size:'+v+'px!important}';const low=v=>Math.max(7,v);return [
	s('.tp-line',f),s('.tp-line span',f),s('.tp-line b',f),
	s('.tp-item>div span',f),s('.tp-item>div b',f),s('.tp-item small',low(f-1)),
	s('.tp-th',low(f-1.5)),s('.tp-addr',f),s('.tp-addr b',f),s('.tp-addr span',low(f-1)),
	s('.tp-head b',f+2.5),s('.tp-head small',low(f-1.5)),
	s('.tp-total span',f+1),s('.tp-total b',f+3),s('.tp-token',f+6),
	s('.tp-note b',low(f-1.5)),s('.tp-note span',f),s('.tp-empty',f),
	s('.tp-kitem b',f+3),s('.tp-kitem span',f+2),s('.tp-kitem em',low(f-1)),
	s('.tp-foot b',f),s('.tp-foot small',low(f-1.5)),s('.tp-saved',low(f-1)),
	s('.v31-edge',low(f-1)),s('.v31-tips',low(f-2))
].join('')}
function mastheadRules(p,f){const px=(n)=>String(n).replace(/\.0$/,'');return p+' .v43-brand>b{font-size:'+px(Math.max(18.5,f+6.5))+'px!important}'+p+' .v43-brand>small{font-size:'+px(Math.max(8.2,f-2))+'px!important}'+p+' .v43-mode b{font-size:'+px(Math.max(10.5,f-1))+'px!important}'+p+' .v43-mode small{font-size:'+px(Math.max(8,f-3))+'px!important}'+p+' .v43-seal strong{font-size:'+px(Math.max(12.5,f))+'px!important}'+p+' .v43-seal small{font-size:'+px(Math.max(7.5,f-3))+'px!important}'+p+' .v43-qty{font-size:'+px(Math.max(12.5,f+1))+'px!important}'+p+' .v43-third{font-size:'+px(Math.max(11.5,f+.5))+'px!important;text-align:center!important;place-items:center!important}'}

/* --------------------------- width finder ki lines (borders se chapti) */
function fitRules(p){return p+' .v31-fit{display:block!important;margin:2px 0!important;padding:0!important}'
	+p+' .v31-fit span{display:flex!important;justify-content:flex-end!important;align-items:center!important;box-sizing:border-box!important;margin:0!important;padding:0 1px 0 0!important;height:13px!important;border-bottom:1px solid #000!important;border-right:2px solid #000!important;font-family:monospace!important;font-size:9px!important;font-weight:700!important;line-height:1!important;color:#000!important;overflow:visible!important}'}

/* ---- PRINT ISOLATION: print ke waqt sirf receipt, baqi sab hide (0.14.9) */
function keepRules(w){const s=el('#print-sheet');if(!s)return '';
	const chain=[];let n=s.parentElement;
	while(n&&n!==document.body&&n!==document.documentElement){chain.push(n);n=n.parentElement}
	chain.forEach(x=>{try{if(x.getAttribute('data-v31-keep')!=='1')x.setAttribute('data-v31-keep','1')}catch(e){}});
	let out='body>*:not(#print-sheet):not([data-v31-keep]){display:none!important}';
	if(chain.length){out+='[data-v31-keep]{display:block!important;visibility:visible!important;position:static!important;left:auto!important;top:auto!important;width:'+w+'mm!important;max-width:'+w+'mm!important;height:auto!important;max-height:none!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:#fff!important;box-shadow:none!important;overflow:visible!important;transform:none!important;opacity:1!important}'
		+'[data-v31-keep]>*:not(#print-sheet):not([data-v31-keep]){display:none!important}'}
	return out}

/* ------- width / left offset / margin / font ka override (v24 se strong) */
function apply(){const w=effW(),p=effP(),l=effL(),f=font();let s=el('#v31-print-style');if(!s){s=document.createElement('style');s.id='v31-print-style';document.head.appendChild(s)}
	const P='html body #print-sheet';
	const css='@media print{'
		+'@page{size:'+w+'mm auto;margin:0}'
		+'html,body{width:'+w+'mm!important;min-width:0!important;max-width:'+w+'mm!important;margin:0!important;padding:0!important;background:#fff!important;color:#000!important;visibility:visible!important;overflow:visible!important}'
		+'body>dialog,dialog[open]{display:none!important}'
		+keepRules(w)
		+P+'{display:block!important;visibility:visible!important;position:static!important;left:auto!important;top:auto!important;width:'+w+'mm!important;max-width:'+w+'mm!important;height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;margin:0!important;padding:0!important;background:#fff!important;opacity:1!important;transform:none!important}'
		+P+' *{visibility:visible!important;opacity:1!important;color:#000!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
		+P+' .tp{display:block!important;visibility:visible!important;width:'+w+'mm!important;max-width:'+w+'mm!important;box-sizing:border-box!important;margin:0!important;padding:0 '+p+'mm!important;position:relative!important;left:'+l+'mm!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:hidden!important;color:#000!important;font-size:'+f+'px!important;line-height:1.34!important}'
		+P+' .tp *{color:#000!important;max-width:100%!important}'
		+P+' .v43-dark-head,'+P+' .v43-dark-head *{color:#fff!important}'
		+P+' .v43-dark-head{background:#000!important}'
		+P+' .v43-mode-icon,'+P+' .v43-seal{background:#000!important;border-color:#fff!important}'
		+P+' .v43-mode-icon svg{stroke:#fff!important}'
		+P+' .tp-line,'+P+' .tp-item>div,'+P+' .tp-th,'+P+' .tp-total{gap:3px!important}'
		+P+' .tp-line span,'+P+' .tp-line b{white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important}'
		+fontRules(P,f)
		+mastheadRules(P,f)
		+fitRules(P)
		+'}'
		+'.v31-paper{width:'+w+'mm;padding:6px '+p+'mm 10px '+p+'mm;box-sizing:border-box;overflow:visible}'
		+'.v31-paper .tp{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;position:relative!important;left:'+l+'mm!important;border:0!important;border-radius:0!important;box-shadow:none!important;font-size:'+f+'px!important;line-height:1.34!important}'
		+fontRules('.v31-paper',f)
		+mastheadRules('.v31-paper',f)
		+fitRules('.v31-paper');
	if(s.textContent!==css)s.textContent=css}
apply();

/* --------------- blank page ka fix: sheet ka content hold karte hain */
let hold=null,holdUntil=0;
function stage(html,type){const sheet=el('#print-sheet');if(!sheet)return null;sheet.removeAttribute('style');sheet.className='print-sheet tp-sheet '+type;sheet.innerHTML=html;hold=html;holdUntil=Date.now()+9000;return sheet}
function holdLonger(ms){if(hold)holdUntil=Date.now()+(ms||9000)}
setInterval(()=>{if(!hold)return;if(Date.now()>holdUntil){hold=null;return}const sheet=el('#print-sheet');if(!sheet)return;
	const empty=sheetText().length<20;
	if(sheet.innerHTML!==hold&&(!printing||empty)){sheet.removeAttribute('style');sheet.innerHTML=hold}
	else if(sheet.getAttribute('style'))sheet.removeAttribute('style')},200);
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#place-order,#print-customer,#print-kitchen,#ow-primary,[data-reprint],[data-v32-reprint]'):null;if(b)hold=null},true);

/* ------------------------------------ test receipt (mm scale ke sath) */
function stamp(){return new Date().toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
function scale(w){const ticks=Math.floor(w/10);let out='';for(let i=0;i<ticks;i++)out+='<i>'+(i*10)+'</i>';return '<div class="v31-scale">'+out+'</div>'}
function sample(){
 const order={tokenNumber:1025,createdAt:new Date().toISOString(),orderType:'Dine-in',customerName:'Muhammad Farhan Ahmed Sheikh',tableName:'Table 03',waiterName:'Muhammad Abdullah',paymentStatus:'Unpaid',items:[
  {quantity:1,productName:'Chicken Hot Wings',variantName:'10 pc',unitPrice:600,lineTotal:600},
  {quantity:1,productName:'Chicken Grilled Burger',variantName:'Regular',unitPrice:390,lineTotal:390},
  {quantity:1,productName:'Pepsi',variantName:'1 Litre',unitPrice:130,lineTotal:130},
  {quantity:1,productName:'Cheese Lover X-Large',variantName:'Regular',unitPrice:330,lineTotal:330}
 ],subtotal:1450,discount:0,total:1450,notes:'Collect payment after service'};
 if(window.mnahelsV43&&typeof window.mnahelsV43.receiptHtml==='function')return window.mnahelsV43.receiptHtml(order,'unpaid');
 return '<div class="tp tp-customer"><div class="tp-head"><b>MNAHEL\'S CAFE</b><small>80mm compact receipt preview</small></div><div class="tp-total"><span>AMOUNT DUE</span><b>Rs 1,450</b></div></div>';
}

/* ------------------- WIDTH FINDER: printer ka asli printable width */
function fitFinder(){const dash='<div class="tp-dash"></div>';
	return '<div class="tp tp-customer"><div class="tp-head"><b>WIDTH FINDER</b><small>build '+BUILD+' \u00b7 '+stamp()+'</small></div>'
		+dash
		+'<div class="v31-tips">Each line ends at its labelled millimetre width.</div>'
		+'<div class="v31-tips">Set the app width to the LAST number that prints completely.</div>'
		+dash
		+FIT.map(w=>'<div class="v31-fit"><span style="width:'+w+'mm">'+w+'</span></div>').join('')
		+dash
		+'<div class="tp-foot"><b>KAISE PARHEIN</b>'
		+'<div class="v31-tips">Example: if 70 prints fully and 72 is clipped, set width to 70 mm.</div>'
		+'<div class="v31-tips">Settings me wahi number likhein, Left offset 1 mm.</div>'
		+'<div class="v31-tips">Use the same width in F10 printer setup.</div>'
		+'</div></div>'}

/* ------------------------------------------------- silent print (app) */
function silent(type){return new Promise(res=>{let over=false;const h=e=>{const m=String(e.data||'');if(m==='mnahels-print-'+type+'-done'||m==='mnahels-print-'+type+'-cancelled'){over=true;try{window.chrome.webview.removeEventListener('message',h)}catch(err){}res(m.indexOf('-done')>0)}};
	try{window.chrome.webview.addEventListener('message',h);window.chrome.webview.postMessage('mnahels-print-'+type)}catch(err){res(false);return}
	setTimeout(()=>{if(!over){try{window.chrome.webview.removeEventListener('message',h)}catch(err){}res(true)}},20000)})}

/* -------------------------------- asli print (yehi "Print" hai) */
let busy=false;
async function output(html,note){const sheet=stage(html,'customer');if(!sheet){say('The print sheet was not found.');return}
	await sleep(180);
	if(sheetText().length<20){say('The print sheet is empty \u2014 please try again.');return}
	printing=true;
	try{
		if(bridgeReady()){const ok=await silent('customer');say(ok?note:'Printing was cancelled \u2014 press F10 and select a printer.');return}
		const d=el('#v31-preview');const wasOpen=!!(d&&d.open);if(wasOpen)d.close();
		holdLonger(120000);
		await sleep(300);
		try{window.print()}catch(e){}
		await sleep(600);
		hold=null;
		if(wasOpen){try{d.showModal()}catch(e){d.setAttribute('open','')}}
	}finally{printing=false}}
async function printNow(){if(busy)return;busy=true;try{apply();await output(sample(),'Print bhej di gayi \u2014 width '+width()+' mm \u00b7 left '+left()+' mm \u00b7 font '+font()+' px')}catch(e){say((e&&e.message)||'Print error')}finally{busy=false}}
async function printFit(){if(busy)return;busy=true;try{probe=80;apply();await output(fitFinder(),'Width finder print ho gayi \u2014 set the width to the last number that prints completely.')}catch(e){say((e&&e.message)||'Print error')}finally{probe=null;apply();busy=false}}

/* ------------------------------- app ke andar preview (Chrome nahi) */
function previewDialog(){let d=el('#v31-preview');if(d)return d;d=document.createElement('dialog');d.id='v31-preview';d.className='dialog v31-preview';d.innerHTML='<div class="v31-pv-head"><strong>Test print preview</strong><button type="button" data-pv="close" class="v31-x">\u00d7</button></div>'
		+'<div class="v31-pv-body"><div class="v31-paper" id="v31-paper"></div></div>'
		+'<div class="v31-pv-foot"><button type="button" data-pv="minus">Width \u22121</button><button type="button" data-pv="plus">Width +1</button><button type="button" data-pv="left-minus">Left \u22120.5</button><button type="button" data-pv="left-plus">Left +0.5</button><button type="button" data-pv="font-">A\u2212</button><button type="button" data-pv="font+">A+</button><span id="v31-pv-info" class="v31-pv-info"></span><button type="button" data-pv="fit">\ud83d\udccf Width finder</button><button type="button" data-pv="print" class="v31-primary">\ud83d\udda8 Print</button><button type="button" data-pv="close">Close</button></div>';
	document.body.appendChild(d);
	d.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('[data-pv]'):null;if(!b)return;const a=b.dataset.pv;
		if(a==='close'){d.close();return}
		if(a==='print'){printNow();return}
		if(a==='fit'){printFit();return}
		if(a==='minus'){setWidth(width()-1,true);drawPreview()}
		if(a==='plus'){setWidth(width()+1,true);drawPreview()}
		if(a==='left-minus'){setLeft(left()-.5,true);drawPreview()}
		if(a==='left-plus'){setLeft(left()+.5,true);drawPreview()}
		if(a==='font-'){setFont(font()-1,true);drawPreview()}
		if(a==='font+'){setFont(font()+1,true);drawPreview()}});
	return d}
function drawPreview(){const d=previewDialog();apply();const paper=el('#v31-paper');if(paper)paper.innerHTML=sample();const info=el('#v31-pv-info');if(info)info.textContent='width '+width()+' mm \u00b7 left '+left()+' mm \u00b7 font '+font()+' px';if(!d.open){try{d.showModal()}catch(e){d.setAttribute('open','')}}}

/* ------------------------------------------------ settings ka card */
function sync(){const w=width(),p=pad(),l=left(),f=font();
	all('#v31-widths button').forEach(b=>b.classList.toggle('active',parseFloat(b.dataset.pw)===w));
	all('#v31-fonts button').forEach(b=>b.classList.toggle('active',parseFloat(b.dataset.pf)===f));
	all('#v31-lefts button').forEach(b=>b.classList.toggle('active',parseFloat(b.dataset.pl)===l));
	const wi=el('#v31-width'),pi=el('#v31-pad'),li=el('#v31-left');
	if(wi&&document.activeElement!==wi)wi.value=String(w);
	if(pi&&document.activeElement!==pi)pi.value=String(p);
	if(li&&document.activeElement!==li)li.value=String(l);
	const st=el('#v31-status');if(st)st.textContent='Abhi: width '+w+' mm \u00b7 left offset '+l+' mm \u00b7 side margin '+p+' mm \u00b7 font '+f+' px \u00b7 print engine '+BUILD+' (isolation ON)'+(bridgeReady()?' \u00b7 DIRECT PRINT ON (desktop app)':' \u00b7 browser mode (print window khulegi \u2014 niche kiosk shortcut dekhein)')}
function setWidth(v,quiet){const n=Math.round(parseFloat(v)*2)/2;if(!isFinite(n)||n<40||n>210){say('Set width between 40 and 210 mm.');return}localStorage.setItem(WKEY,String(n));apply();sync();if(!quiet)say('Print width '+n+' mm set ho gayi.')}
function setPad(v,quiet){const n=Math.round(parseFloat(v)*2)/2;if(!isFinite(n)||n<0||n>8){say('Set side margin between 0 and 8 mm.');return}localStorage.setItem(PKEY,String(n));apply();sync();if(!quiet)say('Side margin '+n+' mm set ho gaya.')}
function setLeft(v,quiet){const n=Math.round(parseFloat(v)*4)/4;if(!isFinite(n)||n<-8||n>8){say('Set left margin between -8 and +8 mm.');return}localStorage.setItem(LKEY,String(n));apply();sync();if(!quiet)say('Left margin '+n+' mm set ho gaya.')}
function setFont(v,quiet){const n=parseFloat(v);if(!isFinite(n)||n<8||n>15){say('Set receipt font between 8 and 15 px.');return}localStorage.setItem(FKEY,String(n));apply();sync();if(!quiet)say('Receipt font set to '+n+' px.')}
function card(){const old=el('#v31-print-card');if(old&&old.dataset.v31===BUILD)return;if(old)old.remove();
	const anchor=el('#v28-print-card')||el('#backup-settings-card');const host=el('#screen-settings');if(!anchor&&!host)return;
	const html='<article id="v31-print-card" class="panel v31-card" data-v31="'+BUILD+'">'
		+'<h3>80mm receipt preview & print size</h3>'
		+'<p class="v31-sub">80mm receipt setting: <b>width 80 mm \u00b7 left offset 1 mm \u00b7 side margin 0 \u00b7 font 12 px</b>. Preview now shows the exact compact receipt that will print. To find the correct width, <b>\ud83d\udccf Width finder</b> print \u2014 set the width to the last number that prints completely.</p>'
		+'<p class="v31-lbl">Paper width</p>'
		+'<div id="v31-widths" class="v31-widths">'+OPTS.map(w=>'<button type="button" data-pw="'+w+'">'+w+' mm</button>').join('')+'<button type="button" id="v31-minus">\u2212 1</button><button type="button" id="v31-plus">+ 1</button></div>'
		+'<p class="v31-lbl">Receipt font</p>'
		+'<div id="v31-fonts" class="v31-widths">'+FONTS.map(f=>'<button type="button" data-pf="'+f+'">'+f+' px</button>').join('')+'</div>'
		+'<p class="v31-lbl">Left margin adjustment (negative supported)</p>'
		+'<div id="v31-lefts" class="v31-widths">'+LEFTS.map(l=>'<button type="button" data-pl="'+l+'">'+(l>0?'+':'')+l+' mm</button>').join('')+'</div>'
		+'<p class="v31-sub">Negative value poori receipt ko left move karti hai; positive value right move karti hai.</p>'
		+'<div class="v31-row"><label>Custom width (mm)<input id="v31-width" type="number" min="40" max="210" step="0.5"></label><label>Left margin (mm, -8 to +8)<input id="v31-left" type="number" min="-8" max="8" step="0.25"></label><label>Side margin (mm)<input id="v31-pad" type="number" min="0" max="8" step="0.5"></label><button type="button" id="v31-now" class="v31-primary">\ud83d\udda8 Print</button><button type="button" id="v31-fit">\ud83d\udccf Width finder</button><button type="button" id="v31-preview-btn">Preview</button></div>'
		+'<p id="v31-status" class="v31-status"></p>'
		+'<div class="v31-kiosk"><b>Print khali nikal rahi ho to:</b>'
		+'<div class="v31-tips">1) Press <b>F10</b> and select the correct printer. Enable “Use the printer paper size” if a custom size produces a blank page.</div>'
		+'<div class="v31-tips">2) Foran kaam chalana ho to F10 me <b>silent print</b> ka tick hata dein \u2014 print window khulegi (usme print theek nikalti hai).</div>'
		+'<div class="v31-tips">3) Log: <b>C:\\ProgramData\\MnahelsCafePOS\\print-log.txt</b> \u2014 har print ki width, content size aur status wahan likhi hoti hai.</div>'
		+'</div>'
		+'<div class="v31-kiosk"><b>Direct printing without a dialog:</b>'
		+'<div class="v31-tips">1) <b>Desktop app (POS icon)</b> sends jobs directly to the printer without opening a dialog. Use it for daily operation.</div>'
		+'<div class="v31-tips">2) Browser hi chalana ho to Chrome ko is shortcut se kholein (kiosk printing). Phir print button dabate hi bina window print nikal jayegi \u2014 wahi settings jo aap ne aakhri baar print window me chuni thi (printer, margin 0.04", scale 100%, headers off):</div>'
		+'<code id="v31-kiosk-cmd">'+KIOSK+'</code>'
		+'<div class="v31-row"><button type="button" id="v31-copy">Copy shortcut</button></div>'
		+'<div class="v31-tips">Windows: right-click the desktop, select New &gt; Shortcut, and paste this line. Also set the thermal printer as the default printer.</div>'
		+'</div>'
		+'<p class="v31-note"><b>Important:</b> Keep the F10 paper width identical to the width selected here. In Windows printer properties, use <b>80 x 297mm</b>, 100% scale and zero margins, then save the same Printing Defaults. Print engine build '+BUILD+'.</p>'
		+'</article>';
	if(anchor)anchor.insertAdjacentHTML('afterend',html);else host.insertAdjacentHTML('afterbegin',html);
	all('#v31-widths button[data-pw]').forEach(b=>{b.onclick=()=>setWidth(b.dataset.pw)});
	all('#v31-fonts button[data-pf]').forEach(b=>{b.onclick=()=>setFont(b.dataset.pf)});
	all('#v31-lefts button[data-pl]').forEach(b=>{b.onclick=()=>setLeft(b.dataset.pl)});
	const mn=el('#v31-minus');if(mn)mn.onclick=()=>setWidth(width()-1);
	const pl=el('#v31-plus');if(pl)pl.onclick=()=>setWidth(width()+1);
	const wi=el('#v31-width');if(wi)wi.onchange=()=>setWidth(wi.value);
	const li=el('#v31-left');if(li)li.onchange=()=>setLeft(li.value);
	const pi=el('#v31-pad');if(pi)pi.onchange=()=>setPad(pi.value);
	const nb=el('#v31-now');if(nb)nb.onclick=()=>printNow();
	const fb=el('#v31-fit');if(fb)fb.onclick=()=>printFit();
	const pb=el('#v31-preview-btn');if(pb)pb.onclick=()=>drawPreview();
	const cb=el('#v31-copy');if(cb)cb.onclick=()=>{const t=KIOSK;try{navigator.clipboard.writeText(t);say('Shortcut copied.')}catch(e){say(t)}};
	sync()}

/* -------------------------------------------------- build ka nishan */
function chip(){const host=el('.side-bottom');if(!host)return;let n=el('#v31-build');if(!n){n=document.createElement('small');n.id='v31-build';n.className='v31-build';host.appendChild(n)}const t='POS build '+BUILD;if(n.textContent!==t)n.textContent=t}

setInterval(()=>{try{card();if(!probe)apply();chip();if(el('#v31-print-card'))sync()}catch(e){}},900);
setTimeout(()=>{try{card();chip()}catch(e){}},1200);
})();
