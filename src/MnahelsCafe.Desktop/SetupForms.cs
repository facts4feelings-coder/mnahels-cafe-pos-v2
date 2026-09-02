/*
 * ============================================================================
 *  Mnahel's Cafe POS · Desktop shell — PROPRIETARY SOFTWARE. DO NOT MODIFY.
 *  Owner    : Eastern Cross Technology · https://techmint.org
 *  Copyright: (c) 2026 Eastern Cross Technology. All rights reserved.
 * ============================================================================
 */

using System.Globalization;

namespace MnahelsCafe.Desktop;

internal sealed class SetupForm : Form
{
    private static readonly Color Ink = Color.FromArgb(24, 23, 21);
    private static readonly Color Paper = Color.FromArgb(238, 189, 47);
    private static readonly Color Fore = Color.FromArgb(232, 226, 214);
    private static readonly Color Dim = Color.FromArgb(176, 168, 152);

    private readonly RadioButton _serverRole = new();
    private readonly RadioButton _clientRole = new();
    private readonly TextBox _address = new();
    private readonly Button _test = new();
    private readonly Button _scan = new();
    private readonly ListBox _found = new();
    private readonly Label _status = new();
    private readonly Button _save = new();
    private readonly Button _cancel = new();

    internal ConnectionConfig Result { get; private set; }

    internal SetupForm(ConnectionConfig current)
    {
        Result = current;
        Text = "Mnahel's Cafe POS — connection setup";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(640, 470);
        BackColor = Ink;
        ForeColor = Fore;
        Font = new Font("Segoe UI", 9.75F);

        var heading = new Label
        {
            Text = "Yeh PC kaise chalega?",
            ForeColor = Paper,
            Font = new Font("Segoe UI", 14F, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(24, 20)
        };

        var hint = new Label
        {
            Text = "Ek PC server banta hai (database wahin rehta hai). Baqi PC usi server se connect karte hain,\n" +
                   "is liye dono par ek hi data, ek hi order list aur ek hi token series chalti hai.",
            AutoSize = true,
            ForeColor = Dim,
            Location = new Point(26, 56)
        };

        _serverRole.Text = "Yeh PC SERVER hai (Admin) — database aur POS service yahin chalti hai";
        _serverRole.Location = new Point(24, 108);
        _serverRole.AutoSize = true;
        _serverRole.Checked = !current.IsClient;

        _clientRole.Text = "Yeh PC CASHIER hai — network par maujood server se connect karega";
        _clientRole.Location = new Point(24, 138);
        _clientRole.AutoSize = true;
        _clientRole.Checked = current.IsClient;

        var addressLabel = new Label
        {
            Text = "Server PC ka IP ya naam:",
            AutoSize = true,
            Location = new Point(26, 182)
        };

        _address.Location = new Point(28, 206);
        _address.Width = 280;
        _address.BackColor = Color.FromArgb(38, 36, 32);
        _address.ForeColor = Fore;
        _address.BorderStyle = BorderStyle.FixedSingle;
        _address.Text = current.IsClient && !string.IsNullOrWhiteSpace(current.ServerUrl)
            ? current.ServerUrl
            : "192.168.50.1";

        StyleButton(_test, "Test", new Point(320, 205), 90);
        StyleButton(_scan, "Network scan", new Point(420, 205), 190);

        _found.Location = new Point(28, 248);
        _found.Size = new Size(582, 130);
        _found.BackColor = Color.FromArgb(32, 31, 28);
        _found.ForeColor = Fore;
        _found.BorderStyle = BorderStyle.FixedSingle;

        _status.Location = new Point(26, 388);
        _status.AutoSize = true;
        _status.ForeColor = Dim;
        _status.Text = "Scan karne se network par maujood POS server khud dhoondh liya jata hai.";

        StyleButton(_save, "Save aur POS kholen", new Point(380, 420), 230);
        StyleButton(_cancel, "Cancel", new Point(280, 420), 90);
        _save.BackColor = Paper;
        _save.ForeColor = Ink;
        _save.Font = new Font("Segoe UI", 9.75F, FontStyle.Bold);

        var credit = new Label
        {
            Text = "A product by Eastern Cross Technology",
            AutoSize = true,
            ForeColor = Color.FromArgb(110, 104, 92),
            Location = new Point(26, 425)
        };

        Controls.AddRange(new Control[]
        {
            heading, hint, _serverRole, _clientRole, addressLabel,
            _address, _test, _scan, _found, _status, _save, _cancel, credit
        });

        _serverRole.CheckedChanged += (_, _) => SyncEnabled();
        _clientRole.CheckedChanged += (_, _) => SyncEnabled();
        _found.SelectedIndexChanged += (_, _) =>
        {
            if (_found.SelectedItem is string picked) _address.Text = picked;
        };
        _scan.Click += async (_, _) => await ScanAsync();
        _test.Click += async (_, _) => await TestAsync();
        _save.Click += async (_, _) => await SaveAsync();
        _cancel.Click += (_, _) =>
        {
            DialogResult = DialogResult.Cancel;
            Close();
        };

        SyncEnabled();
    }

    private static void StyleButton(Button button, string caption, Point location, int width)
    {
        button.Text = caption;
        button.Location = location;
        button.Width = width;
        button.Height = 30;
        button.FlatStyle = FlatStyle.Flat;
        button.BackColor = Color.FromArgb(44, 42, 37);
        button.ForeColor = Color.FromArgb(232, 226, 214);
        button.FlatAppearance.BorderSize = 0;
    }

    private void SyncEnabled()
    {
        var client = _clientRole.Checked;
        _address.Enabled = client;
        _test.Enabled = client;
        _scan.Enabled = client;
        _found.Enabled = client;
    }

    private async Task ScanAsync()
    {
        _scan.Enabled = false;
        _status.Text = "Network scan chal raha hai… (10–20 second)";
        _found.Items.Clear();
        var servers = await ServerFinder.ScanAsync();
        foreach (var server in servers) _found.Items.Add(server);
        _status.Text = servers.Count == 0
            ? "Koi server nahi mila. Server PC on ho, app chal rahi ho, aur firewall par port 5055 khula ho."
            : servers.Count + " server mil gaya — list se select karen.";
        if (servers.Count > 0) _found.SelectedIndex = 0;
        _scan.Enabled = true;
    }

    private async Task TestAsync()
    {
        _test.Enabled = false;
        var url = ConnectionConfig.Normalize(_address.Text);
        _status.Text = "Test ho raha hai: " + url;
        var ok = await ServerFinder.IsPosServerAsync(url);
        _status.Text = ok
            ? "Connection kaamyab: " + url
            : "Raabta nahi hua: " + url + " — IP, server app aur firewall check karen.";
        _test.Enabled = true;
    }

    private async Task SaveAsync()
    {
        var config = new ConnectionConfig();
        if (_clientRole.Checked)
        {
            var url = ConnectionConfig.Normalize(_address.Text);
            config.Mode = "client";
            config.ServerUrl = url;
            if (!await ServerFinder.IsPosServerAsync(url))
            {
                var choice = MessageBox.Show(
                    "Is waqt " + url + " se raabta nahi ho raha.\n\nPhir bhi save karna hai?",
                    "Server nahi mila",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);
                if (choice != DialogResult.Yes) return;
            }
        }
        else
        {
            config.Mode = "server";
            config.ServerUrl = "http://localhost:5055";
        }

        config.Save();
        Result = config;
        DialogResult = DialogResult.OK;
        Close();
    }
}

internal sealed class PrinterSetupForm : Form
{
    private const string DefaultChoice = "(Windows ka default printer)";

    private static readonly Color Ink = Color.FromArgb(24, 23, 21);
    private static readonly Color Paper = Color.FromArgb(238, 189, 47);
    private static readonly Color Fore = Color.FromArgb(232, 226, 214);
    private static readonly Color Dim = Color.FromArgb(176, 168, 152);

    private readonly ComboBox _customer = new();
    private readonly ComboBox _kitchen = new();
    private readonly NumericUpDown _width = new();
    private readonly CheckBox _autoLength = new();
    private readonly NumericUpDown _length = new();
    private readonly CheckBox _silent = new();
    private readonly CheckBox _rawText = new();
    private readonly CheckBox _driverPaper = new();
    private readonly Label _status = new();
    private readonly Button _testPrint = new();
    private readonly Button _save = new();
    private readonly Button _cancel = new();

    internal PrinterConfig Result { get; private set; }

    internal PrinterSetupForm(PrinterConfig current)
    {
        Result = current;
        Text = "Mnahel's Cafe POS — printer setup";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(620, 500);
        BackColor = Ink;
        ForeColor = Fore;
        Font = new Font("Segoe UI", 9.75F);

        var heading = new Label
        {
            Text = "Receipt printers",
            ForeColor = Paper,
            Font = new Font("Segoe UI", 14F, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(24, 20)
        };

        var hint = new Label
        {
            Text = "Customer receipt aur kitchen ticket alag alag printers par ja sakti hain.\n" +
                   "Dono ke liye ek hi printer chahiye to kitchen ko default par chhorr den.",
            AutoSize = true,
            ForeColor = Dim,
            Location = new Point(26, 54)
        };

        var printers = PrinterConfig.InstalledPrinters();

        var customerLabel = new Label { Text = "Customer receipt printer:", AutoSize = true, Location = new Point(26, 104) };
        StyleCombo(_customer, new Point(28, 126), printers);
        Select(_customer, current.CustomerPrinter);

        var kitchenLabel = new Label { Text = "Kitchen ticket printer:", AutoSize = true, Location = new Point(26, 168) };
        StyleCombo(_kitchen, new Point(28, 190), printers);
        Select(_kitchen, current.KitchenPrinter);

        var widthLabel = new Label { Text = "Paper width (mm):", AutoSize = true, Location = new Point(26, 236) };
        _width.Location = new Point(160, 232);
        _width.Width = 80;
        _width.Minimum = 40;
        _width.Maximum = 210;
        _width.Value = (decimal)Math.Clamp(current.PaperWidthMm <= 0 ? 80 : current.PaperWidthMm, 40, 210);
        _width.BackColor = Color.FromArgb(38, 36, 32);
        _width.ForeColor = Fore;
        _width.BorderStyle = BorderStyle.FixedSingle;

        _autoLength.Text = "Receipt ki lambai content ke hisaab se (recommended)";
        _autoLength.Location = new Point(28, 268);
        _autoLength.AutoSize = true;
        _autoLength.Checked = current.AutoLength;

        var lengthLabel = new Label { Text = "Fixed lambai (mm):", AutoSize = true, Location = new Point(26, 300) };
        _length.Location = new Point(160, 296);
        _length.Width = 80;
        _length.Minimum = 60;
        _length.Maximum = 400;
        _length.Value = (decimal)Math.Clamp(current.FixedLengthMm <= 0 ? 160 : current.FixedLengthMm, 60, 400);
        _length.BackColor = Color.FromArgb(38, 36, 32);
        _length.ForeColor = Fore;
        _length.BorderStyle = BorderStyle.FixedSingle;

        _silent.Text = "Bina print window seedha print karen (silent print)";
        _silent.Location = new Point(28, 332);
        _silent.AutoSize = true;
        _silent.Checked = current.Silent;

        _rawText.Text = "Seedha text print (ESC/POS) — sab se tez aur reliable [recommended]";
        _rawText.Location = new Point(28, 358);
        _rawText.AutoSize = true;
        _rawText.Checked = current.RawTextPrint;

        _driverPaper.Text = "HTML print me printer ka apna paper size use karen";
        _driverPaper.Location = new Point(28, 384);
        _driverPaper.AutoSize = true;
        _driverPaper.Checked = current.UseDriverPaper;

        _status.Location = new Point(26, 414);
        _status.AutoSize = true;
        _status.ForeColor = Dim;
        _status.Text = printers.Count == 0
            ? "Is PC par koi printer install nahi hai — Windows > Printers & scanners se add karen."
            : printers.Count + " printer mile. Test print se foran check karen.";

        StyleButton(_testPrint, "Test print", new Point(28, 444), 170);
        StyleButton(_save, "Save", new Point(400, 444), 190);
        StyleButton(_cancel, "Cancel", new Point(300, 444), 90);
        _save.BackColor = Paper;
        _save.ForeColor = Ink;
        _save.Font = new Font("Segoe UI", 9.75F, FontStyle.Bold);

        Controls.AddRange(new Control[]
        {
            heading, hint, customerLabel, _customer, kitchenLabel, _kitchen,
            widthLabel, _width, _autoLength, lengthLabel, _length, _silent,
            _rawText, _driverPaper, _status, _testPrint, _save, _cancel
        });

        _autoLength.CheckedChanged += (_, _) => _length.Enabled = !_autoLength.Checked;
        _length.Enabled = !_autoLength.Checked;

        _testPrint.Click += (_, _) => RunTestPrint();

        _save.Click += (_, _) =>
        {
            var config = new PrinterConfig
            {
                CustomerPrinter = Chosen(_customer),
                KitchenPrinter = Chosen(_kitchen),
                PaperWidthMm = (double)_width.Value,
                AutoLength = _autoLength.Checked,
                FixedLengthMm = (double)_length.Value,
                Silent = _silent.Checked,
                RawTextPrint = _rawText.Checked,
                UseDriverPaper = _driverPaper.Checked
            };
            config.Save();
            Result = config;
            DialogResult = DialogResult.OK;
            Close();
        };
        _cancel.Click += (_, _) =>
        {
            DialogResult = DialogResult.Cancel;
            Close();
        };
    }

    private void RunTestPrint()
    {
        _testPrint.Enabled = false;
        try
        {
            var chosen = Chosen(_customer);
            var target = string.IsNullOrWhiteSpace(chosen) ? RawPrinter.DefaultPrinterName() : chosen;
            var columns = EscPos.ColumnsFor((double)_width.Value);
            var dashes = new string('-', columns);
            var lines = new List<string>
            {
                "\u0001MNAHEL'S CAFE",
                "\u0002RAW TEST PRINT",
                dashes,
                "Printer : " + (string.IsNullOrWhiteSpace(target) ? "default" : target),
                "Columns : " + columns + "  (" + ((double)_width.Value).ToString("0", CultureInfo.InvariantCulture) + "mm)",
                "Waqt    : " + DateTime.Now.ToString("dd-MMM-yyyy HH:mm:ss", CultureInfo.InvariantCulture),
                dashes,
                "\u0003Yeh parchi chhap gayi to printer",
                "\u0003bilkul theek kaam kar raha hai.",
                "",
                "\u0002A product by TechMint"
            };

            var payload = EscPos.Build(string.Join("\n", lines));
            var ok = RawPrinter.Send(target, payload, "Mnahels RAW test", out var error);
            PrinterConfig.Log("setup raw test: " + (ok ? "OK" : "FAIL " + error) +
                              " bytes=" + payload.Length +
                              " printer=" + (string.IsNullOrWhiteSpace(target) ? "none" : target));
            _status.ForeColor = ok ? Color.FromArgb(126, 198, 143) : Color.FromArgb(226, 122, 96);
            _status.Text = ok
                ? "Test parchi bhej di gayi (" + payload.Length + " bytes) — printer se nikalni chahiye."
                : "Test fail: " + error;
        }
        catch (Exception ex)
        {
            _status.ForeColor = Color.FromArgb(226, 122, 96);
            _status.Text = "Test fail: " + ex.Message;
        }
        finally
        {
            _testPrint.Enabled = true;
        }
    }

    private static void StyleCombo(ComboBox combo, Point location, List<string> printers)
    {
        combo.Location = location;
        combo.Width = 560;
        combo.DropDownStyle = ComboBoxStyle.DropDownList;
        combo.FlatStyle = FlatStyle.Flat;
        combo.BackColor = Color.FromArgb(38, 36, 32);
        combo.ForeColor = Color.FromArgb(232, 226, 214);
        combo.Items.Add(DefaultChoice);
        foreach (var printer in printers) combo.Items.Add(printer);
        combo.SelectedIndex = 0;
    }

    private static void Select(ComboBox combo, string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        var index = combo.Items.IndexOf(value);
        if (index >= 0) combo.SelectedIndex = index;
    }

    private static string Chosen(ComboBox combo)
    {
        var value = combo.SelectedItem as string;
        return string.IsNullOrWhiteSpace(value) || value == DefaultChoice ? string.Empty : value;
    }

    private static void StyleButton(Button button, string caption, Point location, int width)
    {
        button.Text = caption;
        button.Location = location;
        button.Width = width;
        button.Height = 30;
        button.FlatStyle = FlatStyle.Flat;
        button.BackColor = Color.FromArgb(44, 42, 37);
        button.ForeColor = Color.FromArgb(232, 226, 214);
        button.FlatAppearance.BorderSize = 0;
    }
}
