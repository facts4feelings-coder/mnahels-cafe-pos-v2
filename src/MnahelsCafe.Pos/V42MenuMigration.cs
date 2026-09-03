using Microsoft.EntityFrameworkCore;

static class V42MenuMigration
{
    private static readonly string[] Names = ["Coffee", "Cardamom Tea", "Karrak Tea", "Black Coffee", "Green Tea"];

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
            if (product is null) continue;
            product.Category = target;
            target.Products.Add(product);
        }
        db.SaveChanges();
    }
}
