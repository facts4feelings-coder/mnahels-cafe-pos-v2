/* Poster-supplied menu additions; idempotent and preserves later menu edits.
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using Microsoft.EntityFrameworkCore;
static class SuperDealsMigration
{
 public static readonly (string Name,string Contents,decimal Price)[] Deals=[
 ("Super Deal 02","Small Pizza + 5 Wings + 500ml Drink",950m),
 ("Super Deal 03","Small Pizza + 1 Zinger + 500ml Drink",1070m),
 ("Super Deal 04","5 Wings + Medium Pizza + 1L Drink",1400m),
 ("Super Deal 05","Medium Pizza + Pasta + 1L Drink",1600m),
 ("Super Deal 06","Large Pizza + 10 Hot Wings + 1.5L Drink",2050m),
 ("Super Deal 07","Special Pasta + Large Pizza + 1.5L Drink",2000m),
 ("Super Deal 08","Large Pizza + Medium Pizza + 1.5L Drink",2500m),
 ("Super Deal 09","3 Zinger Burgers + 1L Drink",1300m),
 ("Super Deal 10","5 Zinger Burgers + 1.5L Drink",2100m)];
 public static void Apply(PosDb db){
 db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS MenuUpdateHistory (Key TEXT PRIMARY KEY)");using var tx=db.Database.CurrentTransaction is null?db.Database.BeginTransaction():null;
 var applied=db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM MenuUpdateHistory WHERE Key='super-deals-v60'").Single();if(applied>0){tx?.Commit();return;}
 var categories=db.Categories.Include(x=>x.Products).ThenInclude(x=>x.Variants).ToList();
 foreach(var cat in categories.Where(x=>System.Text.RegularExpressions.Regex.IsMatch(x.Name,@"^drinks?\s*(&|and)\s*shak(?:e|s|se)*s?$",System.Text.RegularExpressions.RegexOptions.IgnoreCase)))cat.Name="Shakes";
 var target=categories.FirstOrDefault(x=>x.Name.Equals("Super Deals",StringComparison.OrdinalIgnoreCase));if(target is null){target=new Category{Name="Super Deals",Icon="🔥",SortOrder=categories.Select(x=>x.SortOrder).DefaultIfEmpty().Max()+1};db.Categories.Add(target);}
 foreach(var (name,contents,price) in Deals){if(target.Products.Any(x=>x.Name.Equals(name,StringComparison.OrdinalIgnoreCase)))continue;target.Products.Add(new Product{Name=name,Icon="🍕",Description=contents,IsActive=true,IsAvailable=true,Variants=[new ProductVariant{Name=contents,Price=price,SortOrder=0}]});}
 db.SaveChanges();db.Database.ExecuteSqlRaw("INSERT INTO MenuUpdateHistory (Key) VALUES ('super-deals-v60')");tx?.Commit();}
}
