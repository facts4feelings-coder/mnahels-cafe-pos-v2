using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;

static class V42MenuMigration
{
    private static readonly string[] Names = new[] { "Coffee", "Cardamom Tea", "Karrak Tea", "Black Coffee", "Green Tea" };

    [ModuleInitializer]
    public static void Schedule()
    {
        _ = Task.Run(async () =>
        {
            for (var attempt = 0; attempt < 60; attempt++)
            {
                try
                {
                    var dataRoot = OperatingSystem.IsWindows()
                        ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "MnahelsCafePOS")
                        : Path.Combine(Directory.GetCurrentDirectory(), "App_Data");
                    var dbPath = Path.Combine(dataRoot, "mnahels-pos.db");
                    if (!File.Exists(dbPath)) { await Task.Delay(250); continue; }
                    var options = new DbContextOptionsBuilder<PosDb>().UseSqlite($"Data Source={dbPath};Cache=Shared;Foreign Keys=True").Options;
                    using var db = new PosDb(options);
                    var count = await db.Products.CountAsync(x => Names.Contains(x.Name));
                    if (count < Names.Length) { await Task.Delay(250); continue; }
                    Apply(db);
                    return;
                }
                catch { await Task.Delay(250); }
            }
        });
    }

    public static void Apply(PosDb db)
    {
        if (db.Categories.Any(x => x.Name == "Coffee & Tea")) return;
        var categories = db.Categories.Include(x => x.Products).ThenInclude(x => x.Variants).ToList();
        foreach (var existing in categories.Where(x => x.SortOrder >= 10)) existing.SortOrder++;
        var target = new Category { Name = "Coffee & Tea", Icon = "☕", SortOrder = 10 };
        db.Categories.Add(target);
        foreach (var name in Names)
        {
            var product = categories.SelectMany(x => x.Products).FirstOrDefault(x => x.Name == name);
            if (product is not null) product.Category = target;
        }
        db.SaveChanges();
    }
}
