const fs=require('fs'),path=require('path');
const web='src/MnahelsCafe.Pos/wwwroot';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const scripts=fs.readdirSync('scripts').filter(n=>/^apply-.*\.(cjs|ps1)$/.test(n));
for(const p of ['src/MnahelsCafe.Pos/MnahelsCafe.Pos.csproj','src/MnahelsCafe.Desktop/MnahelsCafe.Desktop.csproj']){
 let s=read(p);s=s.replace(/<Exec\b[^>]*scripts[^>]*apply-[^>]*\/>/g,'');
 if(/scripts[^>]*apply-/.test(s))throw Error('Unremoved patch target '+p);fs.writeFileSync(p,s);
}
const audit='src/MnahelsCafe.Audit.Tests/MnahelsCafe.Audit.Tests.csproj';fs.writeFileSync(audit,read(audit).replace(/<Target\b[^>]*Name="PrepareAuditPagination"[^>]*>[\s\S]*?<\/Target>/g,''));
if(read(audit).includes('apply-v60-pdf'))throw Error('Audit target not removed');
for(const n of scripts)fs.unlinkSync('scripts/'+n);
const files=fs.readdirSync(web).filter(n=>/\.(js|css)$/.test(n)).map(n=>{const s=read(web+'/'+n);if(n.endsWith('.js'))new Function(s);return{name:n,bytes:Buffer.byteLength(s),intervals:(s.match(/setInterval\s*\(/g)||[]).length,observers:(s.match(/new MutationObserver/g)||[]).length}});
const report={materializedFrom:'83e449934928edd6ca43a9ff54eff25a188217ad',removedBuildPatchScripts:scripts,files};fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/source-inventory.json',JSON.stringify(report,null,2));
fs.unlinkSync('.github/workflows/materialize-source.yml');fs.unlinkSync('scripts/materialize-source.cjs');
console.log(JSON.stringify({removedPatchScripts:scripts.length,js:files.filter(f=>f.name.endsWith('.js')).length,css:files.filter(f=>f.name.endsWith('.css')).length,observerHotspots:files.filter(f=>f.observers).sort((a,b)=>b.observers-a.observers).slice(0,12)}));
