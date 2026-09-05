/* Mnahel's Cafe POS v0.15.54 build patch
 * - keeps the existing order/cart/update flow
 * - loads the focused v62 receipt repair after v61
 * - verifies full new-order receipts and change-only updated receipts
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'src','MnahelsCafe.Pos','wwwroot');
const indexPath=path.join(web,'index.html');
const v61Path=path.join(web,'v61.js');
const v62Path=path.join(web,'v62.js');
const v62CssPath=path.join(web,'v62.css');
const RELEASE='0.15.54';
const REVISION='20260905-receipt-repair-54';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const write=(file,value)=>fs.writeFileSync(file,value,'utf8');

let index=read(indexPath);
if(!index.includes('/v61.css')||!index.includes('/v61.js'))throw new Error('v61 order-edit assets must be installed before the v54 receipt repair.');
if(!index.includes('/v62.css'))index=index.replace(/(<link rel="stylesheet" href="\/v61\.css\?v=[^"]+">)/,'$1\n<link rel="stylesheet" href="/v62.css?v='+REVISION+'">');
if(!index.includes('/v62.js'))index=index.replace(/(<script src="\/v61\.js\?v=[^"]+"><\/script>)/,'$1\n<script src="/v62.js?v='+REVISION+'"></script>');
index=index.replace(/<link rel="stylesheet" href="\/v62\.css\?v=[^"]+">/,'<link rel="stylesheet" href="/v62.css?v='+REVISION+'">');
index=index.replace(/<script src="\/v62\.js\?v=[^"]+"><\/script>/,'<script src="/v62.js?v='+REVISION+'"></script>');
index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="'+RELEASE+'">');
write(indexPath,index);

let v61=read(v61Path);
v61=v61.replace(/const BUILD='[^']+',REV='[^']+';/,"const BUILD='"+RELEASE+"',REV='"+REVISION+"';");
write(v61Path,v61);

const v62=read(v62Path),v62css=read(v62CssPath),finalIndex=read(indexPath);
const checks=[
 ['v62 loaded after v61',finalIndex.indexOf('/v61.js')>=0&&finalIndex.indexOf('/v62.js')>finalIndex.indexOf('/v61.js')],
 ['v62 css loaded after v61',finalIndex.indexOf('/v61.css')>=0&&finalIndex.indexOf('/v62.css')>finalIndex.indexOf('/v61.css')],
 ['shared new-order receipt renderer',v62.includes('normalReceiptHtml')&&v62.includes('mnahelsV43')],
 ['updated receipt renderer',v62.includes('updatedReceiptHtml')],
 ['previous order amount',v62.includes('PREVIOUS ORDER')],
 ['new item amount',v62.includes('NEWLY ADDED ITEMS')],
 ['cancelled item impact',v62.includes('CANCELLED / REMOVED ITEMS')],
 ['final total',v62.includes('FINAL ORDER TOTAL')],
 ['update completion print hook',v62.includes('completeRunningOrder')&&v62.includes('printUpdatedReceipt')],
 ['empty receipt guard',v62.includes("Receipt khali hai")],
 ['receipt styles present',v62css.includes('.v62-updated-receipt')],
 ['release stamped',finalIndex.includes('content="'+RELEASE+'"')&&v61.includes("const BUILD='"+RELEASE+"'")]
];
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length)throw new Error('Receipt repair v'+RELEASE+' verification failed: '+failed.join(', '));
new Function(v62);new Function(v61);
console.log('v'+RELEASE+' existing order-edit flow and non-empty receipt repair verified.');
