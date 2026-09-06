using Microsoft.EntityFrameworkCore;
class PosDb(DbContextOptions<PosDb> options):DbContext(options){public DbSet<Category> Categories=>Set<Category>();public DbSet<Product> Products=>Set<Product>();public DbSet<ProductVariant> ProductVariants=>Set<ProductVariant>();}
class Category{public int Id{get;set;}public string Name{get;set;}="";public string Icon{get;set;}="";public int SortOrder{get;set;}public List<Product> Products{get;set;}=[];}
class Product{public int Id{get;set;}public int CategoryId{get;set;}public Category? Category{get;set;}public string Name{get;set;}="";public string? Icon{get;set;}public string? Description{get;set;}public bool IsActive{get;set;}=true;public bool IsAvailable{get;set;}=true;public List<ProductVariant> Variants{get;set;}=[];}
class ProductVariant{public int Id{get;set;}public int ProductId{get;set;}public Product? Product{get;set;}public string Name{get;set;}="Regular";public decimal Price{get;set;}public int SortOrder{get;set;}}
