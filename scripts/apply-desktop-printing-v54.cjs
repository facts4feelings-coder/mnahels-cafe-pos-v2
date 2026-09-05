/* Mnahel's Cafe POS v0.15.54 desktop print patch.
 * Uses the existing RAW ESC/POS path first for every receipt, including v43/v62,
 * and keeps the current HTML print path as a fallback only.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const printingPath=path.join(root,'src','MnahelsCafe.Desktop','Printing.cs');
const programPath=path.join(root,'src','MnahelsCafe.Desktop','Program.cs');
let printing=fs.readFileSync(printingPath,'utf8');
let program=fs.readFileSync(programPath,'utf8');
const oldCondition='if (_printers.RawTextPrint && !exactHtmlDesign)';
const newCondition='if (_printers.RawTextPrint)';
if(printing.includes(oldCondition))printing=printing.replace(oldCondition,newCondition);
else if(!printing.includes(newCondition))throw new Error('desktop RAW print condition was not found.');
program=program.replace(/internal const string BuildTag = "[^"]+";/,'internal const string BuildTag = "0.15.54";');
program=program.replace(/var uiRevision = "[^"]+";/,'var uiRevision = "20260905-receipt-repair-54";');
if(!printing.includes(newCondition)||printing.includes(oldCondition))throw new Error('RAW print was not enabled for styled receipts.');
if(!program.includes('BuildTag = "0.15.54"')||!program.includes('20260905-receipt-repair-54'))throw new Error('desktop receipt repair version was not stamped.');
fs.writeFileSync(printingPath,printing,'utf8');
fs.writeFileSync(programPath,program,'utf8');
console.log('v0.15.54 desktop RAW-first receipt printing verified; HTML fallback preserved.');
