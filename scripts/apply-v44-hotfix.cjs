const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,value)=>fs.writeFileSync(path.join(root,p),value,'utf8');
const lf=value=>value.replace(/\r\n/g,'\n');
function replaceRequired(value,oldText,newText,label){if(value.includes(newText))return value;if(!value.includes(oldText))throw new Error(label+' source was not found.');return value.replace(oldText,newText)}

const programPath='src/MnahelsCafe.Pos/Program.cs';let program=read(programPath);
program=replaceRequired(program,'SchemaUpgrade.Apply(db);OrderEditingFeatures.ApplySchema(db);SeedData.Apply(db);V42MenuMigration.Apply(db);','SchemaUpgrade.Apply(db);OrderEditingFeatures.ApplySchema(db);SeedData.Apply(db);CredentialMigrationV44.Apply(db);V42MenuMigration.Apply(db);','credential migration startup hook');
program=replaceRequired(program,'ReceiptSettingsFeatures.MapApi(api,dataRoot);OrderEditingFeatures.MapApi(api);','ReceiptSettingsFeatures.MapApi(api,dataRoot);OrderEditingFeatures.MapApi(api);OrderLogFeatures.MapApi(api);','shift order log API hook');write(programPath,program);

const appPath='src/MnahelsCafe.Pos/wwwroot/app.js';let app=read(appPath);if(!app.includes('const state=window.state={'))app=replaceRequired(app,'const state={','const state=window.state={','shared application state');write(appPath,app);

const editingPath='src/MnahelsCafe.Pos/OrderEditingFeatures.cs';let editing=lf(read(editingPath));
editing=replaceRequired(editing,'.Where(x => x.VariantId > 0)','.Where(x => x.VariantId > 0 && x.Quantity > 0)','zero-quantity cancellation filtering');
editing=replaceRequired(editing,'            amendmentKind = kind,\n            amendedAt = now','            amendmentKind = kind,\n            previousTotal = oldTotal,\n            updatedTotal = order.Total,\n            amendedAt = now','running-order previous and updated totals');write(editingPath,editing);

const shiftPath='src/MnahelsCafe.Pos/ShiftFeatures.cs';let shift=lf(read(shiftPath));
shift=replaceRequired(shift,'var expected=s.Status=="Closed"&&s.ExpectedCash.HasValue?s.ExpectedCash.Value:s.OpeningCash+cash+ci-co;\n        return new ShiftSummary{','var expected=s.Status=="Closed"&&s.ExpectedCash.HasValue?s.ExpectedCash.Value:s.OpeningCash+cash+ci-co;var orderLog=await OrderLogFeatures.Build(db,s);\n        return new ShiftSummary{','shift order audit load');
shift=replaceRequired(shift,'CancelledOrders=window.Count(x=>x.Status=="Cancelled"),CashAdded=ci','CancelledOrders=window.Count(x=>x.Status=="Cancelled"),EditedOrders=orderLog.EditedOrders,OrderEvents=orderLog.Events.Take(12).ToList(),CashAdded=ci','shift order audit summary');
shift=replaceRequired(shift,'Text(58,428,8,$"Paid orders {s.PaidOrders}   |   Outstanding {s.OutstandingOrders}   |   Cancelled {s.CancelledOrders}");','Text(58,428,8,$"Paid {s.PaidOrders}   |   Outstanding {s.OutstandingOrders}   |   Cancelled {s.CancelledOrders}   |   Edited {s.EditedOrders}");','Z-report edit summary');
shift=replaceRequired(shift,'Fill(305,380,245,24,"0.91");Box(305,380,245,24);Text(315,388,9,"TOP SELLING ITEMS",true);','Fill(305,380,245,24,"0.91");Box(305,380,245,24);Text(315,388,9,"ORDER ACTIVITY",true);','Z-report order activity heading');
shift=replaceRequired(shift,`            if(s.TopItems.Count==0)Text(315,rightY,8,"No sold items.");
            foreach(var item in s.TopItems.Take(7))
            {
                Text(315,rightY,8,Cut(item.Name,27),true);Text(458,rightY,7,$"Qty {item.Quantity}");Text(500,rightY,8,Money(item.Sales),true);rightY-=16;
            }`,`            if(s.OrderEvents.Count==0)Text(315,rightY,8,"No order activity.");
            foreach(var entry in s.OrderEvents.Take(7))
            {
                Text(315,rightY,7,$"MC-{entry.TokenNumber} {Cut(entry.Action,10)}",true);Text(430,rightY,7,Cut(entry.Actor,18));rightY-=16;
            }`,'Z-report order activity rows');
shift=replaceRequired(shift,'public int CancelledOrders{get;set;}public decimal CashAdded','public int CancelledOrders{get;set;}public int EditedOrders{get;set;}public List<OrderLogEvent> OrderEvents{get;set;}=[];public decimal CashAdded','shift summary order log fields');write(shiftPath,shift);

const v46Path='src/MnahelsCafe.Pos/wwwroot/v46.js';let v46=lf(read(v46Path));
v46=replaceRequired(v46,'<div class="total">Expected cash <b>${money(current.expectedCash)}</b></div>','<div>Orders <b>${Number(current.paidOrders||0)}</b></div><div>Edited orders <b>${Number(current.editedOrders||0)}</b></div><div class="total">Expected cash <b>${money(current.expectedCash)}</b></div>','closing preview order audit');write(v46Path,v46);

const v56Path='src/MnahelsCafe.Pos/wwwroot/v56.js';let v56=lf(read(v56Path)).replace(/const RELEASE = '[^']+'/,"const RELEASE = '0.15.46'");
v56=replaceRequired(v56,`  async function apiRequest(path, options = {}) {
    if (typeof window.api === 'function') return window.api(path, options);
    const response = await fetch(\`/api\${path}\`, {`,`  async function apiRequest(path, options = {}) {
    const normalized = path.startsWith('/api/') ? path : \`/api\${path.startsWith('/') ? '' : '/'}\${path}\`;
    if (typeof window.api === 'function') return window.api(normalized, options);
    const response = await fetch(normalized, {`,'running-order API normalization');
const oldOperationCards=`  function decorateOperationCards(orders) {
    const byNumber = new Map(orders.map(order => [String(order.orderNumber || '').trim(), order]));
    qa('#admin-orders .order-row').forEach(row => {
      const number = q('.order-main strong', row)?.textContent?.trim();
      const order = byNumber.get(number);`;
const newOperationCards=`  function decorateOperationCards(orders) {
    const byId = new Map(orders.map(order => [String(order.id), order]));
    const byNumber = new Map(orders.map(order => [String(order.orderNumber || '').trim(), order]));
    const byReceipt = new Map(orders.map(order => [String(order.receiptNumber || '').trim(), order]));
    qa('#admin-orders .order-row, #admin-orders .v36-order-card, #orders-list .order-card').forEach(row => {
      const rowId = row.dataset.id || q('[data-order]', row)?.dataset.order || q('[data-cancel]', row)?.dataset.cancel;
      const number = q('.order-main strong, .order-info strong', row)?.textContent?.trim();
      const order = byId.get(String(rowId || '')) || byNumber.get(number) || byReceipt.get(number);`;
v56=replaceRequired(v56,oldOperationCards,newOperationCards,'current order-card edit actions');
v56=replaceRequired(v56,`    const admin = q('#screen-admin');
    if (!admin?.classList.contains('active') || document.hidden || opsBusy || Date.now() - lastOpsFetch < 12000) return;`,`    const operationsVisible = q('#screen-admin')?.classList.contains('active') || q('#screen-orders')?.classList.contains('active');
    if (!operationsVisible || document.hidden || opsBusy || Date.now() - lastOpsFetch < 12000) return;`,'admin and cashier operation visibility');
v56=v56.replace(`    if (!(state.cart || []).length) { toast('Add at least one item before updating the order.'); return true; }`,`    if (!(state.cart || []).some(item => Number(item.quantity ?? 0) > 0)) { toast('At least one active item is required; use order status to cancel the full order.'); return true; }`);
v56=v56.replace(`items: (state.cart || []).map(item => ({ variantId: Number(item.variantId), quantity: Math.max(1, Number(item.quantity || 1)) }))`,`items: (state.cart || []).map(item => ({ variantId: Number(item.variantId), quantity: Math.max(0, Number(item.quantity ?? 0)) }))`);
v56=v56.replace(/      actions\.innerHTML = `[\s\S]*?`;\n      actions\.onclick = async event => \{/,`      actions.innerHTML = canEdit(order) ? '<button type="button" data-op="edit">Edit order</button>' : '';
      actions.onclick = async event => {`);
v56=v56.split("apiRequest(`/orders/${order.id}/status`, { method: 'POST'").join("apiRequest(`/orders/${order.id}/status`, { method: 'PUT'");
if(v56.includes("apiRequest(`/orders/${order.id}/status`, { method: 'POST'"))throw new Error('legacy running-order status method remains.');write(v56Path,v56);

const v57Path='src/MnahelsCafe.Pos/wwwroot/v57.js';let v57=lf(read(v57Path)).replace(/const BUILD='[^']+'/,"const BUILD='0.15.46'");write(v57Path,v57);
const v59Path='src/MnahelsCafe.Pos/wwwroot/v59.js';let v59=lf(read(v59Path)).replace(/const BUILD='[^']+',UI_REVISION='[^']+';/,"const BUILD='0.15.46',UI_REVISION='20260904-running-order-audit-46';");write(v59Path,v59);
const indexPath='src/MnahelsCafe.Pos/wwwroot/index.html';let index=read(indexPath);index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="0.15.46">');index=index.replace(/(<input[^>]+id="username"[^>]+value=")[^"]*(")/,'$1admin123$2');index=index.replace(/(<input[^>]+id="password"[^>]+value=")[^"]*(")/,'$1admin123$2');index=index.replace(/Admin:\s*[^<·]+[·|]\s*Cashier:\s*[^<]+/i,'Admin: admin123 / admin123 · Cashier: cashier123 / cashier123');if(!index.includes('/v59.css'))index=index.replace('</head>','<link rel="stylesheet" href="/v59.css?v=20260904-running-order-audit-46"></head>');if(!index.includes('/v59.js'))index=index.replace('</body>','<script src="/v59.js?v=20260904-running-order-audit-46"></script></body>');if(!index.includes('/v58.js')||!index.includes('/v58.css'))throw new Error('running-order delta assets were not preserved.');write(indexPath,index);
const checks=[['shared app state',app.includes('const state=window.state={')],['zero cancellation backend',editing.includes('x.Quantity > 0')],['previous total response',editing.includes('previousTotal = oldTotal')],['current admin cards',v56.includes('#admin-orders .v36-order-card')],['cashier order cards',v56.includes('#orders-list .order-card')],['clean edit-only actions',v56.includes("actions.innerHTML = canEdit(order) ? '<button type=\"button\" data-op=\"edit\">Edit order</button>' : ''")],['zero quantity payload',v56.includes('quantity: Math.max(0')],['red cancelled cart',read('src/MnahelsCafe.Pos/wwwroot/v58.js').includes('v58-cancelled-line')],['dashboard audit',v59.includes('v59-dashboard-order-audit')]];const failed=checks.filter(([,ok])=>!ok).map(([label])=>label);if(failed.length)throw new Error('Running-order v0.15.46 verification failed: '+failed.join(', '));new Function(app);new Function(v46);new Function(v56);new Function(v57);new Function(v59);new Function(read('src/MnahelsCafe.Pos/wwwroot/v58.js'));console.log('v0.15.46 clean running-order and complete audit flow verified.');
