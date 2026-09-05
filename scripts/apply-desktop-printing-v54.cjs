/* Mnahel's Cafe POS legacy desktop print patch.
 * v0.15.57 runs after this historical patch and restores the approved HTML path.
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
const newComment='// Historical RAW stage; the final v57 patch selects HTML for styled receipts.\n            // Legacy unstyled receipts retain their existing RAW fallback.';
if(program.includes(oldComment))program=program.replace(oldComment,newComment);
if(!program.includes(newCondition)||program.includes(oldCondition))throw new Error('RAW print intermediate stage was not applied.');
if(!program.includes('BuildTag = "0.15.56"')||!program.includes('20260905-menu-images-order-print-56'))throw new Error('desktop performance patch did not stamp its expected intermediate revision.');
const bridge='window.__mnahelsDualPrintBridge=true;';
if(!program.includes('window.__mnahelsPrintJobBridge=true;')){
 if(!program.includes(bridge))throw new Error('Desktop bridge flag not found.');
 program=program.replace(bridge,bridge+'window.__mnahelsPrintJobBridge=true;');
}
fs.writeFileSync(programPath,program,'utf8');
console.log('Legacy desktop stage complete; final v57 HTML print patch follows.');
