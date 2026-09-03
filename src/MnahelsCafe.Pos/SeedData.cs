using Microsoft.EntityFrameworkCore;

static class SeedData
{
    public static void Apply(PosDb db)
    {
        if (!db.Users.Any()) db.Users.AddRange(
            new AppUser { Username="admin", DisplayName="Cafe Admin", Role="Admin", PasswordHash=PasswordHash.Create("admin111") },
            new AppUser { Username="cashier", DisplayName="Front Cashier", Role="Cashier", PasswordHash=PasswordHash.Create("cashier123") });
        else
        {
            var admin=db.Users.FirstOrDefault(x=>x.Username=="admin"&&x.Role=="Admin");
            if(admin is not null&&PasswordHash.Verify("admin123",admin.PasswordHash)) admin.PasswordHash=PasswordHash.Create("admin111");
            var cashier=db.Users.FirstOrDefault(x=>x.Username=="cashier");
            if(cashier is null) db.Users.Add(new AppUser{Username="cashier",DisplayName="Front Cashier",Role="Cashier",PasswordHash=PasswordHash.Create("cashier123")});
            else { cashier.Role="Cashier"; if(string.IsNullOrWhiteSpace(cashier.DisplayName)) cashier.DisplayName="Front Cashier"; }
        }

        var menuNeedsSync=!db.Categories.Any()
            ||!db.Categories.Any(x=>x.Name=="Water / Mineral Water")
            ||!db.Categories.Any(x=>x.Name=="Cold Drinks")
            ||!db.Categories.Any(x=>x.Name=="Tin Pack")
            ||!db.Products.Any(x=>x.Name=="Sprite Tin Pack")
            ||!db.Products.Any(x=>x.Name=="Chicken Lazania");
        if(menuNeedsSync) SyncMenu(db);
        else if(!db.Products.Any(x=>x.Name=="Green Tea")) SyncHotDrinksV41(db);

        if(!db.CafeTables.Any()) db.CafeTables.AddRange(
            new CafeTable{Name="Table 1"},new CafeTable{Name="Table 2"},new CafeTable{Name="Table 3"},new CafeTable{Name="Table 4"});
        db.SaveChanges();
    }

    static void SyncHotDrinksV41(PosDb db)
    {
        var category=db.Categories.Include(x=>x.Products).ThenInclude(x=>x.Variants)
            .FirstOrDefault(x=>x.Name=="Drinks & Shakes");
        if(category is null){category=new Category{Name="Drinks & Shakes",Icon="🥤",SortOrder=9};db.Categories.Add(category);}
        foreach(var wanted in new[]{One("Coffee",200),One("Cardamom Tea",150),One("Karrak Tea",100),One("Black Coffee",120),One("Green Tea",70)})
        {
            var product=category.Products.FirstOrDefault(x=>x.Name==wanted.Name);
            if(product is null){category.Products.Add(wanted);continue;}
            product.IsActive=true;product.IsAvailable=true;
            var regular=product.Variants.FirstOrDefault(x=>x.Name=="Regular");
            if(regular is null) product.Variants.Add(new ProductVariant{Name="Regular",Price=wanted.Variants[0].Price,SortOrder=0});
            else {regular.Price=wanted.Variants[0].Price;regular.SortOrder=0;}
        }
    }

    static void SyncMenu(PosDb db)
    {
        var existingCategories=db.Categories.Include(x=>x.Products).ThenInclude(x=>x.Variants).ToList();
        var retiredPacking=existingCategories.FirstOrDefault(x=>string.Equals(x.Name,"Tin Pack",StringComparison.OrdinalIgnoreCase)&&x.Products.Any(p=>p.Name.StartsWith("Tin Pack ",StringComparison.OrdinalIgnoreCase)));
        if(retiredPacking is not null){retiredPacking.Name="Packaging (Retired)";retiredPacking.SortOrder=99;foreach(var product in retiredPacking.Products){product.IsActive=false;product.IsAvailable=false;}}
        foreach(var spec in Menu())
        {
            var category=existingCategories.FirstOrDefault(x=>CategoryAliases(spec.Name).Any(alias=>string.Equals(x.Name,alias,StringComparison.OrdinalIgnoreCase)));
            if(category is null){category=new Category{Name=spec.Name,Icon=spec.Icon,SortOrder=spec.SortOrder};db.Categories.Add(category);existingCategories.Add(category);}else{category.Name=spec.Name;category.Icon=spec.Icon;category.SortOrder=spec.SortOrder;}
            foreach(var wanted in spec.Products)
            {
                var product=category.Products.FirstOrDefault(x=>ProductAliases(wanted.Name).Any(alias=>string.Equals(x.Name,alias,StringComparison.OrdinalIgnoreCase)));
                if(product is null){category.Products.Add(wanted);continue;}
                product.Name=wanted.Name;product.Description=wanted.Description;
                foreach(var wantedVariant in wanted.Variants)
                {
                    var variant=product.Variants.FirstOrDefault(x=>string.Equals(x.Name,wantedVariant.Name,StringComparison.OrdinalIgnoreCase));
                    if(variant is null) product.Variants.Add(new ProductVariant{Name=wantedVariant.Name,Price=wantedVariant.Price,SortOrder=wantedVariant.SortOrder});
                    else {variant.Name=wantedVariant.Name;variant.Price=wantedVariant.Price;variant.SortOrder=wantedVariant.SortOrder;}
                }
                var names=wanted.Variants.Select(x=>x.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var obsolete=product.Variants.Where(x=>!names.Contains(x.Name)).ToList();if(obsolete.Count>0)db.ProductVariants.RemoveRange(obsolete);
            }
        }
    }

    static string[] CategoryAliases(string name)=>name switch{"Injected Broast"=>["Injected Broast","Broast"],"Tin Pack"=>["Tin Pack","3 Pack"],"Russian Salad"=>["Russian Salad","Salad"],_=>[name]};
    static string[] ProductAliases(string name)=>name switch{"Chicken Lazania"=>["Chicken Lazania","Chicken Hawaiian"],"Red Bull Tin Pack"=>["Red Bull Tin Pack","Red Bull"],"Coca Cola Tin Pack"=>["Coca Cola Tin Pack","Coca Cola 3 Pack"],"Pepsi Tin Pack"=>["Pepsi Tin Pack","Pepsi 3 Pack"],"7UP Tin Pack"=>["7UP Tin Pack","7UP 3 Pack"],_=>[name]};

    static IReadOnlyList<MenuCategory> Menu()=>
    [
        Cat("Pizza","🍕",1,
            Item("Special Chicken Tikka",("S",580m),("M",1050m),("L",1450m),("XL",1850m)),Item("Max Chicken Fajita",("S",580m),("M",1050m),("L",1450m),("XL",1850m)),Item("Chicken Super Supreme",("S",580m),("M",1050m),("L",1450m),("XL",1850m)),Item("Chicken Bar.b.q",("S",580m),("M",1050m),("L",1450m),("XL",1850m)),Item("Vegetable Lover",("S",580m),("M",1050m),("L",1450m),("XL",1850m)),Item("Cheese Lover",("S",580m),("M",1050m),("L",1450m),("XL",1850m)),Item("Chicken Malai Boti",("S",700m),("M",1350m),("L",1800m),("XL",2100m)),Item("Chicken Afghani",("S",700m),("M",1350m),("L",1800m),("XL",2100m)),Item("Kabab Crust",("S",700m),("M",1350m),("L",1800m),("XL",2100m)),Item("Chicken Crown Crust",("S",700m),("M",1350m),("L",1800m),("XL",2100m)),Item("Chicken Force Square",("S",700m),("M",1350m),("L",1800m),("XL",2100m)),Item("Chicken Lazania",("S",700m),("M",1350m),("L",1800m),("XL",2100m))),
        Cat("Burgers","🍔",2,One("Chicken Zinger Burger",420),One("Chicken Patti Burger",400),One("Chicken Burger",250),One("Chicken Tower Burger",700),One("Sp. American Garden Burger",600),One("American Delight",600),One("Chicken Grill Burger",600),One("Fish Burger",650)),
        Cat("Pasta","🍝",3,Item("Praido Pasta",("F1",350m),("F2",600m)),One("Creamy Pasta",700),One("Lasagna Pasta",650)),
        Cat("Injected Broast","🍗",4,One("Quarter Broast",550),One("Half Broast",1100),One("Full Broast",2100)),
        Cat("Fries","🍟",5,One("Small Fries",250),One("Medium Fries",310),One("Large Fries",450),One("Cheese Fries",550),One("Loaded Fries",580)),
        Cat("Sandwich","🥪",6,One("Peri Peri Sandwich",350),One("Tikka Grill Sandwich",400),One("Malai Boti Sandwich",400),One("Chicken Bar.b.q Sandwich",450),One("Garlic Harbel Sandwich",500),One("House & Club Sandwich",500)),
        Cat("Wings & Nuggets","🔥",7,Item("Chicken Hot Wings",("5 pc",350m),("10 pc",700m)),Item("Peri Peri Wings",("5 pc",400m),("10 pc",750m)),Item("Chicken Hot Shot",("5 pc",300m),("10 pc",600m)),Item("Chicken Nuggets",("5 pc",280m),("10 pc",540m)),Item("Bar.b.q Wings",("5 pc",400m),("10 pc",750m))),
        Cat("Wraps","🌯",8,One("Chicken Shawarma",300),One("Chicken Cheese Shawarma",350),One("Chicken Paratha",350),One("Zinger Paratha",350),One("Zinger Shawarma",350),One("Cheese Paratha",380),One("Tortilla Wrap",450),One("Garlic Herbel Wrap",500),One("Bar.b.q Wrap",500)),
        Cat("Drinks & Shakes","🥤",9,
            Item("Mint Margarita",("M",150m),("L",200m)),Item("Oreo Shake",("M",350m),("L",450m)),Item("Cold Coffee",("M",300m),("L",400m)),Item("Ice Cream Shake",("M",350m),("L",450m)),Item("Caramilk Shake",("M",350m),("L",450m)),Item("Choclate Ice Shake",("M",300m),("L",400m)),One("Coffee",200),One("Cardamom Tea",150),One("Karrak Tea",100),One("Black Coffee",120),One("Green Tea",70)),
        Cat("Desserts","🍰",10,One("Molding Lava Cake",600,"With Vanilla Ice-Cream (2 Scoop)"),One("Doo Cookies",650,"With Vanilla Ice-Cream (2 Scoop)"),One("Chocolate Brownie",650,"With Vanilla Ice-Cream (2 Scoop)")),
        Cat("Russian Salad","🥗",11,One("Russian Salad Small",250),One("Russian Salad Half",600),One("Russian Salad Full",1200)),
        Cat("Extras","➕",12,Item("Extra Topping",("Small",100m),("Medium",150m),("Large",200m),("Extra Large",250m)),One("Peri Peri Sauce",80),One("Afghani Sauce",80),One("Mayo Garlic Sauce",80),One("Honey Mustard Sauce",80)),
        Cat("Deals","🎁",13,
            One("Smart Deal 1",750,"1 Zinger Burger, regular fries, 500ml cold drink"),One("Smart Deal 2",900,"1 Peri Peri Sandwich, 1 fried chicken piece, regular fries, 500ml cold drink"),One("Smart Deal 3",1150,"1 Tortilla Wrap, 5 BBQ wings, regular fries, 500ml cold drink"),One("Smart Deal 4",1350,"1 Small Pizza, 5 hot wings, regular fries, 500ml cold drink"),One("Special Deal 1",1750,"1 Small Pizza, 1 Club Sandwich, 5 nuggets, regular fries, 1 litre cold drink"),One("Special Deal 2",1900,"1 Medium Pizza, small Russian salad, 1 Zinger Burger, regular fries, 1 litre cold drink"),One("Special Deal 3",2950,"1 Large Pizza, 2 Zinger Burgers, large fries, 2 pc fried chicken, 1.5 litre cold drink"),One("Special Deal 4",3350,"1 Large Special Pizza, quarter broast, Malai Boti Sandwich, 1.5 litre cold drink, Molding Lava Cake"),One("Family Deal 1",4200,"2 Tikka Grill Sandwiches, half litre Russian salad, 2.25 litre cold drink, Chocolate Brownie, family fries, full broast"),One("Family Deal 2",4850,"1 Extra Large Pizza, 5 Zinger Burgers, 10 hot wings, 2.25 litre cold drink, family fries")),
        Cat("Water / Mineral Water","💧",15,Item("Mineral Water",("Small · 250 ML",60m),("Medium · 500 ML",90m),("1 Litre · 1 L",130m),("Large · 1.5 L",140m),("Family · 2 L",180m))),
        Cat("Cold Drinks","🥤",16,Item("Pepsi",("250 ML",120m),("500 ML",150m),("1 Litre",210m),("1.5 Litre",240m),("2.25 Litre",280m)),Item("Coca Cola",("250 ML",120m),("500 ML",150m),("1 Litre",210m),("1.5 Litre",240m),("2.25 Litre",280m)),Item("7UP",("250 ML",120m),("500 ML",150m),("1 Litre",210m),("1.5 Litre",240m),("2.25 Litre",280m))),
        Cat("Tin Pack","🥫",14,One("Red Bull Tin Pack",1630,"Chilled tin can"),One("Coca Cola Tin Pack",390,"Chilled tin can"),One("Pepsi Tin Pack",390,"Chilled tin can"),One("7UP Tin Pack",390,"Chilled tin can"),One("Sprite Tin Pack",390,"Chilled tin can"))
    ];

    static MenuCategory Cat(string name,string icon,int sortOrder,params Product[] products)=>new(name,icon,sortOrder,products);
    static Product One(string name,decimal price,string? description=null)=>Item(name,description,("Regular",price));
    static Product Item(string name,params(string Name,decimal Price)[] variants)=>Item(name,null,variants);
    static Product Item(string name,string? description,params(string Name,decimal Price)[] variants)=>new(){Name=name,Description=description,Variants=variants.Select((x,i)=>new ProductVariant{Name=x.Name,Price=x.Price,SortOrder=i}).ToList()};
    sealed record MenuCategory(string Name,string Icon,int SortOrder,IReadOnlyList<Product> Products);
}
