/* Mnahel's Cafe POS v0.15.48 build patch
 * - moves the order log out of the Admin dashboard into Shift only
 * - adds a per-order log section to the shift order log
 * - routes every RUNNING ORDER / cancellation slip through v61
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const web = path.join(root, 'src', 'MnahelsCafe.Pos', 'wwwroot');
const RELEASE = '0.15.48';
const REVISION = '20260905-shift-log-running-slip-48';

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

/* 1. Load v61 assets after v60 so they win. */
const indexPath = path.join(web, 'index.html');
let index = read(indexPath);
index = insertOnce(index, '</head>', '<link rel="stylesheet" href="/v61.css?v=' + REVISION + '">\n', 'v61 stylesheet');
index = insertOnce(index, '</body>', '<script src="/v61.js?v=' + REVISION + '"></script>\n', 'v61 script');
index = index.replace(/<meta name="application-version" content="[^"]*">/, '<meta name="application-version" content="' + RELEASE + '">');
write(indexPath, index);

/* 2. Every running-order slip is rendered by v61 (big heading, previous/current/final bill,
      cancellation slip keeps all original rows and marks the cancelled one). */
const v58Path = path.join(web, 'v58.js');
write(
	v58Path,
	replaceOnce(
		read(v58Path),
		'function deltaReceiptHtml(order,lines,type,result){',
		'function deltaReceiptHtml(order,lines,type,result){if(window.mnahelsV61&&window.mnahelsV61.slipHtml)return window.mnahelsV61.slipHtml(order,lines,type,result);',
		'v58 running slip delegation'
	)
);

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

/* 4. Version stamps. */
stamp('v56.js', /const RELEASE = '[^']+'/, "const RELEASE = '" + RELEASE + "'");
stamp('v57.js', /const BUILD='[^']+'/, "const BUILD='" + RELEASE + "'");
stamp('v58.js', /const BUILD='[^']+',REV='[^']+';/, "const BUILD='" + RELEASE + "',REV='" + REVISION + "';");
stamp('v59.js', /const BUILD='[^']+',UI_REVISION='[^']+';/, "const BUILD='" + RELEASE + "',UI_REVISION='" + REVISION + "';");
stamp('v60.js', /const BUILD='[^']+',REV='[^']+';/, "const BUILD='" + RELEASE + "',REV='" + REVISION + "';");
stamp('v61.js', /const BUILD='[^']+',REV='[^']+';/, "const BUILD='" + RELEASE + "',REV='" + REVISION + "';");

/* 5. Verification. */
const finalIndex = read(indexPath);
const v58 = read(v58Path);
const v59 = read(v59Path);
const v61 = read(path.join(web, 'v61.js'));
const v61css = read(path.join(web, 'v61.css'));

const checks = [
	['v61 stylesheet installed', finalIndex.includes('/v61.css')],
	['v61 script installed', finalIndex.includes('/v61.js')],
	['v60 order console preserved', finalIndex.includes('/v60.js')],
	['v58 running-order script preserved', finalIndex.includes('/v58.js')],
	['running slip delegated to v61', v58.includes('window.mnahelsV61.slipHtml')],
	['dashboard order log removed', v59.includes('if(window.__v61DashboardLog)ensureDashboardOrderLog()')],
	['dashboard order log hidden by css', v61css.includes('#v59-dashboard-order-audit{display:none!important}')],
	['running order banner after customer details', v61.includes('v61-running-banner') && v61.indexOf('v61-running-banner') > v61.indexOf("metaCell('CUSTOMER'")],
	['previous total on slip', v61.includes('PREVIOUS TOTAL')],
	['current bill on slip', v61.includes('CURRENT BILL - NEW ITEMS')],
	['final total on slip', v61.includes('FINAL TOTAL')],
	['cancellation keeps every row', v61.includes('function cancellationRows')],
	['cancelled row marked', v61.includes('v61-cancel-tag')],
	['per-order log section', v61.includes('v61-per-order')],
	['release version stamped', v61.includes("const BUILD='" + RELEASE + "'") && v59.includes("const BUILD='" + RELEASE + "'") && v58.includes("const BUILD='" + RELEASE + "'")]
];

const failed = checks.filter(entry => !entry[1]).map(entry => entry[0]);
if (failed.length) throw new Error('Shift order log and running slip v' + RELEASE + ' verification failed: ' + failed.join(', '));

new Function(v58);
new Function(v59);
new Function(v61);

console.log('v' + RELEASE + ' shift order log, per-order log and running-order slips verified.');
