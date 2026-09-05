/* Mnahel's Cafe POS v0.15.55 desktop print patch.
 * Uses the existing RAW ESC/POS path first for every receipt, including v43/v62,
 * and keeps the current HTML print path as a fallback only.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const programPath=path.join(root,'src','MnahelsCafe.Desktop','Program.cs');
let program=fs.readFileSync(programPath,'utf8');
const oldCondition='if (_printers.RawTextPrint && !exactHtmlDesign)';
const newCondition='if (_printers.RawTextPrint)';
if(program.includes(oldCondition))program=program.replace(oldCondition,newCondition);
else if(!program.includes(newCondition))throw new Error('desktop RAW print condition was not found.');
const oldComment='// Compact 80mm receipts use the WebView HTML engine so the printer-safe\n            // white header, readable type, outlined icons, tables and seals stay exact.';
const newComment='// Use the existing RAW ESC/POS path first, including for styled receipts.\n            // If RAW cannot print, execution continues into the existing HTML fallback.';
if(program.includes(oldComment))program=program.replace(oldComment,newComment);
if(!program.includes(newCondition)||program.includes(oldCondition))throw new Error('RAW print was not enabled for styled receipts.');
if(!program.includes('BuildTag = "0.15.55"')||!program.includes('20260905-receipt-data-55'))throw new Error('desktop performance patch did not stamp the v0.15.55 UI revision.');
fs.writeFileSync(programPath,program,'utf8');
console.log('v0.15.55 desktop RAW-first receipt printing verified; HTML fallback preserved.');
