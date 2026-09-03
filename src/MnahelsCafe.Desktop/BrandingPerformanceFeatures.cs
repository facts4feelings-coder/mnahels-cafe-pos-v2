using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.CompilerServices;
using Microsoft.Web.WebView2.WinForms;

namespace MnahelsCafe.Desktop;

internal static class BrandingPerformanceFeatures
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
            Attach(form);
            form.FormClosed += (_, _) => AttachedForms.Remove(form);
        }
    }

    private static void Attach(Form form)
    {
        var browser = Descendants(form).OfType<WebView2>().FirstOrDefault();
        var oldSplash = Descendants(form)
            .FirstOrDefault(control => control is Panel && control.Text.StartsWith("Preparing", StringComparison.OrdinalIgnoreCase));
        if (browser is null || oldSplash?.Parent is null) return;

        oldSplash.Visible = false;
        var overlay = new SmoothStartupOverlay(browser, oldSplash)
        {
            Dock = DockStyle.Fill,
            Name = "mnahelsSmoothStartup"
        };
        oldSplash.Parent.Controls.Add(overlay);
        overlay.BringToFront();
    }

    private static IEnumerable<Control> Descendants(Control root)
    {
        foreach (Control child in root.Controls)
        {
            yield return child;
            foreach (var nested in Descendants(child)) yield return nested;
        }
    }

    private sealed class SmoothStartupOverlay : Control
    {
        private readonly WebView2 _browser;
        private readonly Control _source;
        private readonly System.Windows.Forms.Timer _timer;
        private readonly Stopwatch _clock = Stopwatch.StartNew();
        private readonly Image? _logo;
        private readonly Font _titleFont = new("Segoe UI Semibold", 25f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _taglineFont = new("Segoe UI", 10f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _statusFont = new("Segoe UI", 10f, FontStyle.Regular, GraphicsUnit.Point);
        private readonly StringFormat _center = new() { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        private readonly SolidBrush _titleBrush = new(Color.White);
        private readonly SolidBrush _goldBrush = new(Color.FromArgb(244, 190, 26));
        private readonly SolidBrush _statusBrush = new(Color.FromArgb(172, 172, 172));
        private long? _readyAt;

        internal SmoothStartupOverlay(WebView2 browser, Control source)
        {
            _browser = browser;
            _source = source;
            _logo = LoadApplicationLogo();
            DoubleBuffered = true;
            BackColor = Color.FromArgb(10, 10, 10);
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            _timer = new System.Windows.Forms.Timer { Interval = 24 };
            _timer.Tick += OnFrame;
            _timer.Start();
        }

        private static Image? LoadApplicationLogo()
        {
            try
            {
                using var icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                return icon?.ToBitmap();
            }
            catch { return null; }
        }

        private void OnFrame(object? sender, EventArgs e)
        {
            if (_browser.Visible)
            {
                _readyAt ??= _clock.ElapsedMilliseconds;
                if (_clock.ElapsedMilliseconds - _readyAt >= 180)
                {
                    _timer.Stop();
                    Visible = false;
                    return;
                }
            }
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;

            var enter = Math.Clamp(_clock.Elapsed.TotalMilliseconds / 760d, 0d, 1d);
            var eased = 1d - Math.Pow(1d - enter, 3d);
            var fade = _readyAt is null ? 1d : 1d - Math.Clamp((_clock.ElapsedMilliseconds - _readyAt.Value) / 180d, 0d, 1d);
            var alpha = (float)(eased * fade);
            var offset = (float)((1d - eased) * 14d);
            var logoSize = Math.Min(176, Math.Max(124, Height / 3));
            var logoX = (Width - logoSize) / 2;
            var logoY = Math.Max(34, (Height - 360) / 2) + (int)offset;

            if (_logo is not null)
            {
                using var attributes = new ImageAttributes();
                attributes.SetColorMatrix(new ColorMatrix { Matrix00 = 1, Matrix11 = 1, Matrix22 = 1, Matrix33 = alpha, Matrix44 = 1 });
                g.DrawImage(_logo, new Rectangle(logoX, logoY, logoSize, logoSize), 0, 0, _logo.Width, _logo.Height, GraphicsUnit.Pixel, attributes);
            }

            _titleBrush.Color = Color.FromArgb((int)(255 * alpha), 255, 255, 255);
            _goldBrush.Color = Color.FromArgb((int)(255 * alpha), 244, 190, 26);
            _statusBrush.Color = Color.FromArgb((int)(230 * alpha), 172, 172, 172);
            var titleY = logoY + logoSize + 17;
            g.DrawString("Mnahel's Cafe POS", _titleFont, _titleBrush, new RectangleF(24, titleY, Width - 48, 44), _center);
            g.DrawString("THE WORLD OF TASTE", _taglineFont, _goldBrush, new RectangleF(24, titleY + 42, Width - 48, 22), _center);

            var status = _source.Text;
            if (string.IsNullOrWhiteSpace(status) || status.StartsWith("Preparing", StringComparison.OrdinalIgnoreCase))
                status = "Preparing your cafe...";
            g.DrawString(status, _statusFont, _statusBrush, new RectangleF(24, titleY + 82, Width - 48, 26), _center);

            var trackWidth = Math.Min(210, Math.Max(120, Width - 80));
            var trackX = (Width - trackWidth) / 2;
            var trackY = titleY + 118;
            using var track = new Pen(Color.FromArgb((int)(70 * alpha), 255, 255, 255), 3f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            using var progress = new Pen(Color.FromArgb((int)(235 * alpha), 244, 190, 26), 3f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            g.DrawLine(track, trackX, trackY, trackX + trackWidth, trackY);
            var pulse = _readyAt is null ? Math.Clamp(_clock.Elapsed.TotalMilliseconds / 1150d, 0d, .92d) : 1d;
            g.DrawLine(progress, trackX, trackY, trackX + (float)(trackWidth * pulse), trackY);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _timer.Stop();
                _timer.Dispose();
                _logo?.Dispose();
                _titleFont.Dispose();
                _taglineFont.Dispose();
                _statusFont.Dispose();
                _center.Dispose();
                _titleBrush.Dispose();
                _goldBrush.Dispose();
                _statusBrush.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
