/* Mnahel's Cafe POS legacy desktop print patch.
 * v0.15.57 runs after this historical patch and restores the approved HTML path.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const programPath=path.join(root,'src','MnahelsCafe.Desktop','Program.cs');
let program=fs.readFileSync(programPath,'utf8').replace(/\r\n/g,'\n');
const oldCondition='if (_printers.RawTextPrint && !exactHtmlDesign)',newCondition='if (_printers.RawTextPrint)';
if(program.includes(oldCondition))program=program.replace(oldCondition,newCondition);
else if(!program.includes(newCondition))throw new Error('desktop RAW print condition was not found.');
if(!program.includes(newCondition)||program.includes(oldCondition))throw new Error('RAW print intermediate stage was not applied.');
if(!program.includes('BuildTag = "0.15.56"')||!program.includes('20260905-menu-images-order-print-56'))throw new Error('desktop performance patch did not stamp its expected intermediate revision.');
const bridge='window.__mnahelsDualPrintBridge=true;';
if(!program.includes('window.__mnahelsPrintJobBridge=true;')){
 if(!program.includes(bridge))throw new Error('Desktop bridge flag not found.');
 program=program.replace(bridge,bridge+'window.__mnahelsPrintJobBridge=true;');
}
// BridgeScript runs at document creation AND DOMContentLoaded. Register once.
if(!program.includes('window.__mnahelsAfterPrintBridge'))program=program.replace('window.__mnahelsPrintJobBridge=true;',"window.__mnahelsPrintJobBridge=true;if(!window.__mnahelsAfterPrintBridge){window.__mnahelsAfterPrintBridge=true;window.addEventListener('afterprint',function(){try{window.chrome.webview.postMessage('mnahels-print-dialog-closed')}catch(e){}});}");
if(!program.includes('TaskCompletionSource<bool>? _interactivePrintCompletion')){
 const field=/private readonly SemaphoreSlim _printGate[^;]+;/;
 if(!field.test(program))throw new Error('Native print gate field not found.');
 program=program.replace(field,match=>match+'\n    private TaskCompletionSource<bool>? _interactivePrintCompletion;');
}
if(!program.includes('message == "mnahels-print-dialog-closed"')){
 const marker='                var known = message is';
 if(!program.includes(marker))throw new Error('Native print message dispatch not found.');
 program=program.replace(marker,`                if (message == "mnahels-print-dialog-closed")
                {
                    _interactivePrintCompletion?.TrySetResult(true);
                    return;
                }
`+marker);
}
if(!program.includes('var dialogCompleted = new TaskCompletionSource<bool>')){
 // Preserve the existing enclosing try/catch, its log and false return.
 const statements='                    core.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);\n                    return true;';
 if(!program.includes(statements))throw new Error('Interactive print statements not found inside the existing try/catch.');
 program=program.replace(statements,`                    var dialogCompleted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                    _interactivePrintCompletion = dialogCompleted;
                    try
                    {
                        core.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);
                        var finished = await Task.WhenAny(dialogCompleted.Task, Task.Delay(TimeSpan.FromMinutes(5)));
                        return finished == dialogCompleted.Task;
                    }
                    finally
                    {
                        if (ReferenceEquals(_interactivePrintCompletion, dialogCompleted)) _interactivePrintCompletion = null;
                    }`);
}
fs.writeFileSync(programPath,program,'utf8');
console.log('Legacy desktop stage complete; existing try/catch preserved; final v57 HTML patch follows.');
