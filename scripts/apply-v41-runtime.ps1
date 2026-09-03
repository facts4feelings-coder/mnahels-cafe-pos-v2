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
  [IO.File]::WriteAllText($v45Path, $updated)
}
$v56Path = Join-Path $root 'src\MnahelsCafe.Pos\wwwroot\v56.js'
$v56 = [IO.File]::ReadAllText($v56Path).Replace("const RELEASE = '0.15.39'", "const RELEASE = '0.15.41'")
[IO.File]::WriteAllText($v56Path, $v56)
