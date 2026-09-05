const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const patch=fs.readFileSync(path.join(__dirname,'apply-desktop-printing-v54.cjs'),'utf8');
// Exact relevant source statements from Program.cs, after performance stamps.
const original=`internal const string BuildTag = "0.15.56";
var uiRevision = "20260905-menu-images-order-print-56";
window.__mnahelsDualPrintBridge=true;
    private readonly SemaphoreSlim _printGate = new(1, 1);
                var known = message is "mnahels-print-customer" or "mnahels-print-kitchen" or "mnahels-silent-print";
            if (!_printers.Silent)
            {
                try
                {
                    core.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);
                    return true;
                }
                catch (Exception ex)
                {
                    PrinterConfig.Log("print-ui failed: " + ex.Message);
                    return false;
                }
            }
            if (_printers.RawTextPrint && !exactHtmlDesign)
            {
                if (await RawTextPrintAsync(core, type, widthMm)) return true;
            }
`;
function apply(source){let written;vm.runInNewContext(patch,{__dirname:'/repo/scripts',require:name=>name==='fs'?{readFileSync:()=>source,writeFileSync:(p,value)=>written=value}:require(name),console:{log(){}}});return written;}
for(const [label,source] of [['LF',original],['CRLF',original.replace(/\n/g,'\r\n')]]){
 const output=apply(source);assert(output.includes('var dialogCompleted = new TaskCompletionSource<bool>'));
 assert(output.includes('catch (Exception ex)\n                {\n                    PrinterConfig.Log("print-ui failed: " + ex.Message);\n                    return false;'));
 assert.equal(output.match(/core\.ShowPrintUI/g).length,1);
 assert.equal(output.match(/private TaskCompletionSource<bool>\? _interactivePrintCompletion;/g).length,1);
 assert.equal(apply(output),output,'Applying the patch twice must not duplicate edits');
 const bridge=output.split('\n').find(line=>line.startsWith('window.__mnahelsDualPrintBridge=true;'));
 let added=0;const window={addEventListener:name=>{assert.equal(name,'afterprint');added++;},chrome:{webview:{postMessage(){}}}};
 vm.runInNewContext(bridge,{window});vm.runInNewContext(bridge,{window});assert.equal(added,1,'Document-created and DOMContentLoaded must share one listener');
 console.log('PASS '+label+': nested try/catch, preserved errors, repeated patch and single listener');
}
assert.throws(()=>apply(original.replace('core.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);','core.ShowPrintUI(UnknownDialog);')),/Interactive print statements not found/);
console.log('PASS unexpected source fails safely rather than silently skipping the fix');
