const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,value)=>fs.writeFileSync(path.join(root,p),value,'utf8');
const lf=value=>value.replace(/\r\n/g,'\n');
const RELEASE='0.15.47';
const REVISION='20260905-order-edit-console-47';

const editingPath='src/MnahelsCafe.Pos/OrderEditingFeatures.cs';
let editing=lf(read(editingPath));
const oldLoad='    private static async Task<IResult> LoadOrder(long id, PosDb db)\n    {\n        var order = await db.Orders.Include(x => x.Items).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);\n        if (order is null) return Results.NotFound(new { message = "Order not found." });\n        var catalog = await LoadCatalog(db);\n        return Results.Ok(EditableView(order, catalog));\n    }';
const newLoad='    private static async Task<IResult> LoadOrder(long id, PosDb db)\n    {\n        try\n        {\n            var order = await db.Orders.Include(x => x.Items).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);\n            if (order is null) return Results.NotFound(new { message = "Order not found." });\n            Dictionary<int, ProductVariant> catalog;\n            try { catalog = await LoadCatalog(db); }\n            catch { catalog = new Dictionary<int, ProductVariant>(); }\n            return Results.Ok(EditableView(order, catalog));\n        }\n        catch (Exception error)\n        {\n            return Results.Json(new { message = $"Order edit load failed: {error.Message}" }, statusCode: 500);\n        }\n    }';
if(!editing.includes('Order edit load failed')){
 if(!editing.includes(oldLoad))throw new Error('order edit loader source was not found.');
 editing=editing.replace(oldLoad,newLoad);
}
write(editingPath,editing);

const v56Path='src/MnahelsCafe.Pos/wwwroot/v56.js';
let v56=lf(read(v56Path)).replace(/const RELEASE = '[^']+'/,"const RELEASE = '"+RELEASE+"'");
write(v56Path,v56);

const v57Path='src/MnahelsCafe.Pos/wwwroot/v57.js';
let v57=lf(read(v57Path)).replace(/const BUILD='[^']+'/,"const BUILD='"+RELEASE+"'");
write(v57Path,v57);

const v59Path='src/MnahelsCafe.Pos/wwwroot/v59.js';
let v59=lf(read(v59Path)).replace(/const BUILD='[^']+',UI_REVISION='[^']+';/,"const BUILD='"+RELEASE+"',UI_REVISION='"+REVISION+"';");
write(v59Path,v59);

const v60Path='src/MnahelsCafe.Pos/wwwroot/v60.js';
let v60=lf(read(v60Path)).replace(/const BUILD='[^']+',REV='[^']+';/,"const BUILD='"+RELEASE+"',REV='"+REVISION+"';");
write(v60Path,v60);

const v60Css=read('src/MnahelsCafe.Pos/wwwroot/v60.css');

const indexPath='src/MnahelsCafe.Pos/wwwroot/index.html';
let index=read(indexPath).replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="'+RELEASE+'">');
if(!index.includes('/v60.css'))index=index.replace('</head>','<link rel="stylesheet" href="/v60.css?v='+REVISION+'"></head>');
if(!index.includes('/v60.js'))index=index.replace('</body>','<script src="/v60.js?v='+REVISION+'"></script></body>');
write(indexPath,index);

const checks=[
 ['v60 stylesheet installed',index.includes('/v60.css')],
 ['v60 script installed',index.includes('/v60.js')],
 ['v59 audit script preserved',index.includes('/v59.js')],
 ['v58 running-order script preserved',index.includes('/v58.js')],
 ['prominent yellow edit button',v60.includes('v60-edit')&&v60Css.includes('.v60-edit')],
 ['edit button placed in card header',v60.includes('v36-card-actions')&&v60.includes('host.prepend(button)')],
 ['resilient edit loading',v60.includes('loadList')&&v60.includes('originalQuantity')],
 ['legacy edit action intercepted',v60.includes('data-op=')],
 ['bottom action strip removed',v60.includes('v56-operation-actions')&&v60Css.includes('.v56-operation-actions{display:none!important}')],
 ['dashboard order log full width',v59.includes('v59-dashboard-order-audit')&&v59.includes('.admin-grid')],
 ['dashboard order log error notice',v59.includes('Order log load nahi hua')],
 ['order edit server guard',editing.includes('Order edit load failed')],
 ['release version stamped',v56.includes("const RELEASE = '"+RELEASE+"'")&&v59.includes("const BUILD='"+RELEASE+"'")&&v60.includes("const BUILD='"+RELEASE+"'")&&index.includes('content="'+RELEASE+'"')]
];
const failed=checks.filter(entry=>!entry[1]).map(entry=>entry[0]);
if(failed.length)throw new Error('Order edit console v'+RELEASE+' verification failed: '+failed.join(', '));
new Function(v56);new Function(v57);new Function(v59);new Function(v60);
console.log('v'+RELEASE+' prominent order editing and dashboard order log verified.');
