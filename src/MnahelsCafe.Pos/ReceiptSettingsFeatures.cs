/*
 * Mnahel's Cafe POS · shared receipt print settings
 * Owner: Eastern Cross Technology · https://techmint.org
 * A product by Eastern Cross Technology.
 */
using System.Text.Json;

static class ReceiptSettingsFeatures
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public static void MapApi(RouteGroupBuilder api, string dataRoot)
    {
        var path = Path.Combine(dataRoot, "receipt-settings.json");

        api.MapGet("/receipt-settings", async () =>
        {
            await Gate.WaitAsync();
            try
            {
                return Results.Ok(Load(path));
            }
            finally
            {
                Gate.Release();
            }
        });

        api.MapPut("/receipt-settings", async (ReceiptSettingsUpdate request) =>
        {
            var settings = new ReceiptSettings
            {
                Configured = true,
                WidthMm = Math.Clamp(request.WidthMm, 40, 210),
                SideMarginMm = Math.Clamp(request.SideMarginMm, 0, 8),
                LeftOffsetMm = Math.Clamp(request.LeftOffsetMm, -8, 8),
                FontPx = Math.Clamp(request.FontPx, 8, 15),
                HeaderStyle = string.Equals(request.HeaderStyle, "white", StringComparison.OrdinalIgnoreCase) ? "white" : "black",
                AutoDownloadJpg = request.AutoDownloadJpg,
                UpdatedAt = DateTimeOffset.Now
            };

            await Gate.WaitAsync();
            try
            {
                Save(path, settings);
            }
            finally
            {
                Gate.Release();
            }
            return Results.Ok(settings);
        }).RequireAuthorization(policy => policy.RequireRole("Admin"));
    }

    private static ReceiptSettings Load(string path)
    {
        try
        {
            if (!File.Exists(path)) return new ReceiptSettings();
            var value = JsonSerializer.Deserialize<ReceiptSettings>(File.ReadAllText(path), JsonOptions);
            if (value is null) return new ReceiptSettings();
            value.WidthMm = Math.Clamp(value.WidthMm, 40, 210);
            value.SideMarginMm = Math.Clamp(value.SideMarginMm, 0, 8);
            value.LeftOffsetMm = Math.Clamp(value.LeftOffsetMm, -8, 8);
            value.FontPx = Math.Clamp(value.FontPx, 8, 15);
            value.HeaderStyle = string.Equals(value.HeaderStyle, "white", StringComparison.OrdinalIgnoreCase) ? "white" : "black";
            return value;
        }
        catch
        {
            return new ReceiptSettings();
        }
    }

    private static void Save(string path, ReceiptSettings settings)
    {
        var folder = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(folder)) Directory.CreateDirectory(folder);
        var temp = path + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(settings, JsonOptions));
        File.Move(temp, path, true);
    }

    internal sealed class ReceiptSettings
    {
        public bool Configured { get; set; }
        public double WidthMm { get; set; } = 80;
        public double SideMarginMm { get; set; }
        public double LeftOffsetMm { get; set; } = 1;
        public double FontPx { get; set; } = 12;
        public string HeaderStyle { get; set; } = "black";
        public bool AutoDownloadJpg { get; set; } = true;
        public DateTimeOffset? UpdatedAt { get; set; }
    }

    internal sealed class ReceiptSettingsUpdate
    {
        public double WidthMm { get; set; } = 80;
        public double SideMarginMm { get; set; }
        public double LeftOffsetMm { get; set; } = 1;
        public double FontPx { get; set; } = 12;
        public string? HeaderStyle { get; set; } = "black";
        public bool AutoDownloadJpg { get; set; } = true;
    }
}
