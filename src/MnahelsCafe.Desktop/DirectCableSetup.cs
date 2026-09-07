/* Mnahel's Cafe POS - direct Ethernet setup.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology. Existing licensing is unchanged. */
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;

namespace MnahelsCafe.Desktop;

internal sealed class DirectCableSetup : Form
{
    internal const string ServerAddress = "10.77.61.1";
    internal const string CashierAddress = "10.77.61.2";
    private readonly bool _server;
    private readonly ComboBox _adapters = new() { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Top };
    private readonly Label _status = new() { AutoSize = true, MaximumSize = new Size(590, 0), Dock = DockStyle.Fill };
    private readonly Button _apply = new() { Text = "Set up cable and connect", AutoSize = true, MinimumSize = new Size(210, 40) };
    private readonly Button _restore = new() { Text = "Restore previous Ethernet settings", AutoSize = true, MinimumSize = new Size(280, 40) };
    private readonly Button _close = new() { Text = "Close", AutoSize = true, MinimumSize = new Size(90, 40) };
    private bool _busy;
    private bool _configured;
    internal ConnectionConfig? SavedConnection { get; private set; }
    private sealed record Adapter(string Id, string Name, string Detail) { public override string ToString() => Name + " — " + Detail; }

    internal DirectCableSetup(bool server)
    {
        _server = server;
        Text = "Mnahel's Cafe POS — Direct cable, no router";
        StartPosition = FormStartPosition.CenterParent;
        ClientSize = new Size(650, 460);
        MinimumSize = new Size(620, 460);
        BackColor = Color.FromArgb(24, 23, 21);
        ForeColor = Color.FromArgb(232, 226, 214);
        Font = new Font("Segoe UI", 10F);
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(22), ColumnCount = 1, RowCount = 7, AutoScroll = true };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.Controls.Add(new Label { Text = server ? "This laptop: ADMIN / SERVER" : "This laptop: CASHIER", AutoSize = true, ForeColor = Color.FromArgb(238, 189, 47), Font = new Font("Segoe UI", 14F, FontStyle.Bold), Margin = new Padding(0, 0, 0, 14) });
        layout.Controls.Add(new Label { Text = "Connect both laptops with one LAN cable. No router is required.\nServer: 10.77.61.1     Cashier: 10.77.61.2     Mask: 255.255.255.0\nOnly the selected Ethernet adapter will change. Wi-Fi is left alone.", AutoSize = true, MaximumSize = new Size(590, 0), Margin = new Padding(0, 0, 0, 16) });
        layout.Controls.Add(new Label { Text = "Cable-connected Ethernet adapter:", AutoSize = true });
        layout.Controls.Add(_adapters);
        _status.Text = "Choose the cable adapter. Windows administrator approval is required for first-time network setup.";
        _status.Margin = new Padding(0, 16, 0, 16);
        layout.Controls.Add(_status);
        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, WrapContents = true };
        actions.Controls.AddRange(new Control[] { _apply, _restore, _close });
        layout.Controls.Add(actions);
        layout.Controls.Add(new Label { Text = "A product by Eastern Cross Technology", AutoSize = true, ForeColor = Color.FromArgb(176, 168, 152), Margin = new Padding(0, 14, 0, 0) });
        Controls.Add(layout);
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up || !Guid.TryParse(nic.Id, out _)) continue;
            if (nic.NetworkInterfaceType is not (NetworkInterfaceType.Ethernet or NetworkInterfaceType.GigabitEthernet or NetworkInterfaceType.FastEthernetFx or NetworkInterfaceType.FastEthernetT)) continue;
            var addresses = string.Join(", ", nic.GetIPProperties().UnicastAddresses.Where(x => x.Address.AddressFamily == AddressFamily.InterNetwork).Select(x => x.Address.ToString()));
            _adapters.Items.Add(new Adapter(nic.Id, nic.Name, string.IsNullOrEmpty(addresses) ? "waiting for IPv4" : addresses));
        }
        if (_adapters.Items.Count == 1) _adapters.SelectedIndex = 0;
        if (_adapters.Items.Count == 0) _status.Text = "No connected Ethernet adapter found. Plug in the LAN cable (or USB Ethernet adapter), then reopen this window.";
        _adapters.SelectedIndexChanged += (_, _) => { _configured = false; _apply.Text = "Set up cable and connect"; UpdateButtons(); };
        _apply.Click += async (_, _) => await ApplyAsync();
        _restore.Click += async (_, _) => await RestoreAsync();
        _close.Click += (_, _) => Close();
        FormClosing += (_, e) => { if (_busy) e.Cancel = true; };
        UpdateButtons();
    }

    private void UpdateButtons()
    {
        _apply.Enabled = !_busy && _adapters.SelectedItem is Adapter;
        _restore.Enabled = !_busy && _adapters.SelectedItem is Adapter a && File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "MnahelsCafePOS", "NetworkProfiles", Guid.Parse(a.Id).ToString("D") + ".json"));
        _adapters.Enabled = !_busy;
        _close.Enabled = !_busy;
    }

    private async Task ApplyAsync()
    {
        if (_busy || _adapters.SelectedItem is not Adapter adapter) return;
        if (!_configured && MessageBox.Show(this,
            $"Use {adapter.Name} ONLY for the direct cable between these two laptops?\n\nThis laptop gets {(_server ? ServerAddress : CashierAddress)}/24. Its Ethernet gateway and IPv4 DNS are cleared; Wi-Fi is not changed. Previous Ethernet settings are saved for Restore.\n\n" +
            (_server ? "A TCP 5055 firewall rule is added only for the selected adapter and the other laptop.\n\n" : "") +
            "Do not use this on a shared/corporate Ethernet network. Windows will ask for administrator approval.",
            "Confirm direct-cable network change", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        _busy = true; UpdateButtons();
        try
        {
            if (!_configured)
            {
                _status.Text = "Preparing direct Ethernet… approve the Windows prompt. Do not unplug the cable.";
                if (!await RunNetworkSetupAsync(adapter.Id, _server, false)) { _status.Text = "Network setup did not complete. Check the PowerShell message/network profile log. No POS connection was saved."; return; }
                _configured = true;
            }
            var url = _server ? "http://localhost:5055" : "http://" + ServerAddress + ":5055";
            _status.Text = "Ethernet configured. Checking POS at " + url + "…";
            var reachable = await ServerFinder.IsPosServerAsync(url);
            if (!_server && !reachable)
            {
                _status.Text = "Cable addresses are set, but POS is not reachable yet. Run Direct Cable Setup on the SERVER laptop too and start its POS service. Click Connect again; network settings will not be reapplied.";
                _apply.Text = "Connect to server";
                return;
            }
            var config = new ConnectionConfig { Mode = _server ? "server" : "client", ServerUrl = url };
            config.Save();
            var saved = ConnectionConfig.Load();
            if (saved.IsClient != config.IsClient || !string.Equals(saved.BaseUrl(), config.BaseUrl(), StringComparison.OrdinalIgnoreCase))
                throw new IOException("Connection settings could not be saved. Check folder permissions; network setup remains available through Restore.");
            SavedConnection = config;
            _busy = false;
            DialogResult = DialogResult.OK;
            Close();
        }
        catch (System.ComponentModel.Win32Exception ex) when (ex.NativeErrorCode == 1223) { _status.Text = "Administrator approval was cancelled. No connection was saved."; }
        catch (Exception ex) { _status.Text = "Setup error: " + ex.Message; }
        finally { _busy = false; if (!IsDisposed) UpdateButtons(); }
    }

    private async Task RestoreAsync()
    {
        if (_busy || _adapters.SelectedItem is not Adapter adapter) return;
        if (MessageBox.Show(this, "Restore the saved pre-cable IPv4/DNS settings for " + adapter.Name + "?\nThe direct POS link will stop working. Wi-Fi and POS data are not changed.", "Restore Ethernet", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        _busy = true; UpdateButtons();
        try
        {
            var ok = await RunNetworkSetupAsync(adapter.Id, _server, true);
            _configured = false; _apply.Text = "Set up cable and connect";
            _status.Text = ok ? "Previous Ethernet settings restored. Use Connection setup for the server on your normal network." : "Restore failed or no saved profile exists. Check the network profile log; use Ethernet IPv4 properties for manual recovery.";
        }
        catch (Exception ex) { _status.Text = "Restore was not completed: " + ex.Message; }
        finally { _busy = false; if (!IsDisposed) UpdateButtons(); }
    }

    internal static string BuildScript(string adapterId, bool server, bool restore)
    {
        var guid = Guid.Parse(adapterId).ToString("D");
        var exe = Path.Combine(AppContext.BaseDirectory, "MnahelsCafe.Pos.exe").Replace("'", "''");
        return NetworkScript.Replace("__GUID__", guid).Replace("__IP__", server ? ServerAddress : CashierAddress)
            .Replace("__SERVER__", server ? "$true" : "$false").Replace("__RESTORE__", restore ? "$true" : "$false").Replace("__SERVER_EXE__", exe);
    }

    private static async Task<bool> RunNetworkSetupAsync(string id, bool server, bool restore)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Direct Ethernet setup requires Windows.");
        var encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(BuildScript(id, server, restore)));
        var start = new ProcessStartInfo("powershell.exe", "-NoProfile -EncodedCommand " + encoded) { UseShellExecute = true, Verb = "runas" };
        using var process = Process.Start(start) ?? throw new IOException("Windows network setup could not start.");
        await process.WaitForExitAsync();
        return process.ExitCode == 0;
    }

    internal const string NetworkScript = """
$ErrorActionPreference='Stop'
$id=[Guid]'__GUID__'; $ip='__IP__'; $server=__SERVER__; $restore=__RESTORE__
$folder=Join-Path $env:ProgramData 'MnahelsCafePOS\NetworkProfiles'
$file=Join-Path $folder ($id.ToString()+'.json')
$log=Join-Path $folder ($id.ToString()+'-last-result.txt')
$rule='MnahelsPOS-DirectCable-'+$id.ToString()
$changed=$false; $snapshot=$null
function Read-Profile($idx) {
  $reg='HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\{'+$id.ToString()+'}'
  return [pscustomobject]@{InterfaceGuid=$id.ToString();SavedAt=[DateTime]::UtcNow.ToString('o');Dhcp=[string](Get-NetIPInterface -InterfaceIndex $idx -AddressFamily IPv4).Dhcp;Addresses=@(Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 | Select-Object IPAddress,PrefixLength);Gateways=@(Get-NetRoute -InterfaceIndex $idx -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object NextHop,RouteMetric);Dns=@((Get-DnsClientServerAddress -InterfaceIndex $idx -AddressFamily IPv4).ServerAddresses);DnsAutomatic=[string]::IsNullOrWhiteSpace((Get-ItemProperty $reg -Name NameServer -ErrorAction SilentlyContinue).NameServer)}
}
function IPv4-Number([string]$address) {
  $b=([Net.IPAddress]::Parse($address)).GetAddressBytes()
  return [uint64]$b[0]*16777216+[uint64]$b[1]*65536+[uint64]$b[2]*256+[uint64]$b[3]
}
function Restore-Profile($profile,$idx) {
  if ([Guid]$profile.InterfaceGuid -ne $id) { throw 'Saved profile belongs to another adapter.' }
  foreach($a in @($profile.Addresses)) { $parsed=$null; if(-not [Net.IPAddress]::TryParse([string]$a.IPAddress,[ref]$parsed) -or $parsed.AddressFamily -ne 'InterNetwork' -or [int]$a.PrefixLength -lt 1 -or [int]$a.PrefixLength -gt 32){throw 'Invalid saved IPv4 profile.'} }
  foreach($r in @($profile.Gateways)) { $parsed=$null; if(-not [Net.IPAddress]::TryParse([string]$r.NextHop,[ref]$parsed) -or $parsed.AddressFamily -ne 'InterNetwork'){throw 'Invalid saved gateway.'} }
  foreach($d in @($profile.Dns)) { $parsed=$null; if(-not [Net.IPAddress]::TryParse([string]$d,[ref]$parsed) -or $parsed.AddressFamily -ne 'InterNetwork'){throw 'Invalid saved DNS address.'} }
  Set-NetIPInterface -InterfaceIndex $idx -AddressFamily IPv4 -Dhcp Disabled
  Get-NetRoute -InterfaceIndex $idx -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Remove-NetRoute -Confirm:$false
  Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false
  if($profile.Dhcp -eq 'Enabled') { Set-NetIPInterface -InterfaceIndex $idx -AddressFamily IPv4 -Dhcp Enabled }
  else {
    foreach($a in @($profile.Addresses)) { New-NetIPAddress -InterfaceIndex $idx -IPAddress $a.IPAddress -PrefixLength ([int]$a.PrefixLength) | Out-Null }
    foreach($r in @($profile.Gateways)) { New-NetRoute -InterfaceIndex $idx -DestinationPrefix '0.0.0.0/0' -NextHop $r.NextHop -RouteMetric ([int]$r.RouteMetric) | Out-Null }
  }
  $dns=Get-DnsClientServerAddress -InterfaceIndex $idx -AddressFamily IPv4
  if($profile.DnsAutomatic -or @($profile.Dns).Count -eq 0) { $dns | Set-DnsClientServerAddress -ResetServerAddresses }
  else { $dns | Set-DnsClientServerAddress -ServerAddresses @($profile.Dns) }
}
try {
  $adapter=Get-NetAdapter -IncludeHidden | Where-Object { $_.InterfaceGuid -eq $id } | Select-Object -First 1
  if(-not $adapter -or -not $adapter.HardwareInterface -or $adapter.PhysicalMediaType -notin @(0,14)) { throw 'Select a physical Ethernet adapter, not Wi-Fi/VPN/virtual networking.' }
  $idx=$adapter.ifIndex
  if(-not $restore -and $adapter.Status -ne 'Up') { throw 'Ethernet cable is disconnected.' }
  if(Test-Path $folder) { if((Get-Item $folder).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Network profile folder must not be a link.'} }
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  $acl=New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @('S-1-5-18','S-1-5-32-544')) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow')) }
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow'))
  Set-Acl -Path $folder -AclObject $acl
  if((Test-Path $file) -and ((Get-Item $file).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Network profile file must not be a link.'}
  if($restore) {
    if(-not (Test-Path $file)){throw 'No previous Ethernet profile exists for this adapter.'}
    $previous=Get-Content $file -Raw | ConvertFrom-Json
    $snapshot=Read-Profile $idx; $changed=$true
    Restore-Profile $previous $idx
    Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Move-Item $file ($file+'.restored-'+[DateTime]::UtcNow.Ticks)
    'Previous Ethernet profile restored.' | Set-Content $log
    exit 0
  }
  foreach($a in @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceIndex -ne $idx})) {
    if($a.IPAddress -like '10.77.61.*'){throw '10.77.61.x is already used by another adapter. Use manual setup with an unused subnet.'}
  }
  foreach($r in @(Get-NetRoute -AddressFamily IPv4 | Where-Object {$_.InterfaceIndex -ne $idx -and $_.DestinationPrefix -ne '0.0.0.0/0'})) {
    $parts=$r.DestinationPrefix.Split('/'); $bits=[int]$parts[1]
    if($bits -ge 1 -and $bits -le 32) {
      $mask=[uint64]([math]::Pow(2,32)-[math]::Pow(2,32-$bits))
      if(((IPv4-Number $ip) -band $mask) -eq ((IPv4-Number $parts[0]) -band $mask)){throw 'Another adapter/VPN already routes this direct-cable subnet. Choose an unused subnet manually.'}
    }
  }
  if($server -and -not (Test-Path '__SERVER_EXE__')){throw 'POS server executable is missing; install the Server role first.'}
  $snapshot=Read-Profile $idx
  if(-not (Test-Path $file)) { $snapshot | ConvertTo-Json -Depth 5 | Set-Content $file -Encoding UTF8 }
  $changed=$true
  Set-NetIPInterface -InterfaceIndex $idx -AddressFamily IPv4 -Dhcp Disabled
  Get-NetRoute -InterfaceIndex $idx -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Remove-NetRoute -Confirm:$false
  Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false
  New-NetIPAddress -InterfaceIndex $idx -IPAddress $ip -PrefixLength 24 | Out-Null
  Get-DnsClientServerAddress -InterfaceIndex $idx -AddressFamily IPv4 | Set-DnsClientServerAddress -ResetServerAddresses
  Start-Sleep -Seconds 2
  $assigned=Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 | Where-Object {$_.IPAddress -eq $ip}
  if(-not $assigned -or $assigned.AddressState -ne 'Preferred'){throw 'Direct-cable address is not ready, or an IP conflict was detected.'}
  if($server) {
    if(-not (Test-Path '__SERVER_EXE__')){throw 'POS server executable is missing; install the Server role first.'}
    Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -Name $rule -DisplayName "Mnahels POS direct cable ($($adapter.Name))" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5055 -LocalAddress '10.77.61.1' -RemoteAddress '10.77.61.2' -InterfaceAlias $adapter.Name -Program '__SERVER_EXE__' -Profile Any | Out-Null
  }
  "Direct Ethernet configured: $ip/24. Wi-Fi unchanged. Previous profile: $file" | Set-Content $log
  exit 0
} catch {
  $message=$_.Exception.Message
  if($changed -and $snapshot) { try { Restore-Profile $snapshot $idx; $message+=' Previous IPv4 settings restored.' } catch { $message+=' Automatic recovery failed: '+$_.Exception.Message } }
  Write-Error $message -ErrorAction Continue
  if(Test-Path $folder) { try {$message | Set-Content $log} catch {} }
  exit 1
}
""";
}
