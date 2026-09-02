/*
 * ============================================================================
 *  Mnahel's Cafe POS · Desktop shell — PROPRIETARY SOFTWARE. DO NOT MODIFY.
 *  Owner    : Eastern Cross Technology · https://techmint.org
 *  Copyright: (c) 2026 Eastern Cross Technology. All rights reserved.
 * ============================================================================
 *  Direct thermal printing: receipt Windows spooler ko RAW (ESC/POS) bytes ke
 *  taur par jati hai. Is raste me page size, margins ya browser printing ka
 *  koi dakhal nahi hota, is liye khali kagaz wala masla khatam ho jata hai.
 * ============================================================================
 */

using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Text;

namespace MnahelsCafe.Desktop;

internal static class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DocInfo
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string DocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string? OutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string DataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinter(string printerName, out IntPtr handle, IntPtr defaults);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr handle);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool StartDocPrinter(IntPtr handle, int level, ref DocInfo info);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr handle);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr handle);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr handle);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr handle, IntPtr bytes, int count, out int written);

    public static string DefaultPrinterName()
    {
        try
        {
            var settings = new PrinterSettings();
            return settings.PrinterName ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    public static bool Send(string printerName, byte[] payload, string documentName, out string error)
    {
        error = string.Empty;
        var target = string.IsNullOrWhiteSpace(printerName) ? DefaultPrinterName() : printerName;
        if (string.IsNullOrWhiteSpace(target))
        {
            error = "Windows par koi default printer set nahi hai";
            return false;
        }

        var handle = IntPtr.Zero;
        var buffer = IntPtr.Zero;
        var docStarted = false;
        try
        {
            if (!OpenPrinter(target, out handle, IntPtr.Zero) || handle == IntPtr.Zero)
            {
                error = "printer open nahi hua (" + target + ") win32=" + Marshal.GetLastWin32Error();
                return false;
            }

            var info = new DocInfo
            {
                DocName = documentName,
                OutputFile = null,
                DataType = "RAW"
            };

            if (!StartDocPrinter(handle, 1, ref info))
            {
                error = "spooler ne RAW job qubool nahi kiya win32=" + Marshal.GetLastWin32Error();
                return false;
            }
            docStarted = true;

            if (!StartPagePrinter(handle))
            {
                error = "start page fail win32=" + Marshal.GetLastWin32Error();
                return false;
            }

            buffer = Marshal.AllocCoTaskMem(payload.Length);
            Marshal.Copy(payload, 0, buffer, payload.Length);
            var ok = WritePrinter(handle, buffer, payload.Length, out var written);
            EndPagePrinter(handle);

            if (!ok)
            {
                error = "write fail win32=" + Marshal.GetLastWin32Error();
                return false;
            }
            if (written != payload.Length)
            {
                error = "write adhoora raha (" + written + "/" + payload.Length + ")";
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
        finally
        {
            if (buffer != IntPtr.Zero) Marshal.FreeCoTaskMem(buffer);
            if (handle != IntPtr.Zero)
            {
                try
                {
                    if (docStarted) EndDocPrinter(handle);
                }
                catch
                {
                }
                ClosePrinter(handle);
            }
        }
    }
}

/// <summary>
/// Plain text ko thermal printer ke ESC/POS bytes me badalta hai.
/// Line ke shuru me style marker lagta hai:
///   \u0001 = center + double width + double height + bold  (cafe name, token)
///   \u0002 = center
///   \u0003 = bold
///   \u0004 = center + bold
///   \u0005 = double height + bold                          (kitchen item, grand total)
///   \u0006 = center + double height + bold
///   \u0007 = underline
///   \u0008 = center + bold + reverse black band             (receipt header)
/// </summary>
internal static class EscPos
{
    public static int ColumnsFor(double widthMm)
    {
        var width = widthMm <= 0 ? 70 : widthMm;
        var columns = (int)Math.Round(width / 80.0 * 48.0);
        return Math.Clamp(columns, 24, 48);
    }

    public static byte[] Build(string text, int feedLines = 4, bool cut = true)
    {
        var bytes = new List<byte>(text.Length + 256);
        bytes.AddRange(new byte[] { 0x1B, 0x40 });        // reset
        bytes.AddRange(new byte[] { 0x1B, 0x74, 0x00 });  // code page 437
        bytes.AddRange(new byte[] { 0x1B, 0x61, 0x00 });  // left align

        foreach (var source in text.Replace("\r\n", "\n").Split('\n'))
        {
            var line = source;
            var center = false;
            var bold = false;
            var wide = false;
            var tall = false;
            var underline = false;
            var reverse = false;

            if (line.Length > 0)
            {
                switch (line[0])
                {
                    case '\u0001':
                        center = true; bold = true; wide = true; tall = true;
                        break;
                    case '\u0002':
                        center = true;
                        break;
                    case '\u0003':
                        bold = true;
                        break;
                    case '\u0004':
                        center = true; bold = true;
                        break;
                    case '\u0005':
                        bold = true; tall = true;
                        break;
                    case '\u0006':
                        center = true; bold = true; tall = true;
                        break;
                    case '\u0007':
                        underline = true; bold = true;
                        break;
                    case '\u0008':
                        center = true; bold = true; reverse = true;
                        break;
                }
                if (line[0] >= '\u0001' && line[0] <= '\u0008') line = line.Substring(1);
            }

            if (center) bytes.AddRange(new byte[] { 0x1B, 0x61, 0x01 });
            if (wide || tall)
            {
                var size = (byte)((wide ? 0x10 : 0x00) | (tall ? 0x01 : 0x00));
                bytes.AddRange(new byte[] { 0x1D, 0x21, size });
            }
            if (bold) bytes.AddRange(new byte[] { 0x1B, 0x45, 0x01 });
            if (underline) bytes.AddRange(new byte[] { 0x1B, 0x2D, 0x01 });
            if (reverse) bytes.AddRange(new byte[] { 0x1D, 0x42, 0x01 });

            bytes.AddRange(Encoding.ASCII.GetBytes(Ascii(line)));
            bytes.Add(0x0A);

            if (reverse) bytes.AddRange(new byte[] { 0x1D, 0x42, 0x00 });
            if (underline) bytes.AddRange(new byte[] { 0x1B, 0x2D, 0x00 });
            if (bold) bytes.AddRange(new byte[] { 0x1B, 0x45, 0x00 });
            if (wide || tall) bytes.AddRange(new byte[] { 0x1D, 0x21, 0x00 });
            if (center) bytes.AddRange(new byte[] { 0x1B, 0x61, 0x00 });
        }

        for (var i = 0; i < feedLines; i++) bytes.Add(0x0A);
        if (cut) bytes.AddRange(new byte[] { 0x1D, 0x56, 0x42, 0x00 }); // feed + partial cut
        return bytes.ToArray();
    }

    public static string Ascii(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var symbol in value)
        {
            switch (symbol)
            {
                case '\u00b7':
                case '\u2022':
                case '\u25cf':
                case '\u2013':
                case '\u2014':
                case '\u2015':
                    builder.Append('-');
                    break;
                case '\u2018':
                case '\u2019':
                case '\u02bc':
                    builder.Append('\'');
                    break;
                case '\u201c':
                case '\u201d':
                    builder.Append('"');
                    break;
                case '\u2026':
                    builder.Append("...");
                    break;
                case '\u00d7':
                    builder.Append('x');
                    break;
                case '\u20a8':
                case '\u20b9':
                    builder.Append("Rs");
                    break;
                case '\u00a0':
                case '\t':
                    builder.Append(' ');
                    break;
                default:
                    if (symbol < 32) break;
                    builder.Append(symbol < 127 ? symbol : ' ');
                    break;
            }
        }
        return builder.ToString();
    }

    public static string StripMarkers(string text)
    {
        var builder = new StringBuilder(text.Length);
        foreach (var symbol in text)
        {
            if (symbol >= '\u0001' && symbol <= '\u0008') continue;
            builder.Append(symbol);
        }
        return builder.ToString();
    }
}

/// <summary>
/// #print-sheet ko khoobsurat thermal parchi me badalne wala script.
/// Har hissa apni asal shakal ke mutabiq chhapta hai: cafe ka naam bara aur
/// darmiyan me, headings bold, kitchen ke items double height, grand total
/// numaya. Text nodes bhi parhe jate hain (pehle item ke naam gum ho rahe the).
/// </summary>
internal static class ReceiptText
{
    private const string Template = @"(function(){
var COLS = __COLS__;
var HALF = Math.floor(COLS/2);
var sheet = document.querySelector('#print-sheet');
if(!sheet) return '';
var out = [];
function clean(t){ return (t||'').replace(/\s+/g,' ').trim(); }
function rep(ch,n){ var r=''; for(var i=0;i<n;i++){ r+=ch; } return r; }
function has(el,name){ return (' '+(el.getAttribute('class')||'')+' ').indexOf(' '+name+' ')>=0; }
function tail(){ return out.length? out[out.length-1] : ''; }
function dash(ch){ var l=rep(ch,COLS); if(tail()===l) return; out.push(l); }
function blank(){ if(tail()!=='') out.push(''); }
function wrap(t,w){
  if(w<8){ w=8; }
  var words=t.split(' '), lines=[], line='';
  for(var i=0;i<words.length;i++){
    var word=words[i];
    while(word.length>w){ if(line){ lines.push(line); line=''; } lines.push(word.substring(0,w)); word=word.substring(w); }
    if(!word){ continue; }
    if(!line){ line=word; }
    else if((line+' '+word).length<=w){ line=line+' '+word; }
    else { lines.push(line); line=word; }
  }
  if(line){ lines.push(line); }
  return lines;
}
function block(marker,text,w,indent){
  var t=clean(text);
  if(!t){ return; }
  var pad=indent||'';
  var lines=wrap(t, pad? (w-pad.length) : w);
  for(var i=0;i<lines.length;i++){ out.push(marker + (i?pad:'') + lines[i]); }
}
function row(marker,left,right,w){
  var l=clean(left), r=clean(right);
  if(!r){ block(marker,l,w,''); return; }
  if(!l){ out.push(marker+rep(' ',Math.max(0,w-r.length))+r); return; }
  if(l.length+r.length+1<=w){ out.push(marker+l+rep(' ',w-l.length-r.length)+r); return; }
  var lines=wrap(l, Math.max(8, w-r.length-1));
  var end=lines.pop();
  for(var i=0;i<lines.length;i++){ out.push(marker+lines[i]); }
  var gap=w-end.length-r.length;
  if(gap<1){ gap=1; }
  out.push(marker+end+rep(' ',gap)+r);
}
function nodes(el){
  var res=[], n=el.childNodes;
  for(var i=0;i<n.length;i++){
    var node=n[i];
    if(node.nodeType===3){ var a=clean(node.nodeValue); if(a){ res.push(a); } }
    else if(node.nodeType===1){
      if(node.tagName==='BR'){ continue; }
      var b=clean(node.textContent);
      if(b){ res.push(b); }
    }
  }
  return res;
}
function deep(el){
  for(var i=0;i<el.children.length;i++){ if(el.children[i].children.length>0){ return true; } }
  return false;
}
function join(list,upto){
  var s='';
  for(var i=0;i<upto;i++){ if(list[i]){ s = s? s+'  '+list[i] : list[i]; } }
  return s;
}
var totals = sheet.querySelectorAll('.tp-total');
var grand = totals.length? totals[totals.length-1] : null;
var kitchen = !!sheet.querySelector('.tp-kitchen') || !!sheet.querySelector('.tp-kitem') ||
              (' '+(sheet.getAttribute('class')||'')+' ').indexOf(' kitchen ')>=0;
function render(el){
  if(el.tagName==='HR'||has(el,'tp-dash')){ dash('-'); return; }
  var text=clean(el.textContent);
  if(has(el,'v43-dark-head')){
    var brand=el.querySelector('.v43-brand b'), title=el.querySelector('.v43-mode small'), mode=el.querySelector('.v43-mode b'), seal=el.querySelector('.v43-seal strong');
    block('\u0008',brand?brand.textContent:'MNAHEL\'S CAFE',COLS,'');
    if(title){ block('\u0008',title.textContent,COLS,''); }
    if(mode){ block('\u0008',mode.textContent,COLS,''); }
    if(seal){ block('\u0006','*** '+clean(seal.textContent)+' ***',COLS,''); }
    dash('=');
    return;
  }
  if(has(el,'tp-head')){
    var hp=nodes(el);
    if(hp.length===0){ block('\u0001',text,HALF,''); }
    else {
      for(var i=0;i<hp.length;i++){
        if(i===0){ block('\u0001',hp[i],HALF,''); }
        else { block('\u0002',hp[i],COLS,''); }
      }
    }
    dash('=');
    return;
  }
  if(has(el,'tp-token')){ blank(); block('\u0001',text,HALF,''); blank(); return; }
  if(has(el,'tp-kitem')){ block('\u0005',text,COLS,'     '); return; }
  if(has(el,'v43-meta-grid')){
    dash('=');
    for(var m=0;m<el.children.length;m++){
      var cell=el.children[m], label=cell.querySelector('span'), value=cell.querySelector('b');
      row('',label?label.textContent:'',value?value.textContent:'',COLS);
    }
    dash('=');
    return;
  }
  if(has(el,'v43-item-row')){
    var qty=el.querySelector('.v43-qty'), name=el.querySelector('.v43-item-name b'), detail=el.querySelector('.v43-item-name small'), amount=el.querySelector(':scope > strong');
    row('',(qty?clean(qty.textContent)+'x ':'')+(name?clean(name.textContent):''),amount?amount.textContent:'',COLS);
    if(detail){ block('',clean(detail.textContent),COLS,'   '); }
    dash('-');
    return;
  }
  if(has(el,'v43-note')){ return; }
  if(has(el,'v43-due-warning')){
    dash('!'); block('\u0006','PAYMENT DUE',COLS,''); block('\u0004','NOT A PAID RECEIPT',COLS,''); dash('!'); return;
  }
  if(has(el,'tp-th')){
    var tp=nodes(el);
    if(kitchen || tp.length<2){ block('\u0007',(tp.length?join(tp,tp.length):text).toUpperCase(),COLS,''); }
    else { row('\u0007',join(tp,tp.length-1).toUpperCase(),tp[tp.length-1].toUpperCase(),COLS); }
    return;
  }
  if(has(el,'tp-foot')||has(el,'tp-saved')||has(el,'tp-empty')){
    var fp=nodes(el);
    if(fp.length<=1){ block('\u0002',text,COLS,''); return; }
    for(var j=0;j<fp.length;j++){ block('\u0002',fp[j],COLS,''); }
    return;
  }
  if(has(el,'tp-note')){ return; }
  if(has(el,'tp-addr')){ if(text){ block('',text,COLS,'      '); } return; }
  if(deep(el)){
    for(var k=0;k<el.children.length;k++){ render(el.children[k]); }
    return;
  }
  var parts=nodes(el);
  var marker = (el===grand) ? '\u0005' : (has(el,'tp-total') ? '\u0003' : '');
  if(parts.length>=2){ row(marker, join(parts,parts.length-1), parts[parts.length-1], COLS); }
  else if(text){ block(marker,text,COLS,''); }
  else { blank(); }
}
var root = sheet.querySelector('.tp') || sheet;
if(root.children.length===0){ block('\u0002',clean(root.textContent),COLS,''); }
else { for(var i=0;i<root.children.length;i++){ render(root.children[i]); } }
var text=out.join('\n');
text=text.replace(/[ ]+$/gm,'');
text=text.replace(/\n{3,}/g,'\n\n');
return text.replace(/^\n+/,'').replace(/\n+$/,'');
})()";

    public static string Script(int columns) =>
        Template.Replace("__COLS__", columns.ToString(System.Globalization.CultureInfo.InvariantCulture));
}
