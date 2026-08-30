(()=>{
/* ==========================================================================
   Mnahel's Cafe POS - v32 layer - build 0.14.8
   Owner    : TechMint Software Solutions - https://techmint.org
   Copyright: (c) 2026 TechMint Software Solutions. All rights reserved.
   A product by TechMint Software Solutions.
   Is layer me:
     1) Orders list par PLACED ON date/time + discount hisaab + 2 reprint
        buttons - poori row me, card ka layout kharab nahi hota
     2) F2 popup ka poora reset (Esc ke baad naya order, purana data nahi)
     3) Ctrl + Left/Right se Cash / Card / Online (chahe focus discount me ho)
     4) Settings me MAUJOOD backup panel ki marammat: interval list bharna,
        folder load karna, save par server ka asli jawab dikhana
        (koi doosra/duplicate panel nahi banaya jata)
     5) Print defaults: width 70mm, left 0.8mm (0.03"), font 11
   Purane layers ko touch nahi kiya gaya.
   ========================================================================== */
const BUILD='0.14.8';
const BS=String.fromCharCode(92);
const DEFAULT_FOLDER='C:'+BS+'ProgramData'+BS+'MnahelsCafePOS'+BS+'Backups';
const PAYS=['Cash','Card','Online'];
const IVAL=[[1,'har 1 minute'],[5,'har 5 minute'],[15,'har 15 minute'],[30,'har 30 minute'],[60,'har 1 ghanta'],[120,'har 2 ghante'],[240,'har 4 ghante'],[360,'har 6 ghante'],[480,'har 8 ghante'],[600,'har 10 ghante'],[720,'har 12 ghante'],[1440,'rozana (24 ghante)']];
const el=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const basic=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const E=s=>{try{return typeof esc==='function'?esc(s):basic(s)}catch(e){return basic(s)}};
const cash=v=>{try{return typeof money==='function'?money(v):'Rs '+Math.round(v||0)}catch(e){return 'Rs '+Math.round(v||0)}};
const say=m=>{try{if(typeof toast==='function')toast(m)}catch(e){}};
function vis(n){if(!n)return false;if(n.hidden)return false;let r=null;try{r=n.getBoundingClientRect()}catch(e){}return !!r&&r.width>0&&r.height>0}

/* ------------------------------------------------- chhota fetch helper */
async function jget(url){const r=await fetch(url,{credentials:'same-origin',headers:{'Accept':'application/json'}});if(!r.ok){let m='';try{const j=await r.json();m=(j&&(j.message||j.error))||''}catch(e){}const err=new Error(m||('HTTP '+r.status));err.status=r.status;throw err}return r.json()}
async function jsend(method,url,body){const r=await fetch(url,{method:method,credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:body?JSON.stringify(body):null});let data=null;try{data=await r.json()}catch(e){}if(!r.ok){const err=new Error((data&&(data.message||data.error))||('HTTP '+r.status));err.status=r.status;throw err}return data}

/* -------------------------------- 5. print defaults (70mm / 0.8mm / 11) */
const PDEF=[['mnahels.print-width','70'],['mnahels.print-left','0.8'],['mnahels.print-pad','0'],['mnahels.print-font','11']];
try{PDEF.forEach(p=>{const cur=localStorage.getItem(p[0]);if(cur===null||cur===''||!isFinite(parseFloat(cur)))localStorage.setItem(p[0],p[1])})}catch(e){}

/* -------------------- 3. Ctrl + Left/Right se payment mode change */
function payNodes(){
	const sels=['[data-px-pay]','[data-payment]','[data-pay-mode]','[data-payment-mode]','[data-pay]'];
	for(let i=0;i<sels.length;i++){const list=all(sels[i]).filter(vis);if(list.length>=2)return list}
	const out=[];
	PAYS.forEach(w=>{
		const leaf=all('button,div,span,label,li,a,strong,b,h4,h5,p').filter(n=>vis(n)&&n.children.length===0&&n.textContent.trim().toLowerCase()===w.toLowerCase());
		if(!leaf.length)return;
		let up=leaf[leaf.length-1],steps=0;
		while(up&&up.parentElement&&steps<4){
			let cs=null;try{cs=getComputedStyle(up)}catch(e){}
			const cls=String(up.className||'');
			if(up.tagName==='BUTTON'||up.getAttribute('role')==='button'||(cs&&cs.cursor==='pointer')||/pay|mode|tile|option/i.test(cls))break;
			up=up.parentElement;steps++;
		}
		if(up)out.push(up);
	});
	return out.length>=2?out:[];
}
function payName(n){if(!n)return '';const d=n.dataset||{};const v=d.pxPay||d.payment||d.payMode||d.paymentMode||d.pay||'';if(v)return v;const t=(n.textContent||'').trim();for(let i=0;i<PAYS.length;i++){if(new RegExp('^'+PAYS[i],'i').test(t))return PAYS[i]}return ''}
function payIndex(nodes){let i=-1;nodes.forEach((n,k)=>{const cls=' '+String(n.className||'')+' ';if(/\s(active|selected|is-active|is-selected|current)\s/i.test(cls)||n.getAttribute('aria-pressed')==='true'||n.getAttribute('aria-checked')==='true')i=k});
	if(i<0){let cur='';try{cur=(typeof state!=='undefined'&&state&&state.payment)||''}catch(e){}if(cur)nodes.forEach((n,k)=>{if(payName(n).toLowerCase()===String(cur).toLowerCase())i=k})}
	return i<0?0:i}
function cyclePay(dir){const nodes=payNodes();if(!nodes.length)return false;const i=payIndex(nodes);const t=nodes[(i+dir+nodes.length)%nodes.length];if(!t)return false;const name=payName(t);try{t.click()}catch(e){}try{if(typeof state!=='undefined'&&state&&name&&PAYS.indexOf(name)>=0)state.payment=name}catch(e){}nodes.forEach(n=>{const nm=payName(n);if(nm&&n.hasAttribute&&(n.hasAttribute('data-payment')||n.hasAttribute('data-px-pay')))n.classList.toggle('active',nm===name)});say('Payment: '+(name||'change'));return true}
window.addEventListener('keydown',e=>{
	if(!e.ctrlKey||e.altKey||e.metaKey)return;
	if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
	const v=el('#variant-dialog');if(v&&v.open)return;
	const nodes=payNodes();if(!nodes.length)return;
	e.preventDefault();e.stopImmediatePropagation();
	cyclePay(e.key==='ArrowRight'?1:-1);
},true);

/* ------------------------------------------- 2. F2 popup ka poora reset */
function wizNode(){return el('#order-wizard')}
function wizOpen(){const d=wizNode();if(!d)return false;if(d.tagName==='DIALOG'&&typeof d.open==='boolean')return d.open;return vis(d)}
function clearInput(n){if(!n)return;const t=String(n.type||'').toLowerCase();if(t==='checkbox'||t==='radio'||t==='button'||t==='submit'||t==='hidden')return;if(n.value!==''){n.value='';try{n.dispatchEvent(new Event('input',{bubbles:true}))}catch(e){}try{n.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}}}
function resetWizard(){try{
	const d=wizNode();
	if(d)[...d.querySelectorAll('input,textarea')].forEach(clearInput);
	['#discount','#order-note','#px-input','#ow-input','#ow-name','#ow-phone','#ow-address','#ow-note'].forEach(s=>clearInput(el(s)));
	const err=el('#ow-phone-error');if(err){err.hidden=true;err.textContent=''}
	const ph=el('#ow-phone');if(ph)ph.classList.remove('invalid','error','input-error');
	try{if(typeof state!=='undefined'&&state){
		if(Array.isArray(state.cart)&&state.cart.length){state.cart.length=0;if(typeof renderCart==='function')renderCart()}
		if(state.orderType!=='Takeaway'){const a=el('[data-ow-type="Takeaway"]')||el('[data-order-type="Takeaway"]');if(a){try{a.click()}catch(e){}}state.orderType='Takeaway'}
		if(state.payment!=='Cash'){const p=el('[data-px-pay="Cash"]')||el('[data-payment="Cash"]');if(p){try{p.click()}catch(e){}}state.payment='Cash'}
	}}catch(e){}
	const wrap=el('#ow-address-wrap');if(wrap)wrap.hidden=true;
}catch(e){}}
let wasOpen=false,pending=false;
setInterval(()=>{const now=wizOpen();if(wasOpen&&!now)pending=true;if(!wasOpen&&now&&pending){pending=false;setTimeout(resetWizard,50)}wasOpen=now},200);
document.addEventListener('keydown',e=>{if(e.key==='F2'&&pending){pending=false;setTimeout(resetWizard,140)}},true);
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#ow-launch'):null;if(b&&pending){pending=false;setTimeout(resetWizard,140)}},true);

/* ----------------------------------- 80mm receipt engine (reprint ke liye) */
function cashierName(){try{const u=(typeof state!=='undefined'&&state&&state.user)||{};return u.fullName||u.name||u.username||'\u2014'}catch(e){return '\u2014'}}
function stamp(o){try{return new Date(o.createdAt||Date.now()).toLocaleString('en-PK',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
function gross(o){const s=o&&o.subtotal;return (typeof s==='number'&&s>0)?s:((o&&o.total)||0)+((o&&o.discount)||0)}
function pct(o){const g=gross(o),d=(o&&o.discount)||0;return g?Math.round(d/g*100):0}
function line2(a,b){return '<div class="tp-line"><span>'+a+'</span><b>'+b+'</b></div>'}
function vlabel(x){return x.variantName&&x.variantName!=='Regular'?' ('+E(x.variantName)+')':''}
function thermal(o,type){
	const dash='<div class="tp-dash"></div>';
	const items=o.items||[];
	const g=gross(o),d=o.discount||0,p=pct(o);
	if(type==='customer'){
		const rows=items.map(x=>'<div class="tp-item"><div><span>'+E(x.productName)+vlabel(x)+'</span><b>'+cash(x.lineTotal)+'</b></div><small>'+x.quantity+' x '+cash(x.unitPrice)+'</small></div>').join('');
		return '<div class="tp tp-customer"><div class="tp-head"><b>MNAHEL\u0027S CAFE</b><small>Lahore Road, Gaggoo Mandi</small><small>THE WORLD OF TASTE</small></div>'+dash+
			line2('Receipt',E(o.receiptNumber||'\u2014'))+line2('Token','#'+(o.tokenNumber==null?'\u2014':o.tokenNumber))+line2('Date',E(stamp(o)))+
			line2('Type',E(o.orderType||''))+line2('Payment',E(o.paymentMethod||'Cash'))+line2('Cashier',E(o.cashierName||cashierName()))+dash+
			line2('Customer',E(o.customerName||'Walk-in'))+line2('Phone',E(o.customerPhone||'\u2014'))+
			(o.orderType==='Delivery'&&o.deliveryAddress?'<div class="tp-addr"><span>Address</span><b>'+E(o.deliveryAddress)+'</b></div>':'')+dash+
			'<div class="tp-th"><span>Item</span><b>Amount</b></div>'+(rows||'<div class="tp-empty">No items</div>')+dash+
			line2('Price before discount',cash(g))+(d?line2('Discount ('+p+'%)','- '+cash(d)):line2('Discount','\u2014'))+
			'<div class="tp-total"><span>TOTAL PAID</span><b>'+cash(o.total)+'</b></div>'+
			(d?'<div class="tp-saved">Aap ne '+cash(d)+' bachaye ('+p+'% discount)</div>':'')+dash+
			'<div class="tp-foot"><b>SHUKRIYA \u00b7 THANK YOU</b><small>Freshly made, served with care.</small><small>Aap ka dobara intezaar rahega \u2014 Mnahel\u0027s Cafe</small></div></div>';
	}
	const krows=items.map(x=>'<div class="tp-kitem"><b>'+x.quantity+' x</b><span>'+E(x.productName)+(x.variantName&&x.variantName!=='Regular'?'<em>'+E(x.variantName)+'</em>':'')+'</span></div>').join('');
	return '<div class="tp tp-kitchen"><div class="tp-head"><b>KITCHEN TICKET</b><small>Prepare order carefully</small></div><div class="tp-token">TOKEN #'+(o.tokenNumber==null?'\u2014':o.tokenNumber)+'</div>'+dash+
		line2('Receipt',E(o.receiptNumber||'\u2014'))+line2('Time',E(stamp(o)))+line2('Type',E(o.orderType||''))+line2('Customer',E(o.customerName||'Walk-in'))+line2('Phone',E(o.customerPhone||'\u2014'))+
		(o.orderType==='Delivery'&&o.deliveryAddress?'<div class="tp-addr"><span>Address</span><b>'+E(o.deliveryAddress)+'</b></div>':'')+dash+
		'<div class="tp-th"><span>Qty</span><b>Item</b></div>'+(krows||'<div class="tp-empty">No items</div>')+
		(o.notes?'<div class="tp-note"><b>NOTE</b><span>'+E(o.notes)+'</span></div>':'')+dash+
		'<div class="tp-foot"><b>KITCHEN COPY</b><small>'+E(o.orderType||'')+' \u00b7 '+items.reduce((n,x)=>n+x.quantity,0)+' items</small></div></div>';
}
function setSheet(o,type){const sheet=el('#print-sheet');if(!sheet)return;sheet.removeAttribute('style');sheet.className='print-sheet tp-sheet '+type;sheet.innerHTML=thermal(o,type)}
function bridge(type){return new Promise(resolve=>{let done=false;const h=e=>{if(e.data==='mnahels-print-'+type+'-done'||e.data==='mnahels-print-'+type+'-cancelled'){done=true;try{window.chrome.webview.removeEventListener('message',h)}catch(err){}resolve(true)}};try{window.chrome.webview.addEventListener('message',h);window.chrome.webview.postMessage('mnahels-print-'+type)}catch(err){resolve(false);return}setTimeout(()=>{if(!done)resolve(true)},20000)})}
async function printOne(o,type){setSheet(o,type);await sleep(150);if(window.__mnahelsDualPrintBridge&&window.chrome&&window.chrome.webview&&window.chrome.webview.postMessage)return bridge(type);window.print();await sleep(350);return true}

/* ------------- 1. Orders list: date/time + discount + reprint (poori row) */
let omap=new Map(),omapAt=0,oBusy=false;
async function orderMap(force){const now=Date.now();if(!force&&omap.size&&now-omapAt<4000)return omap;if(oBusy)return omap;oBusy=true;try{const os=await jget('/api/orders?take=200');omap=new Map((os||[]).map(o=>[String(o.id),o]));omapAt=Date.now()}catch(e){}finally{oBusy=false}return omap}
function cardList(){let list=all('#orders-list .order-card[data-id]');if(!list.length)list=all('#orders-list [data-id]').filter(n=>n.parentElement&&n.parentElement.id==='orders-list');return list}
function stripHtml(o){
	const g=gross(o),d=o.discount||0,p=pct(o);
	const mid=d
		?'<span class="v32-b">Before discount</span> <b>'+cash(g)+'</b><span class="v32-sep">\u00b7</span><span class="v32-b">Discount ('+p+'%)</span> <b class="v32-off">- '+cash(d)+'</b>'
		:'<span class="v32-b">Discount</span> <b>\u2014</b>';
	return '<div class="v32-strip"><div class="v32-when"><span>Placed on</span><strong>'+E(stamp(o))+'</strong></div>'+
		'<div class="v32-amt">'+mid+'<span class="v32-sep">\u00b7</span><span class="v32-b">Total paid</span> <b class="v32-paid">'+cash(o.total)+'</b></div>'+
		'<div class="v32-btns"><button type="button" class="v32-btn" data-v32-reprint="customer" data-id="'+o.id+'">Reprint customer receipt</button>'+
		'<button type="button" class="v32-btn" data-v32-reprint="kitchen" data-id="'+o.id+'">Reprint kitchen receipt</button></div></div>';
}
function decorate(){const list=cardList().filter(c=>c.dataset.v32!=='1');if(!list.length)return;orderMap(false).then(map=>{list.forEach(c=>{if(c.dataset.v32==='1')return;const o=map.get(String(c.dataset.id));if(!o)return;if(c.querySelector('.v32-strip')){c.dataset.v32='1';return}try{c.insertAdjacentHTML('afterbegin',stripHtml(o));c.dataset.v32='1'}catch(e){}})})}
let printing=false;
document.addEventListener('click',async e=>{
	const b=e.target&&e.target.closest?e.target.closest('[data-v32-reprint]'):null;if(!b)return;
	e.preventDefault();e.stopImmediatePropagation();
	if(printing)return;printing=true;b.disabled=true;
	const type=b.getAttribute('data-v32-reprint');
	try{const map=await orderMap(true);const o=map.get(String(b.dataset.id));if(!o){say('Order load nahi hua \u2014 Refresh karke dobara koshish karein.');return}
		await printOne(o,type);say(type==='customer'?'Customer receipt print par bhej di gayi.':'Kitchen receipt print par bhej di gayi.')}
	catch(err){say((err&&err.message)||'Print error')}
	finally{printing=false;b.disabled=false}
},true);

/* ----------- 4. Settings: MAUJOOD backup panel theek karna (ek hi panel) */
function bpanel(){
	const direct=el('#backup-settings-card');if(direct)return direct;
	const cands=all('section,article,div,form').filter(n=>{const t=n.textContent||'';return (t.indexOf('Recurring backup')>=0||t.indexOf('Backup interval')>=0||t.indexOf('Backup folder')>=0)&&!!n.querySelector('input')&&!!n.querySelector('button')});
	if(!cands.length)return null;
	cands.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length);
	return cands[0];
}
function bfields(p){
	const folder=el('#auto-backup-folder')||p.querySelector('input[type="text"]')||p.querySelector('input:not([type])');
	const sel=el('#auto-backup-interval')||p.querySelector('select');
	const chk=el('#auto-backup-enabled')||p.querySelector('input[type="checkbox"]');
	return {folder:folder,sel:sel,chk:chk};
}
function fillIntervals(sel,current){
	if(!sel)return;
	if(!sel.options.length){sel.innerHTML=IVAL.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')}
	if(current){
		const want=String(current);let has=false;
		[...sel.options].forEach(o=>{if(String(o.value)===want)has=true});
		if(!has){const o=document.createElement('option');o.value=want;o.textContent='har '+want+' minute';sel.appendChild(o)}
		if(String(sel.value)!==want)sel.value=want;
	}
}
function bnode(p,cls){let n=p.querySelector('.'+cls);if(!n){n=document.createElement('div');n.className=cls;p.appendChild(n)}return n}
function bok(p,html){const n=bnode(p,'v32-bstatus');n.className='v32-bstatus good';n.innerHTML=html}
function bbad(p,html){const n=bnode(p,'v32-bstatus');n.className='v32-bstatus bad';n.innerHTML=html}
function latestText(s){const l=s&&s.latestBackup;if(!l)return 'ab tak koi nahi';if(typeof l==='string')return l;return l.name||l.fileName||l.createdAt||'ab tak koi nahi'}
function bline(s){const iv=(s&&s.autoBackupIntervalMinutes)||1440;let lbl='har '+iv+' minute';IVAL.forEach(x=>{if(x[0]===iv)lbl=x[1]});
	return '<b>Saved folder:</b> '+E(((s&&s.autoBackupFolder)||'').trim()||DEFAULT_FOLDER)+'<br><b>Auto backup:</b> '+((s&&s.autoBackupEnabled)?'ON':'OFF')+' \u00b7 '+E(lbl)+'<br><b>Latest backup:</b> '+E(latestText(s))}
let scache=null;
async function loadBackup(p,quiet){
	try{
		const s=await jget('/api/settings');scache=s;
		const f=bfields(p);
		if(f.folder&&document.activeElement!==f.folder)f.folder.value=((s.autoBackupFolder||'').trim())||DEFAULT_FOLDER;
		fillIntervals(f.sel,s.autoBackupIntervalMinutes||1440);
		if(f.chk)f.chk.checked=!!s.autoBackupEnabled;
		if(!quiet)bok(p,bline(s));
		return s;
	}catch(e){
		if(e.status===401||e.status===403)bbad(p,'Ye setting sirf <b>Admin</b> login me khulti hai \u2014 admin se login karein.');
		else bbad(p,'Settings load nahi hui: '+E(e.message||''));
		return null;
	}
}
async function saveBackup(p){
	const f=bfields(p);
	const folder=((f.folder&&f.folder.value)||'').trim();
	const interval=parseInt((f.sel&&f.sel.value)||'1440',10)||1440;
	const enabled=f.chk?!!f.chk.checked:(scache?!!scache.autoBackupEnabled:false);
	bok(p,'Save ho raha hai\u2026');
	try{
		await jsend('PUT','/api/settings',{autoBackupEnabled:enabled,autoBackupIntervalMinutes:interval,autoBackupFolder:folder||null,menuIdSearchEnabled:scache?scache.menuIdSearchEnabled!==false:true});
		const s=await loadBackup(p,true);
		bok(p,'<b>Save ho gaya \u2713</b><br>'+bline(s||{autoBackupFolder:folder,autoBackupIntervalMinutes:interval,autoBackupEnabled:enabled}));
		say('Backup settings save ho gayi.');
	}catch(e){
		if(e.status===401||e.status===403)bbad(p,'Save nahi hua \u2014 ye setting sirf <b>Admin</b> login me chalti hai.');
		else bbad(p,'<b>Save nahi hua</b><br>'+E(e.message||'')+'<br>Folder ka poora path likhein (misal: E:'+BS+'POS-Backups) aur us drive par likhne ki ijazat honi chahiye.');
	}
}
async function runBackup(p){
	bok(p,'Backup ban raha hai\u2026');
	try{const r=await jsend('POST','/api/backup/run',{});const s=await loadBackup(p,true);
		bok(p,'<b>Backup ban gaya \u2713</b>'+(r&&(r.name||r.fileName)?' \u00b7 '+E(r.name||r.fileName):'')+'<br>'+bline(s||scache||{}));say('Backup ban gaya.')}
	catch(e){if(e.status===401||e.status===403)bbad(p,'Backup nahi bana \u2014 Admin login zaroori hai.');else bbad(p,'Backup nahi bana: '+E(e.message||''))}
}
document.addEventListener('click',e=>{
	const t=e.target&&e.target.closest?e.target.closest('button,a,[role="button"]'):null;if(!t)return;
	const p=bpanel();if(!p||!p.contains(t))return;
	const txt=(t.textContent||'').trim().toLowerCase();
	if(t.id==='save-backup-settings'||txt.indexOf('save backup')>=0||txt==='save'||txt.indexOf('save karein')>=0){e.preventDefault();e.stopImmediatePropagation();saveBackup(p);return}
	if(t.id==='run-backup-now'||txt.indexOf('backup now')>=0||txt.indexOf('abhi backup')>=0){e.preventDefault();e.stopImmediatePropagation();runBackup(p);return}
},true);
function initBackup(){
	const stale=el('#v32-backup-card');if(stale&&stale.parentElement)stale.parentElement.removeChild(stale);
	const p=bpanel();if(!p||p.dataset.v32==='1')return;
	p.dataset.v32='1';
	const f=bfields(p);
	if(f.folder){f.folder.disabled=false;f.folder.readOnly=false;if(!f.folder.placeholder)f.folder.placeholder=DEFAULT_FOLDER}
	if(f.sel)f.sel.disabled=false;
	const hint=document.createElement('p');hint.className='v32-hint';
	hint.innerHTML='Folder ka poora path likhein (misal: E:'+BS+'POS-Backups) \u00b7 Save karne par server ka asli jawab neeche likha aata hai \u00b7 Ye setting sirf <b>Admin</b> login me chalti hai.';
	p.appendChild(hint);
	loadBackup(p,false);
}

/* ------------------------------------------------ build ka nishan + check */
function chip(){const host=el('.side-bottom');if(!host)return;let n=el('#v32-build');if(!n){n=document.createElement('small');n.id='v32-build';n.className='v32-build';host.appendChild(n)}const t='features '+BUILD;if(n.textContent!==t)n.textContent=t}
function note(){const p=bpanel();if(!p)return;let n=p.querySelector('.v32-note');if(!n){n=document.createElement('small');n.className='v32-note';p.appendChild(n)}const c=cardList().length;
	const t='Feature check \u00b7 build '+BUILD+': order strip '+(c?('ON ('+c+' cards)'):'orders screen par check karein')+' \u00b7 F2 reset ON \u00b7 Ctrl+\u2190/\u2192 payment ON \u00b7 print 70mm / left 0.8mm / font 11';
	if(n.textContent!==t)n.textContent=t}

setInterval(()=>{try{decorate()}catch(e){}try{initBackup()}catch(e){}try{chip();note()}catch(e){}},800);
setTimeout(()=>{try{decorate()}catch(e){}try{initBackup()}catch(e){}try{chip()}catch(e){}},900);
})();
