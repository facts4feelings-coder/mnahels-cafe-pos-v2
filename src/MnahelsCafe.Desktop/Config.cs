/*
 * ============================================================================
 *  Mnahel's Cafe POS · Desktop shell — PROPRIETARY SOFTWARE. DO NOT MODIFY.
 *  Owner    : TechMint Software Solutions · https://techmint.org
 *  Copyright: (c) 2026 TechMint Software Solutions. All rights reserved.
 * ============================================================================
 */

using System.Collections.Concurrent;
using System.Drawing.Printing;
using System.Globalization;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;

namespace MnahelsCafe.Desktop;

internal sealed class ConnectionConfig
{
    public string Mode { get; set; } = "server";

    public string ServerUrl { get; set; } = "http://localhost:5055";

    public bool IsClient => string.Equals(Mode, "client", StringComparison.OrdinalIgnoreCase);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public static string PrimaryPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "MnahelsCafePOS",
        "connection.json");

    public static string FallbackPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MnahelsCafePOS",
        "connection.json");

    public static bool Exists() => File.Exists(PrimaryPath) || File.Exists(FallbackPath);

    public static ConnectionConfig Load()
    {
        foreach (var path in new[] { PrimaryPath, FallbackPath })
        {
            try
            {
                if (!File.Exists(path)) continue;
                var parsed = JsonSerializer.Deserialize<ConnectionConfig>(File.ReadAllText(path), JsonOptions);
                if (parsed is not null) return parsed;
            }
            catch
            {
            }
        }
        return new ConnectionConfig();
    }

    public void Save()
    {
        var json = JsonSerializer.Serialize(this, JsonOptions);
        foreach (var path in new[] { PrimaryPath, FallbackPath })
        {
            try
            {
                var folder = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(folder)) Directory.CreateDirectory(folder);
                File.WriteAllText(path, json);
                return;
            }
            catch
            {
            }
        }
    }

    public string BaseUrl() => IsClient ? Normalize(ServerUrl) : "http://localhost:5055";

    public static string Normalize(string? value)
    {
        var text = (value ?? string.Empty).Trim();
        if (text.Length == 0) return "http://localhost:5055";
        if (!text.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !text.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            text = "http://" + text;
        }
        text = text.TrimEnd('/');
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri)) return "http://localhost:5055";
        var port = uri.IsDefaultPort ? 5055 : uri.Port;
        return $"{uri.Scheme}://{uri.Host}:{port}";
    }
}

internal sealed class PrinterConfig
{
    public bool Silent { get; set; } = true;

    public string CustomerPrinter { get; set; } = string.Empty;

    public string KitchenPrinter { get; set; } = string.Empty;

    // Mnahel's printer uses an 80mm thermal roll.
    public double PaperWidthMm { get; set; } = 80;

    public bool AutoLength { get; set; } = true;

    public double FixedLengthMm { get; set; } = 160;

    // 0.15.0: receipt seedha printer ki apni zaban (ESC/POS text) me Windows
    // spooler ke zariye jati hai. Na page size, na CSS, na browser printing.
    public bool RawTextPrint { get; set; } = true;

    // Use the installed printer's 80mm roll definition for reliable HTML printing.
    public bool UseDriverPaper { get; set; } = true;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public static string PrimaryPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "MnahelsCafePOS",
        "printers.json");

    public static string FallbackPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MnahelsCafePOS",
        "printers.json");

    public static PrinterConfig Load()
    {
        foreach (var path in new[] { PrimaryPath, FallbackPath })
        {
            try
            {
                if (!File.Exists(path)) continue;
                var parsed = JsonSerializer.Deserialize<PrinterConfig>(File.ReadAllText(path), JsonOptions);
                if (parsed is not null) return parsed;
            }
            catch
            {
            }
        }
        return new PrinterConfig();
    }

    public void Save()
    {
        var json = JsonSerializer.Serialize(this, JsonOptions);
        foreach (var path in new[] { PrimaryPath, FallbackPath })
        {
            try
            {
                var folder = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(folder)) Directory.CreateDirectory(folder);
                File.WriteAllText(path, json);
                return;
            }
            catch
            {
            }
        }
    }

    public string PrinterFor(string type) => string.Equals(type, "kitchen", StringComparison.OrdinalIgnoreCase)
        ? (string.IsNullOrWhiteSpace(KitchenPrinter) ? CustomerPrinter : KitchenPrinter)
        : CustomerPrinter;

    public static List<string> InstalledPrinters()
    {
        var names = new List<string>();
        try
        {
            foreach (var item in PrinterSettings.InstalledPrinters)
            {
                var name = item as string;
                if (!string.IsNullOrWhiteSpace(name)) names.Add(name);
            }
        }
        catch
        {
        }
        return names;
    }

    public static void Log(string message)
    {
        foreach (var folder in new[]
                 {
                     Path.GetDirectoryName(PrimaryPath),
                     Path.GetDirectoryName(FallbackPath)
                 })
        {
            try
            {
                if (string.IsNullOrEmpty(folder)) continue;
                Directory.CreateDirectory(folder);
                File.AppendAllText(
                    Path.Combine(folder, "print-log.txt"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) + "  " + message + Environment.NewLine);
                return;
            }
            catch
            {
            }
        }
    }
}

internal static class ServerFinder
{
    private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromMilliseconds(900) };

    public static async Task<bool> IsPosServerAsync(string baseUrl)
    {
        try
        {
            using var response = await Client.GetAsync(
                baseUrl.TrimEnd('/') + "/api/health",
                HttpCompletionOption.ResponseHeadersRead);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public static List<string> LocalSubnets()
    {
        var prefixes = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (adapter.OperationalStatus != OperationalStatus.Up) continue;
            if (adapter.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            foreach (var unicast in adapter.GetIPProperties().UnicastAddresses)
            {
                if (unicast.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                var parts = unicast.Address.ToString().Split('.');
                if (parts.Length != 4) continue;
                if (parts[0] == "127") continue;
                var prefix = parts[0] + "." + parts[1] + "." + parts[2];
                if (seen.Add(prefix)) prefixes.Add(prefix);
            }
        }
        if (!seen.Contains("192.168.50")) prefixes.Add("192.168.50");
        return prefixes;
    }

    public static async Task<List<string>> ScanAsync()
    {
        var found = new ConcurrentBag<string>();
        var gate = new SemaphoreSlim(64);
        var tasks = new List<Task>();
        foreach (var prefix in LocalSubnets())
        {
            for (var host = 1; host <= 254; host++)
            {
                var url = "http://" + prefix + "." + host + ":5055";
                tasks.Add(Task.Run(async () =>
                {
                    await gate.WaitAsync();
                    try
                    {
                        if (await IsPosServerAsync(url)) found.Add(url);
                    }
                    finally
                    {
                        gate.Release();
                    }
                }));
            }
        }
        await Task.WhenAll(tasks);
        gate.Dispose();
        return found.Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
