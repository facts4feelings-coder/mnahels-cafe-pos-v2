/* v0.15.57: use the EXISTING HTML path for styled receipts so saved font sizes,
 * wrapping and boxes reach the printer. Legacy RAW receipts remain RAW-first;
 * retain RAW as recovery if the styled HTML job is rejected before success.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path');const file=path.resolve(__dirname,'../src/MnahelsCafe.Desktop/Program.cs');let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const condition='if (_printers.RawTextPrint && !exactHtmlDesign)';
if(!s.includes(condition))s=s.replace('if (_printers.RawTextPrint)',condition);
if(!s.includes(condition))throw Error('Existing styled HTML / legacy RAW routing not found.');
const marker='if (status == CoreWebView2PrintStatus.Succeeded) return true;';
if(!s.includes('v57-style-recovery')){if(!s.includes(marker))throw Error('Print result guard missing.');s=s.replace(marker,marker+'\n                // v57-style-recovery: never retry a successful job.\n                if (exactHtmlDesign && _printers.RawTextPrint && await RawTextPrintAsync(core, type, widthMm)) return true;');}
if(!s.includes('BuildTag = "0.15.57"')||!s.includes('20260905-receipt-wrap-57'))throw Error('Desktop version stamp missing.');
fs.writeFileSync(file,s,'utf8');console.log('v0.15.57 existing HTML receipt route, RAW recovery and legacy route verified.');
