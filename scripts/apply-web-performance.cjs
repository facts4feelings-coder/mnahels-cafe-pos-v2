const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');const file=path.join(root,'src/MnahelsCafe.Pos/wwwroot/v56.js');let s=fs.readFileSync(file,'utf8');
const oldObserver="new MutationObserver(() => scheduleBoot()).observe(document.body, { childList: true, subtree: true });";
const newObserver="const operationsRoot = q('#admin-orders'); if (operationsRoot) new MutationObserver(() => scheduleBoot(180)).observe(operationsRoot, { childList: true });";
s=s.replace(oldObserver,newObserver);
s=s.replace("window.setInterval(() => { if (!document.hidden) scheduleBoot(20); }, 10000);","window.addEventListener('focus', () => scheduleBoot(30));");
if(s.includes('observe(document.body, { childList: true, subtree: true })')||s.includes('scheduleBoot(20); }, 10000'))throw new Error('Continuous v56 DOM polling was not removed.');
fs.writeFileSync(file,s,'utf8');
