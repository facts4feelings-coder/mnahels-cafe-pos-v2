/* Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology. */
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

// Inventory is always derived from persistent directories, never from database rows.
// HTTP callers hold BookingGate; automatic backups use BookingGate.TryMaintenance.
static class BackupStore
{
    internal sealed record Entry(string Id, string Name, string Path, long SizeBytes, double SizeKb, DateTime CreatedAt, string Folder);
    static StringComparer Paths => OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
    static string Full(string path) => System.IO.Path.GetFullPath(path);
    static string Quote(string name) => "\"" + name.Replace("\"", "\"\"") + "\"";
    static string FileConnection(string path, SqliteOpenMode mode) => new SqliteConnectionStringBuilder
    { DataSource = path, Mode = mode, Pooling = false, Cache = SqliteCacheMode.Private, ForeignKeys = true }.ToString();
    static bool RegularFile(FileInfo f) => f.Exists && (f.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) == 0;

    internal static List<Entry> List(string dataRoot, string folder, string connectionString)
    {
        var main = Full(new SqliteConnectionStringBuilder(connectionString).DataSource);
        var entries = new List<Entry>();
        var seen = new HashSet<string>(Paths);
        foreach (var dir in new[] { folder, System.IO.Path.Combine(dataRoot, "Backups") }.Select(Full).Distinct(Paths))
        {
            if (!Directory.Exists(dir)) continue;
            foreach (var f in new DirectoryInfo(dir).EnumerateFiles("*.db", SearchOption.TopDirectoryOnly))
            {
                var path = Full(f.FullName);
                if (!RegularFile(f) || Paths.Equals(path, main) || !seen.Add(path)) continue;
                // Opaque per-path identity distinguishes equal filenames in two configured folders.
                var key = OperatingSystem.IsWindows() ? path.ToUpperInvariant() : path;
                var id = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant();
                entries.Add(new Entry(id, f.Name, path, f.Length, Math.Round(f.Length / 1024d, 2), f.LastWriteTimeUtc, dir));
            }
        }
        return entries.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Path, Paths).ToList();
    }

    internal static string Create(string folder, string connectionString, string prefix = "mnahels-pos-auto")
    {
        Directory.CreateDirectory(folder);
        var final = System.IO.Path.Combine(folder, $"{prefix}-{DateTime.UtcNow:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.db");
        var pending = final + ".partial";
        try
        {
            using (var source = new SqliteConnection(connectionString))
            using (var target = new SqliteConnection(FileConnection(pending, SqliteOpenMode.ReadWriteCreate)))
            {
                source.Open(); target.Open(); source.BackupDatabase(target);
                Validate(target);
            }
            File.Move(pending, final); // unique name; never overwrite a previous backup
            return final;
        }
        finally { DeleteOwnedTemporary(pending); }
    }

    internal static Entry Resolve(IEnumerable<Entry> entries, string? id, string? name)
    {
        var matches = entries.Where(x => !string.IsNullOrWhiteSpace(id)
            ? string.Equals(x.Id, id, StringComparison.Ordinal)
            : string.Equals(x.Name, name, StringComparison.Ordinal) || Paths.Equals(x.Path, name)).ToList();
        if (matches.Count != 1) throw new InvalidDataException("Select one existing backup from the list. Missing or ambiguous backup file.");
        return matches[0];
    }

    // Only business tables are restored. Existing accounts/passwords, unknown licensing tables,
    // schema, settings.json, license files and every original backup remain untouched.
    // Parent-before-child order; deletion is the reverse order, with deferred FK validation.
    static readonly string[] BusinessTables = ["Categories", "Products", "ProductVariants", "Customers", "ServicePeople", "CafeTables", "Shifts", "Orders", "OrderItems", "ShiftCashMovements", "MenuSearchCodes", "OrderAmendments", "ShiftOrderAuditSnapshots", "AuditLogs"];
    static readonly string[] RequiredTables = ["Users", "Categories", "Products", "ProductVariants", "Orders", "OrderItems"];

    internal static string Restore(string dataRoot, string folder, string connectionString, string? id, string? name, string? confirmation)
    {
        var entry = Resolve(List(dataRoot, folder, connectionString), id, name);
        if (!string.Equals(confirmation, "RESTORE " + entry.Name, StringComparison.Ordinal))
            throw new InvalidDataException("Confirm the selected backup before restoring it.");
        // Copy to our own staging file so a changing external file cannot change the validated input.
        var staging = System.IO.Path.Combine(dataRoot, $".restore-{Guid.NewGuid():N}.partial");
        try
        {
            using (var source = new SqliteConnection(FileConnection(entry.Path, SqliteOpenMode.ReadOnly)))
            using (var stage = new SqliteConnection(FileConnection(staging, SqliteOpenMode.ReadWriteCreate)))
            {
                source.Open(); Validate(source); stage.Open(); source.BackupDatabase(stage); Validate(stage);
            }
            using var current = new SqliteConnection(connectionString);
            current.Open();
            using (var attach = current.CreateCommand())
            {
                attach.CommandText = "ATTACH DATABASE $path AS restore_input;";
                attach.Parameters.AddWithValue("$path", staging); attach.ExecuteNonQuery();
            }
            try
            {
                var tables = BusinessTables.Where(t => TableExists(current, "main", t)).ToList();
                var columns = new Dictionary<string, List<string>>();
                foreach (var table in tables)
                {
                    if (!TableExists(current, "restore_input", table))
                        throw new InvalidDataException($"Backup schema is incompatible: missing {table}. No data was changed.");
                    var live = Columns(current, "main", table);
                    var saved = Columns(current, "restore_input", table);
                    if (!live.ToHashSet(StringComparer.OrdinalIgnoreCase).SetEquals(saved))
                        throw new InvalidDataException($"Backup schema is incompatible: {table} columns differ. No data was changed.");
                    columns[table] = live;
                }
                // Must succeed before the first live write. No retention cleanup occurs here.
                var safety = Create(System.IO.Path.Combine(dataRoot, "Backups"), connectionString, "before-restore");
                using var transaction = current.BeginTransaction();
                void Sql(string sql)
                {
                    using var command = current.CreateCommand(); command.Transaction = transaction;
                    command.CommandText = sql; command.ExecuteNonQuery();
                }
                Sql("PRAGMA defer_foreign_keys=ON;");
                foreach (var table in tables.AsEnumerable().Reverse()) Sql($"DELETE FROM main.{Quote(table)};");
                foreach (var table in tables)
                {
                    var fields = string.Join(",", columns[table].Select(Quote));
                    Sql($"INSERT INTO main.{Quote(table)} ({fields}) SELECT {fields} FROM restore_input.{Quote(table)};");
                }
                // Never commit broken references, including business rows referencing retained accounts.
                using (var check = current.CreateCommand())
                {
                    check.Transaction = transaction; check.CommandText = "PRAGMA main.foreign_key_check;";
                    using var reader = check.ExecuteReader();
                    if (reader.Read()) throw new InvalidDataException("Backup references do not match the retained accounts/data. Restore rolled back; safety backup retained.");
                }
                transaction.Commit();
                return $"Restore complete: {entry.Name}. Accounts and licensing preserved. Safety backup: {System.IO.Path.GetFileName(safety)}. All original backups retained.";
            }
            finally
            {
                using var detach = current.CreateCommand(); detach.CommandText = "DETACH DATABASE restore_input;"; detach.ExecuteNonQuery();
            }
        }
        finally { DeleteOwnedTemporary(staging); }
    }

    static bool TableExists(SqliteConnection db, string schema, string table)
    {
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"SELECT COUNT(*) FROM {schema}.sqlite_master WHERE type='table' AND name=$name AND sql NOT LIKE 'CREATE VIRTUAL%';";
        cmd.Parameters.AddWithValue("$name", table); return Convert.ToInt32(cmd.ExecuteScalar()) == 1;
    }
    static List<string> Columns(SqliteConnection db, string schema, string table)
    {
        using var cmd = db.CreateCommand(); cmd.CommandText = $"PRAGMA {schema}.table_info({Quote(table)});";
        using var reader = cmd.ExecuteReader(); var columns = new List<string>();
        while (reader.Read()) columns.Add(reader.GetString(1)); return columns;
    }
    static void Validate(SqliteConnection db)
    {
        using (var check = db.CreateCommand())
        {
            check.CommandText = "PRAGMA quick_check;";
            using var reader = check.ExecuteReader();
            if (!reader.Read() || !string.Equals(reader.GetString(0), "ok", StringComparison.OrdinalIgnoreCase) || reader.Read())
                throw new InvalidDataException("Invalid or corrupt SQLite backup. No data was changed.");
        }
        foreach (var table in RequiredTables)
            if (!TableExists(db, "main", table)) throw new InvalidDataException("Not a compatible Mnahel's Cafe backup. No data was changed.");
    }
    static void DeleteOwnedTemporary(string path)
    {
        // Never delete inventory files. This path is a random, newly-created staging file only.
        foreach (var suffix in new[] { "", "-journal", "-wal", "-shm" })
            try { if (File.Exists(path + suffix)) File.Delete(path + suffix); } catch { }
    }
}
