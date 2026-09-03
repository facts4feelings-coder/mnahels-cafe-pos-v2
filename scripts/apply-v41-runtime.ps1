$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$v45Path = Join-Path $root 'src\MnahelsCafe.Pos\wwwroot\v45.js'
$v45 = [IO.File]::ReadAllText($v45Path)
if ($v45 -notmatch 'v41-credit') {
  $pattern = "const footer=q\('\.tp-foot',receipt\);if\(footer\)\{.*?y=fy\+copy\.length\*10\}"
  $replacement = @'
const footer=q('.tp-foot',receipt);if(footer){c.setLineDash([4,3]);c.lineWidth=1;c.beginPath();c.moveTo(bodyX,y+.5);c.lineTo(bodyX+bodyW,y+.5);c.stroke();c.setLineDash([]);p.font(12.5,950);const thanks=p.wrap(textOf(footer,'strong','THANK YOU'),bodyW);p.drawLines(thanks,bodyX+bodyW/2,y+5,13,'center');let fy=y+7+thanks.length*13;p.font(8.4,850);const copy=p.wrap(textOf(footer,':scope > span','we love to serve you again!'),bodyW);p.drawLines(copy,bodyX+bodyW/2,fy,10,'center');fy+=copy.length*10+4;p.font(6.2,800);const credit=p.wrap(textOf(footer,'b','A product by eastern cross technology'),bodyW);p.drawLines(credit,bodyX+bodyW/2,fy,8,'center');fy+=credit.length*8;p.font(6,800);const web=p.wrap(textOf(footer,'small','www.easterncrosstech.com'),bodyW);p.drawLines(web,bodyX+bodyW/2,fy,8,'center');y=fy+web.length*8/*v41-credit*/}
'@
  $updated = [regex]::Replace($v45, $pattern, $replacement, [Text.RegularExpressions.RegexOptions]::Singleline)
  if ($updated -eq $v45) { throw 'v45 customer footer patch did not match.' }
  $updated = $updated.Replace("p.font(6.5,800);p.drawLines(['A product by Eastern Cross Technology'],width/2,y,8,'center');return p.crop(y+14);", "p.font(12.5,950);p.drawLines(['THANK YOU'],width/2,y,13,'center');y+=15;p.font(8.4,850);p.drawLines(['we love to serve you again!'],width/2,y,10,'center');y+=12;p.font(6.2,800);p.drawLines(['A product by eastern cross technology','www.easterncrosstech.com'],width/2,y,8,'center');return p.crop(y+20);")
  $v45 = $updated
}
if ($v45 -notmatch 'v42-address') {
  $v45 = $v45.Replace("c.fillStyle=blackHeader?'#000':'#fff';c.fillRect(0,0,width,90);c.strokeStyle='#000';c.lineWidth=blackHeader?0:2;if(!blackHeader)c.strokeRect(1,1,width-2,88);", "c.fillStyle=blackHeader?'#000':'#fff';c.fillRect(0,0,width,110);c.strokeStyle='#000';c.lineWidth=blackHeader?0:2;if(!blackHeader)c.strokeRect(1,1,width-2,108);")
  $v45 = $v45.Replace("const brand=textOf(receipt,'.v43-brand b',\"MNAHEL'S CAFE\"),sub=textOf(receipt,'.v43-brand small','THE WORLD OF TASTE'),mode=", "const brand=textOf(receipt,'.v43-brand b',\"MNAHEL'S CAFE\"),sub=textOf(receipt,'.v43-brand small','THE WORLD OF TASTE'),address=textOf(receipt,'.v57-address','Ada  25/85 Gaggoo Mandi, Lahore Road'),mode=")
  $v45 = $v45.Replace("const brandSize=Math.min(18.5,Math.max(15,width/18));", "const brandSize=Math.min(20,Math.max(16,width/17));")
  $v45 = $v45.Replace("p.font(8.2,900);p.drawLines([sub],width/2,37,9,'center');", "p.font(9.2,900);p.drawLines([sub],width/2,37,10,'center');p.font(8.2,900);p.drawLines([address],width/2,49,9,'center');/*v42-address*/")
  $v45 = $v45.Replace("drawModeIcon(c,modeKey,8,58,25,headInk);c.fillStyle=headInk;p.font(10.8,950);c.fillText(mode,39,64);", "drawModeIcon(c,modeKey,8,78,25,headInk);c.fillStyle=headInk;p.font(10.8,950);c.fillText(mode,39,84);")
  $v45 = $v45.Replace("const sealW=102,sealH=31,sealX=width-sealW-8,sealY=54;", "const sealW=102,sealH=31,sealX=width-sealW-8,sealY=74;")
  $v45 = $v45.Replace("p.font(11.2,950);p.drawLines(p.wrap(seal,sealW-10),sealX+sealW/2,sealY+5,11,'center');", "p.font(10,950);p.drawLines(p.wrap(seal,sealW-10),sealX+sealW/2,sealY+5,10,'center');")
  $v45 = $v45.Replace("c.fillStyle='#000';y=96;", "c.fillStyle='#000';y=116;")
}
[IO.File]::WriteAllText($v45Path, $v45)
$v56Path = Join-Path $root 'src\MnahelsCafe.Pos\wwwroot\v56.js'
$v56 = [IO.File]::ReadAllText($v56Path)
$v56 = [regex]::Replace($v56, "const RELEASE = '[^']+'", "const RELEASE = '0.15.42'", 1)
$v56 = [regex]::Replace($v56, "const LOGO_URL = '[^']+'", "const LOGO_URL = '/assets/brand/mnahels-logo.b64?v=20260904-hd-original-42'", 1)
[IO.File]::WriteAllText($v56Path, $v56)
$seedPath = Join-Path $root 'src\MnahelsCafe.Pos\SeedData.cs'
$seed = [IO.File]::ReadAllText($seedPath)
if ($seed -notmatch 'V42MenuMigration\.Apply') {
  $seed = [regex]::Replace($seed, 'db\.SaveChanges\(\);\r?\n    \}\r?\n\r?\n    static void SyncHotDrinksV41', "db.SaveChanges();`r`n        V42MenuMigration.Apply(db);`r`n    }`r`n`r`n    static void SyncHotDrinksV41", 1)
  if ($seed -notmatch 'V42MenuMigration\.Apply') { throw 'Coffee & Tea migration hook did not match.' }
  [IO.File]::WriteAllText($seedPath, $seed)
}
$indexPath = Join-Path $root 'src\MnahelsCafe.Pos\wwwroot\index.html'
$index = [IO.File]::ReadAllText($indexPath)
$index = [regex]::Replace($index, '<meta name="application-version" content="[^"]+">', '<meta name="application-version" content="0.15.42">', 1)
if ($index -notmatch '/v57\.css') { $index = $index.Replace('</head>', '<link rel="stylesheet" href="/v57.css?v=20260904-order-start-receipt-42"></head>') }
if ($index -notmatch '/v57\.js') { $index = $index.Replace('</body>', '<script src="/v57.js?v=20260904-order-start-receipt-42"></script></body>') }
[IO.File]::WriteAllText($indexPath, $index)
