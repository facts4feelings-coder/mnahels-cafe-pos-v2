using Microsoft.EntityFrameworkCore;

static class V42MenuMigration
{
    public static void Apply(PosDb db)
    {
        const string targetName = "Coffee & Tea";
        if (db.Categories.Any(x => x.Name == targetName)) return;
        var names = new[] { "Coffee", "Cardamom Tea", "Karrak Tea", "Black Coffee", "Green Tea" };
        var categories = db.Categories.Include(x => x.Products).ThenInclude(x => x.Variants).ToList();
        foreach (var existing in categories.Where(x => x.SortOrder >= 10)) existing.SortOrder++;
        var target = new Category { Name = targetName, Icon = "☕", SortOrder = 10 };
        db.Categories.Add(target);
        foreach (var name in names)
        {
            var product = categories.SelectMany(x => x.Products).FirstOrDefault(x => x.Name == name);
            if (product is not null) product.Category = target;
        }
        db.SaveChanges();
    }
}
