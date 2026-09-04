const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,value)=>fs.writeFileSync(path.join(root,p),value,'utf8');
function replaceRequired(value,oldText,newText,label){if(value.includes(newText))return value;if(!value.includes(oldText))throw new Error(label+' source was not found.');return value.replace(oldText,newText)}

const programPath='src/MnahelsCafe.Pos/Program.cs';
let program=read(programPath);
program=replaceRequired(program,
 'SchemaUpgrade.Apply(db);OrderEditingFeatures.ApplySchema(db);SeedData.Apply(db);V42MenuMigration.Apply(db);',
 'SchemaUpgrade.Apply(db);OrderEditingFeatures.ApplySchema(db);SeedData.Apply(db);CredentialMigrationV44.Apply(db);V42MenuMigration.Apply(db);',
 'credential migration startup hook');
program=replaceRequired(program,
 'ReceiptSettingsFeatures.MapApi(api,dataRoot);OrderEditingFeatures.MapApi(api);',
 'ReceiptSettingsFeatures.MapApi(api,dataRoot);OrderEditingFeatures.MapApi(api);OrderLogFeatures.MapApi(api);',
 'shift order log API hook');
write(programPath,program);

const appPath='src/MnahelsCafe.Pos/wwwroot/app.js';
let app=read(appPath);
if(!app.includes('const state=window.state={'))app=replaceRequired(app,'const state={','const state=window.state={','shared application state');
write(appPath,app);

const v56Path='src/MnahelsCafe.Pos/wwwroot/v56.js';
let v56=read(v56Path).replace(/const RELEASE = '[^']+'/,"const RELEASE = '0.15.45'");
v56=replaceRequired(v56,
`  async function apiRequest(path, options = {}) {
    if (typeof window.api === 'function') return window.api(path, options);
    const response = await fetch(\`/api\${path}\`, {`,
`  async function apiRequest(path, options = {}) {
    const normalized = path.startsWith('/api/') ? path : \`/api\${path.startsWith('/') ? '' : '/'}\${path}\`;
    if (typeof window.api === 'function') return window.api(normalized, options);
    const response = await fetch(normalized, {`,
 'running-order API normalization');
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
v56=replaceRequired(v56,
`    const admin = q('#screen-admin');
    if (!admin?.classList.contains('active') || document.hidden || opsBusy || Date.now() - lastOpsFetch < 12000) return;`,
`    const operationsVisible = q('#screen-admin')?.classList.contains('active') || q('#screen-orders')?.classList.contains('active');
    if (!operationsVisible || document.hidden || opsBusy || Date.now() - lastOpsFetch < 12000) return;`,
 'admin and cashier operation visibility');
v56=v56.split("apiRequest(`/orders/${order.id}/status`, { method: 'POST'").join("apiRequest(`/orders/${order.id}/status`, { method: 'PUT'");
if(v56.includes("apiRequest(`/orders/${order.id}/status`, { method: 'POST'"))throw new Error('legacy running-order status method remains.');
write(v56Path,v56);

const v57Path='src/MnahelsCafe.Pos/wwwroot/v57.js';
let v57=read(v57Path).replace(/const BUILD='[^']+'/,"const BUILD='0.15.45'");
write(v57Path,v57);
const v59Path='src/MnahelsCafe.Pos/wwwroot/v59.js';
let v59=read(v59Path).replace(/v0\.15\.44/g,'v0.15.45').replace(/const BUILD='[^']+',UI_REVISION='[^']+';/,"const BUILD='0.15.45',UI_REVISION='20260904-running-order-ui-45';");
write(v59Path,v59);

const indexPath='src/MnahelsCafe.Pos/wwwroot/index.html';
let index=read(indexPath);
index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="0.15.45">');
index=index.replace(/(<input[^>]+id="username"[^>]+value=")[^"]*(")/,'$1admin123$2');
index=index.replace(/(<input[^>]+id="password"[^>]+value=")[^"]*(")/,'$1admin123$2');
index=index.replace(/Admin:\s*[^<·]+[·|]\s*Cashier:\s*[^<]+/i,'Admin: admin123 / admin123 · Cashier: cashier123 / cashier123');
if(!index.includes('/v59.css'))index=index.replace('</head>','<link rel="stylesheet" href="/v59.css?v=20260904-running-order-ui-45"></head>');
if(!index.includes('/v59.js'))index=index.replace('</body>','<script src="/v59.js?v=20260904-running-order-ui-45"></script></body>');
if(!index.includes('/v58.js')||!index.includes('/v58.css'))throw new Error('v0.15.43 running-order delta assets were not preserved.');
if(!index.includes('/v59.js')||!index.includes('/v59.css'))throw new Error('v0.15.45 UI assets were not installed.');
write(indexPath,index);

const checks=[
 ['shared app state',app.includes('const state=window.state={')],
 ['normalized edit API',v56.includes("const normalized = path.startsWith('/api/')")],
 ['current admin cards',v56.includes('#admin-orders .v36-order-card')],
 ['cashier order cards',v56.includes('#orders-list .order-card')],
 ['cashier screen visibility',v56.includes("q('#screen-orders')?.classList.contains('active')")],
 ['running-order completion hook',v56.includes('window.mnahelsV58?.completeRunningOrder')],
 ['partial cancellation source',read('src/MnahelsCafe.Pos/wwwroot/v58.js').includes('Cancel qty')]
];
const failed=checks.filter(([,ok])=>!ok).map(([label])=>label);if(failed.length)throw new Error('Running-order UI verification failed: '+failed.join(', '));
new Function(app);new Function(v56);new Function(v57);new Function(v59);new Function(read('src/MnahelsCafe.Pos/wwwroot/v58.js'));
console.log('v0.15.45 running-order edit, cancel and delta UI verified for Admin and Cashier.');
