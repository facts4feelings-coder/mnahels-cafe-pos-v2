/* Mnahel's Cafe POS v0.15.50 build patch
 * - order log on the Shift screen only, plus a per-order log
 * - every RUNNING ORDER / cancellation slip is built and printed by v61
 * - original slip footer restored on every copy
 * - downloaded slips are named MC_<order>_<type>.jpeg
 * - the edit banner stays out of the .cart-panel grid so the cart renders normally
 * - the cart button reads Book order for new orders and Update order while editing
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const web = path.join(root, 'src', 'MnahelsCafe.Pos', 'wwwroot');
const RELEASE = '0.15.50';
const REVISION = '20260905-edit-cart-service-hub-50';

const lf = value => value.replace(/\r\n/g, '\n');
const read = file => lf(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, value, 'utf8');

function insertOnce(value, marker, addition, label) {
	if (value.includes(addition)) return value;
	if (!value.includes(marker)) throw new Error(label + ' marker was not found.');
	return value.replace(marker, addition + marker);
}

function replaceOnce(value, oldText, newText, label) {
	if (value.includes(newText)) return value;
	if (!value.includes(oldText)) throw new Error(label + ' source was not found.');
	return value.replace(oldText, newText);
}

function stamp(file, pattern, replacement) {
	const target = path.join(web, file);
	if (!fs.existsSync(target)) return;
	const value = read(target);
	if (!pattern.test(value)) return;
	write(target, value.replace(pattern, replacement));
}

/* 1. Load v61 assets after v60 so they win, and ship the cart button already
      labelled Book order so no Place order text is ever visible. */
const indexPath = path.join(web, 'index.html');
let index = read(indexPath);
index = insertOnce(index, '</head>', '<link rel="stylesheet" href="/v61.css?v=' + REVISION + '">\n', 'v61 stylesheet');
index = insertOnce(index, '</body>', '<script src="/v61.js?v=' + REVISION + '"></script>\n', 'v61 script');
index = index.replace(/<meta name="application-version" content="[^"]*">/, '<meta name="application-version" content="' + RELEASE + '">');
index = index.replace('<span>Place order</span>', '<span>Book order</span>');
write(indexPath, index);

/* 2. Running-order slips are built and printed by v61. */
const v58Path = path.join(web, 'v58.js');
let v58 = read(v58Path);
v58 = replaceOnce(
	v58,
	'function deltaReceiptHtml(order,lines,type,result){',
	'function deltaReceiptHtml(order,lines,type,result){if(window.mnahelsV61&&window.mnahelsV61.slipHtml)return window.mnahelsV61.slipHtml(order,lines,type,result);',
	'v58 running slip markup delegation'
);
v58 = replaceOnce(
	v58,
	'async function printRunningSlip(order,lines,type,result){',
	'async function printRunningSlip(order,lines,type,result){if(window.mnahelsV61&&window.mnahelsV61.printSlip)return window.mnahelsV61.printSlip(order,lines,type,result);',
	'v58 running slip print delegation'
);
write(v58Path, v58);

/* 3. Order log lives on the Shift screen only. */
const v59Path = path.join(web, 'v59.js');
write(
	v59Path,
	replaceOnce(
		read(v59Path),
		'function ensureOrderLog(){ensureShiftOrderLog();ensureDashboardOrderLog()}',
		'function ensureOrderLog(){ensureShiftOrderLog();if(window.__v61DashboardLog)ensureDashboardOrderLog()}',
		'dashboard order log removal'
	)
);

/* 4. The original THANK YOU footer, with the company credit on every copy
      including the kitchen and waiter slips. The new text is a substring of
      the old ternary, so the guard checks the ternary itself. */
const v43Path = path.join(web, 'v43.js');
const footerTernary = "${customer?'<b>A product by eastern cross technology</b><small>www.easterncrosstech.com</small>':''}";
const footerCredit = '<b>A product by eastern cross technology</b><small>www.easterncrosstech.com</small>';
let v43 = read(v43Path);
if (v43.includes(footerTernary)) {
	v43 = v43.replace(footerTernary, footerCredit);
	write(v43Path, v43);
} else if (!v43.includes(footerCredit)) {
	throw new Error('slip footer credit source was not found.');
}

/* 5. Downloaded slips are named MC_<order number>_<receipt type>.jpeg */
const v45Path = path.join(web, 'v45.js');
write(
	v45Path,
	replaceOnce(
		read(v45Path),
		'  return `mnahels-${cleanName(token)}-${cleanName(kind)}-slip.jpg`;',
		"  return 'MC_' + cleanName(String(token).replace(/^MC[-_]?/i, '')) + '_' + cleanName(kind) + '.jpeg';",
		'slip download file name'
	)
);

/* 6. .cart-panel is a grid (cart-head / segment / cart-items / cart-footer), so a
      fifth direct child shifted every row and pushed the cart heading into the
      middle of the panel. The edit banner now lives inside .cart-head, which is a
      single auto row. Cancelling an edit restores the Book order label instead of
      the old Place order text. */
const v56Path = path.join(web, 'v56.js');
let v56 = read(v56Path);
v56 = replaceOnce(
	v56,
	'    panel.prepend(banner);',
	"    (panel.querySelector('.cart-head') || panel).prepend(banner);",
	'edit banner mount point'
);
v56 = replaceOnce(
	v56,
	"    if (button) button.textContent = 'Place order';",
	"    if (button) button.textContent = 'Book order';",
	'cart button reset label'
);
write(v56Path, v56);

/* 7. Version stamps. */
stamp('v56.js', /const RELEASE = '[^']+'/, "const RELEASE = '" + RELEASE + "'");
stamp('v57.js', /const BUILD='[^']+'/, "const BUILD='" + RELEASE + "'");
stamp('v58.js', /const BUILD='[^']+',REV='[^']+';/, "const BUILD='" + RELEASE + "',REV='" + REVISION + "';");
stamp('v59.js', /const BUILD='[^']+',UI_REVISION='[^']+';/, "const BUILD='" + RELEASE + "',UI_REVISION='" + REVISION + "';");
stamp('v60.js', /const BUILD='[^']+',REV='[^']+';/, "const BUILD='" + RELEASE + "',REV='" + REVISION + "';");
stamp('v61.js', /const BUILD='[^']+',REV='[^']+';/, "const BUILD='" + RELEASE + "',REV='" + REVISION + "';");

/* 8. Verification. */
const finalIndex = read(indexPath);
const finalV43 = read(v43Path);
const finalV45 = read(v45Path);
const finalV56 = read(v56Path);
const finalV58 = read(v58Path);
const finalV59 = read(v59Path);
const v61 = read(path.join(web, 'v61.js'));
const v61css = read(path.join(web, 'v61.css'));

const checks = [
	['v61 stylesheet installed', finalIndex.includes('/v61.css')],
	['v61 script installed', finalIndex.includes('/v61.js')],
	['v60 order console preserved', finalIndex.includes('/v60.js')],
	['v58 running-order script preserved', finalIndex.includes('/v58.js')],
	['markup ships book order label', finalIndex.includes('<span>Book order</span>') && !finalIndex.includes('<span>Place order</span>')],
	['running slip markup delegated to v61', finalV58.includes('window.mnahelsV61.slipHtml')],
	['running slip print delegated to v61', finalV58.includes('window.mnahelsV61.printSlip')],
	['dashboard order log removed', finalV59.includes('if(window.__v61DashboardLog)ensureDashboardOrderLog()')],
	['dashboard order log hidden by css', v61css.includes('#v59-dashboard-order-audit{display:none!important}')],
	['slip footer credit on every copy', finalV43.includes(footerCredit) && !finalV43.includes(footerTernary)],
	['slip footer untouched by v61', !v61.includes('v61-foot-facts')],
	['slip download name', finalV45.includes("'MC_' + cleanName(") && finalV45.includes("'.jpeg'")],
	['running order banner after customer details', v61.includes('v61-running-banner') && v61.indexOf('v61-running-banner') > v61.indexOf("metaCell('CUSTOMER'")],
	['amendment watcher accepts api prefix', v61.includes('function pathOf')],
	['create order rewritten while editing', v61.includes("clean==='/orders'&&editing()&&editingId")],
	['delta items only', v61.includes('function deltaRows')],
	['previous total on slip', v61.includes('PREVIOUS TOTAL')],
	['current bill on slip', v61.includes('CURRENT BILL - NEW ITEMS')],
	['final total on slip', v61.includes('FINAL TOTAL')],
	['cancelled row marked', v61.includes('v61-cancel-tag')],
	['book and update labels', v61.includes("'Update order'") && v61.includes("'Book order'")],
	['edit banner mounted in cart head', finalV56.includes("(panel.querySelector('.cart-head') || panel).prepend(banner)")],
	['no place order text left in v56', !finalV56.includes("'Place order'")],
	['edit banner styled inside cart head', v61css.includes('#screen-pos .cart-head>#v56-edit-banner')],
	['edit banner kept out of cart grid', v61.includes('function relocateEditBanner')],
	['service hub shortcut', v61.includes('function goServiceHub') && v61.includes('v61-add-service')],
	['build number stamped in ui', v61.includes('function stampBuild')],
	['per-order log section', v61.includes('v61-per-order')],
	['release version stamped', v61.includes("const BUILD='" + RELEASE + "'") && finalV59.includes("const BUILD='" + RELEASE + "'") && finalV58.includes("const BUILD='" + RELEASE + "'")]
];

const failed = checks.filter(entry => !entry[1]).map(entry => entry[0]);
if (failed.length) throw new Error('Shift order log and running slip v' + RELEASE + ' verification failed: ' + failed.join(', '));

new Function(finalV43);
new Function(finalV45);
new Function(finalV56);
new Function(finalV58);
new Function(finalV59);
new Function(v61);

console.log('v' + RELEASE + ' edit-mode cart, Book/Update labels, Service Hub shortcut, slip names and order log verified.');
