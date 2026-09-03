/*
 * Mnahel's Cafe POS · v0.15.39 desktop release label
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */
using System.Runtime.CompilerServices;

namespace MnahelsCafe.Desktop;

internal static class ReleaseDisplayVersion
{
    private const string Previous = "v0.15.34";
    private const string Current = "v0.15.39";

    [ModuleInitializer]
    internal static void Initialize()
    {
        Application.Idle += RefreshOpenWindows;
    }

    private static void RefreshOpenWindows(object? sender, EventArgs args)
    {
        var updated = false;
        foreach (Form form in Application.OpenForms)
        {
            updated |= RefreshControls(form.Controls);
        }
        if (updated) Application.Idle -= RefreshOpenWindows;
    }

    private static bool RefreshControls(Control.ControlCollection controls)
    {
        var updated = false;
        foreach (Control control in controls)
        {
            if (!string.IsNullOrEmpty(control.Text) && control.Text.Contains(Previous, StringComparison.Ordinal))
            {
                control.Text = control.Text.Replace(Previous, Current, StringComparison.Ordinal);
                updated = true;
            }
            if (control.HasChildren) updated |= RefreshControls(control.Controls);
        }
        return updated;
    }
}
