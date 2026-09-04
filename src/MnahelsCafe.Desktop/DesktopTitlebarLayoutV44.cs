/* Mnahel's Cafe POS v0.15.44 · compact left-side title identity layout */
using System.Runtime.CompilerServices;

namespace MnahelsCafe.Desktop;

internal static class DesktopTitlebarLayoutV44
{
    private static readonly HashSet<Form> Attached = [];

    [ModuleInitializer]
    internal static void Initialize() => Application.Idle += Apply;

    private static void Apply(object? sender, EventArgs e)
    {
        foreach (Form form in Application.OpenForms)
        {
            if (!Attached.Add(form)) continue;
            var bar = form.Controls.OfType<Panel>().FirstOrDefault(x => x.Dock == DockStyle.Top && x.Height is >= 44 and <= 48);
            if (bar is null) continue;
            var title = bar.Controls.OfType<Label>().FirstOrDefault(x => x.Text.Contains("Mnahel's Cafe", StringComparison.OrdinalIgnoreCase));
            var chips = bar.Controls.OfType<Panel>().Where(x => x.Height is >= 32 and <= 36 && x.Width is >= 110 and <= 160).OrderBy(x => x.Width).ToList();
            if (title is null || chips.Count < 2) continue;
            var timeChip = chips[0];
            var userChip = chips[^1];
            timeChip.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            userChip.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            timeChip.BackColor = Color.FromArgb(31, 29, 24);
            userChip.BackColor = Color.FromArgb(31, 29, 24);
            void Position()
            {
                const int windowButtons = 144;
                var left = Math.Max(470, title.Right + 8);
                var maximum = Math.Max(470, bar.ClientSize.Width - windowButtons - timeChip.Width - userChip.Width - 20);
                timeChip.Left = Math.Min(left, maximum);
                userChip.Left = timeChip.Right + 8;
                timeChip.Top = userChip.Top = 6;
                timeChip.BringToFront();
                userChip.BringToFront();
            }
            Position();
            bar.SizeChanged += (_, _) => Position();
            form.FormClosed += (_, _) => Attached.Remove(form);
        }
    }
}
