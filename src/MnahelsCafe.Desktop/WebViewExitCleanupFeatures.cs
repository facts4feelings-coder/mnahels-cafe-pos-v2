using System.Diagnostics;
using System.Runtime.CompilerServices;
using Microsoft.Web.WebView2.WinForms;

namespace MnahelsCafe.Desktop;

internal static class WebViewExitCleanupFeatures
{
    private static readonly HashSet<Form> AttachedForms = new();

    [ModuleInitializer]
    internal static void Initialize()
    {
        Application.Idle += AttachToOpenForms;
    }

    private static void AttachToOpenForms(object? sender, EventArgs e)
    {
        foreach (Form form in Application.OpenForms)
        {
            if (!AttachedForms.Add(form)) continue;
            form.FormClosing += (_, _) => CloseOwnedWebViews(form);
            form.FormClosed += (_, _) => AttachedForms.Remove(form);
        }
    }

    private static void CloseOwnedWebViews(Control root)
    {
        foreach (var browser in Descendants(root).OfType<WebView2>().ToArray())
        {
            var browserProcessId = 0;
            try { browserProcessId = browser.CoreWebView2?.Environment.BrowserProcessId ?? 0; } catch { }
            try { browser.CoreWebView2?.Stop(); } catch { }
            try { browser.Dispose(); } catch { }
            if (browserProcessId <= 0) continue;
            try
            {
                using var process = Process.GetProcessById(browserProcessId);
                if (!process.WaitForExit(700)) process.Kill(entireProcessTree: true);
            }
            catch { }
        }
    }

    private static IEnumerable<Control> Descendants(Control root)
    {
        foreach (Control child in root.Controls)
        {
            yield return child;
            foreach (var nested in Descendants(child)) yield return nested;
        }
    }
}
