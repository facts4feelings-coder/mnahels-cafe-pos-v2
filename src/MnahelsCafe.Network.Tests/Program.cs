using System.Reflection;
using System.Text;

// Contract tests only. Never launch the elevated setup or modify CI networking.
var type = Assembly.Load("MnahelsCafe.Desktop").GetType("MnahelsCafe.Desktop.DirectCableSetup", true)!;
var build = type.GetMethod("BuildScript", BindingFlags.Static | BindingFlags.NonPublic)!;
var id = "11111111-2222-3333-4444-555555555555";
Directory.CreateDirectory("reports/direct-cable");
foreach (var server in new[] { true, false })
foreach (var restore in new[] { true, false })
{
    var text = (string)build.Invoke(null, new object[] { id, server, restore })!;
    void Require(bool value, string message) { if (!value) throw new Exception(message); }
    Require(text.Contains(server ? "$ip='10.77.61.1'" : "$ip='10.77.61.2'"), "Role-specific address mismatch");
    Require(text.Contains(restore ? "$restore=$true" : "$restore=$false"), "Restore flag mismatch");
    Require(!text.Contains("__GUID__") && !text.Contains("__SERVER_EXE__"), "Unresolved script token");
    Require(text.Contains("-LocalAddress '10.77.61.1' -RemoteAddress '10.77.61.2' -InterfaceAlias $adapter.Name"), "Firewall must stay restricted to the cable peer/interface");
    Require(text.Contains("HardwareInterface") && text.Contains("PhysicalMediaType"), "Physical-adapter guard missing");
    Require(text.Contains("Restore-Profile $snapshot $idx"), "Rollback missing");
    Require(text.Contains("$snapshot=Read-Profile $idx") && text.Contains("if(-not (Test-Path $file))"), "Original profile protection missing");
    Require(text.Contains("InterfaceGuid -ne $id") && text.Contains("another adapter/VPN", StringComparison.OrdinalIgnoreCase), "Identity/subnet guard missing");
    Require(Convert.ToBase64String(Encoding.Unicode.GetBytes(text)).Length < 30000, "Encoded command exceeds safe Windows argument budget");
    File.WriteAllText($"reports/direct-cable/{(server ? "server" : "cashier")}-{(restore ? "restore" : "apply")}.ps1", text);
}
try { build.Invoke(null, new object[] { "x'; unexpected-command; '", true, false }); throw new Exception("Invalid adapter ID was accepted"); }
catch (TargetInvocationException ex) when (ex.InnerException is FormatException) { }
Console.WriteLine("PASS: actual compiled script builder, role/restore variants, GUID rejection, interface/peer scope and command size. No network operations executed.");
