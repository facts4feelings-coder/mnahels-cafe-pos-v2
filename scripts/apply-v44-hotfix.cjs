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

const v56Path='src/MnahelsCafe.Pos/wwwroot/v56.js';
let v56=read(v56Path).replace(/const RELEASE = '[^']+'/,"const RELEASE = '0.15.44'");
write(v56Path,v56);
const v57Path='src/MnahelsCafe.Pos/wwwroot/v57.js';
let v57=read(v57Path).replace(/const BUILD='[^']+'/,"const BUILD='0.15.44'");
write(v57Path,v57);

const indexPath='src/MnahelsCafe.Pos/wwwroot/index.html';
let index=read(indexPath);
index=index.replace(/<meta name="application-version" content="[^"]+">/,'<meta name="application-version" content="0.15.44">');
index=index.replace(/(<input[^>]+id="username"[^>]+value=")[^"]*(")/,'$1admin123$2');
index=index.replace(/(<input[^>]+id="password"[^>]+value=")[^"]*(")/,'$1admin123$2');
index=index.replace(/Admin:\s*[^<·]+[·|]\s*Cashier:\s*[^<]+/i,'Admin: admin123 / admin123 · Cashier: cashier123 / cashier123');
if(!index.includes('/v59.css'))index=index.replace('</head>','<link rel="stylesheet" href="/v59.css?v=20260904-order-audit-brand-print-44"></head>');
if(!index.includes('/v59.js'))index=index.replace('</body>','<script src="/v59.js?v=20260904-order-audit-brand-print-44"></script></body>');
if(!index.includes('/v59.js')||!index.includes('/v59.css'))throw new Error('v0.15.44 UI assets were not installed.');
write(indexPath,index);