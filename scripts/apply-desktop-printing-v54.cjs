/* Mnahel's Cafe POS v0.15.54 desktop print patch.
 * Uses the existing RAW ESC/POS path first for every receipt, including v43/v62,
 * and keeps the current HTML print path as a fallback only.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const printingPath=path.join(root,'src','MnahelsCafe.Desktop','Printing.cs');
const programPath=path.join(root,'src','MnahelsCafe.Desktop','Program.cs');
const printing=fs.readFileSync(printingPath,'utf8');
let program=fs.readFileSync(programPath,'utf8');
const oldCondition='if (_printers.RawTextPrint && !exactHtmlDesign)';
const newCondition='if (_printers.RawTextPrint)';
if(program.includes(oldCondition))program=program.replace(oldCondition,newCondition);
else if(!program.includes(newCondition))throw new Error('desktop RAW print condition was not found.');
const oldComment='// Compact 80mm receipts use the WebView HTML engine so the printer-safe\n            // white header, readable type, outlined icons, tables and seals stay exact.';
const newComment='// Use the existing RAW ESC/POS path first, including for styled receipts.\n            // If RAW cannot print, execution continues into the existing HTML fallback.';
if(program.includes(oldComment))program=program.replace(oldComment,newComment);
program=program.replace(/internal const string BuildTag = "[^"]+";/,'internal const string BuildTag = "0.15.54";');
program=program.replace(/var uiRevision = "[^"]+";/,'var uiRevision = "20260905-receipt-repair-54";');
if(!program.includes(newCondition)||program.includes(oldCondition))throw new Error('RAW print was not enabled for styled receipts.');
if(!program.includes('BuildTag = "0.15.54"')||!program.includes('20260905-receipt-repair-54'))throw new Error('desktop receipt repair version was not stamped.');
if(!printing.includes('internal static class ReceiptText')||!printing.includes('.v43-item-row'))throw new Error('existing styled-receipt RAW parser was not found.');
fs.writeFileSync(programPath,program,'utf8');
console.log('v0.15.54 desktop RAW-first receipt printing verified; HTML fallback preserved.');
