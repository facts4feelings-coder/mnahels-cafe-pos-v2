const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');
const replaceOnce = (s, oldText, newText) => s.includes(oldText) ? s.replace(oldText, newText) : s;

const v45Path = 'src/MnahelsCafe.Pos/wwwroot/v45.js';
let v45 = read(v45Path);
if (!v45.includes('v41-credit')) {
  const pattern = /const footer=q\('\.tp-foot',receipt\);if\(footer\)\{.*?y=fy\+copy\.length\*10\}/s;
  const replacement = "const footer=q('.tp-foot',receipt);if(footer){c.setLineDash([4,3]);c.lineWidth=1;c.beginPath();c.moveTo(bodyX,y+.5);c.lineTo(bodyX+bodyW,y+.5);c.stroke();c.setLineDash([]);p.font(12.5,950);const thanks=p.wrap(textOf(footer,'strong','THANK YOU'),bodyW);p.drawLines(thanks,bodyX+bodyW/2,y+5,13,'center');let fy=y+7+thanks.length*13;p.font(8.4,850);const copy=p.wrap(textOf(footer,':scope > span','we love to serve you again!'),bodyW);p.drawLines(copy,bodyX+bodyW/2,fy,10,'center');fy+=copy.length*10+4;p.font(6.2,800);const credit=p.wrap(textOf(footer,'b','A product by eastern cross technology'),bodyW);p.drawLines(credit,bodyX+bodyW/2,fy,8,'center');fy+=credit.length*8;p.font(6,800);const web=p.wrap(textOf(footer,'small','www.easterncrosstech.com'),bodyW);p.drawLines(web,bodyX+bodyW/2,fy,8,'center');y=fy+web.length*8/*v41-credit*/}";
  v45 = v45.replace(pattern, replacement);
  v45 = replaceOnce(v45, "p.font(6.5,800);p.drawLines(['A product by Eastern Cross Technology'],width/2,y,8,'center');return p.crop(y+14);", "p.font(12.5,950);p.drawLines(['THANK YOU'],width/2,y,13,'center');y+=15;p.font(8.4,850);p.drawLines(['we love to serve you again!'],width/2,y,10,'center');y+=12;p.font(6.2,800);p.drawLines(['A product by eastern cross technology','www.easterncrosstech.com'],width/2,y,8,'center');return p.crop(y+20);");
}
if (!v45.includes('v42-address')) {
  v45 = replaceOnce(v45, "c.fillStyle=blackHeader?'#000':'#fff';c.fillRect(0,0,width,90);c.strokeStyle='#000';c.lineWidth=blackHeader?0:2;if(!blackHeader)c.strokeRect(1,1,width-2,88);", "c.fillStyle=blackHeader?'#000':'#fff';c.fillRect(0,0,width,110);c.strokeStyle='#000';c.lineWidth=blackHeader?0:2;if(!blackHeader)c.strokeRect(1,1,width-2,108);");
  v45 = replaceOnce(v45, "const brand=textOf(receipt,'.v43-brand b',\"MNAHEL'S CAFE\"),sub=textOf(receipt,'.v43-brand small','THE WORLD OF TASTE'),mode=", "const brand=textOf(receipt,'.v43-brand b',\"MNAHEL'S CAFE\"),sub=textOf(receipt,'.v43-brand small','THE WORLD OF TASTE'),address=textOf(receipt,'.v57-address','Ada  25/85 Gaggoo Mandi, Lahore Road'),mode=");
  v45 = replaceOnce(v45, 'const brandSize=Math.min(18.5,Math.max(15,width/18));', 'const brandSize=Math.min(20,Math.max(16,width/17));');
  v45 = replaceOnce(v45, "p.font(8.2,900);p.drawLines([sub],width/2,37,9,'center');", "p.font(9.2,900);p.drawLines([sub],width/2,37,10,'center');p.font(8.2,900);p.drawLines([address],width/2,49,9,'center');/*v42-address*/");
  v45 = replaceOnce(v45, "drawModeIcon(c,modeKey,8,58,25,headInk);c.fillStyle=headInk;p.font(10.8,950);c.fillText(mode,39,64);", "drawModeIcon(c,modeKey,8,78,25,headInk);c.fillStyle=headInk;p.font(10.8,950);c.fillText(mode,39,84);");
  v45 = replaceOnce(v45, 'const sealW=102,sealH=31,sealX=width-sealW-8,sealY=54;', 'const sealW=102,sealH=31,sealX=width-sealW-8,sealY=74;');
  v45 = replaceOnce(v45, "p.font(11.2,950);p.drawLines(p.wrap(seal,sealW-10),sealX+sealW/2,sealY+5,11,'center');", "p.font(10,950);p.drawLines(p.wrap(seal,sealW-10),sealX+sealW/2,sealY+5,10,'center');");
  v45 = replaceOnce(v45, "c.fillStyle='#000';y=96;", "c.fillStyle='#000';y=116;");
}
write(v45Path, v45);

const v56Path = 'src/MnahelsCafe.Pos/wwwroot/v56.js';
let v56 = read(v56Path).replace(/const RELEASE = '[^']+'/, "const RELEASE = '0.15.42'").replace(/const LOGO_URL = '[^']+'/, "const LOGO_URL = '/assets/brand/mnahels-logo.b64?v=20260904-hd-original-42'");
write(v56Path, v56);

const indexPath = 'src/MnahelsCafe.Pos/wwwroot/index.html';
let index = read(indexPath).replace(/<meta name="application-version" content="[^"]+">/, '<meta name="application-version" content="0.15.42">');
if (!index.includes('/v57.css')) index = index.replace('</head>', '<link rel="stylesheet" href="/v57.css?v=20260904-order-start-receipt-42"></head>');
if (!index.includes('/v57.js')) index = index.replace('</body>', '<script src="/v57.js?v=20260904-order-start-receipt-42"></script></body>');
write(indexPath, index);

const programPath = 'src/MnahelsCafe.Pos/Program.cs';
let program = read(programPath);
program = replaceOnce(program, 'SchemaUpgrade.Apply(db);SeedData.Apply(db);', 'SchemaUpgrade.Apply(db);SeedData.Apply(db);V42MenuMigration.Apply(db);');
if (!program.includes('V42MenuMigration.Apply(db);')) throw new Error('V42 menu migration startup hook was not installed.');
write(programPath, program);
