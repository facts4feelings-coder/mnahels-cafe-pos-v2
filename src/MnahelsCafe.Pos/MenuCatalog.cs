/* Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

// One catalog projection for both roles; management explicitly includes archived items.
static class MenuCatalog
{
 public static void Initialize(PosDb db,bool factoryReset=false){Install(db);if(factoryReset)db.Database.ExecuteSqlRaw("DELETE FROM MenuUpdateHistory WHERE Key='super-deals-v60'");SeedData.Apply(db);SuperDealsMigration.Apply(db);V42MenuMigration.Apply(db);if(factoryReset)NewEpoch(db);}
 public static async Task<CatalogCategory[]> Read(PosDb db,bool includeArchived=false){
  var categories=await db.Categories.AsNoTracking().Include(c=>c.Products).ThenInclude(p=>p.Variants).OrderBy(c=>c.SortOrder).ThenBy(c=>c.Id).ToListAsync();
  return categories.Select(c=>new CatalogCategory(c.Id,c.Name,c.Icon,c.Products.Where(p=>includeArchived||p.IsActive).OrderBy(p=>p.Name).ThenBy(p=>p.Id).Select(p=>new CatalogProduct(p.Id,p.CategoryId,p.Name,p.Icon,p.Description,p.IsActive,p.IsAvailable,p.Variants.OrderBy(v=>v.SortOrder).ThenBy(v=>v.Id).Select(v=>new CatalogVariant(v.Id,v.Name,v.Price,v.SortOrder)).ToArray())).ToArray())).Where(c=>includeArchived||c.Products.Length>0).ToArray();
 }
 public static CatalogStamp Stamp(PosDb db)=>db.Database.SqlQueryRaw<CatalogStamp>("SELECT Revision, Epoch FROM CatalogState WHERE Id=1").Single();
 public static void MapApi(RouteGroupBuilder api){
  api.MapGet("/menu/revision",(PosDb db,HttpContext context)=>{context.Response.Headers.CacheControl="no-store";return Results.Ok(Stamp(db));});
  api.AddEndpointFilter(async(context,next)=>{
   var result=await next(context);var request=context.HttpContext.Request;
   if(request.Method is "GET" or "HEAD"||result is IStatusCodeHttpResult{StatusCode:>=400})return result;
   var path=request.Path.Value?.ToLowerInvariant()??"";
   if(path=="/api/backup/restore"){
    var db=context.HttpContext.RequestServices.GetRequiredService<PosDb>();db.ChangeTracker.Clear();SchemaUpgrade.Apply(db);OrderEditingFeatures.ApplySchema(db);Install(db);NewEpoch(db);
   }else if(path=="/api/settings"||path.StartsWith("/api/menu-ids/",StringComparison.Ordinal))Touch(context.HttpContext.RequestServices.GetRequiredService<PosDb>());
   return result;
  });
 }
 public static void Touch(PosDb db)=>db.Database.ExecuteSqlRaw("UPDATE CatalogState SET Revision=lower(hex(randomblob(16))) WHERE Id=1");
 public static void NewEpoch(PosDb db)=>db.Database.ExecuteSqlRaw("UPDATE CatalogState SET Epoch=lower(hex(randomblob(16))),Revision=lower(hex(randomblob(16))) WHERE Id=1");
 public static void Install(PosDb db){
  db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS CatalogState (Id INTEGER PRIMARY KEY CHECK(Id=1),Revision TEXT NOT NULL,Epoch TEXT NOT NULL)");
  db.Database.ExecuteSqlRaw("INSERT OR IGNORE INTO CatalogState VALUES (1,lower(hex(randomblob(16))),lower(hex(randomblob(16))))");
  db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS MenuUpdateHistory (Key TEXT PRIMARY KEY)");
  var connection=db.Database.GetDbConnection();var close=connection.State!=System.Data.ConnectionState.Open;if(close)connection.Open();
  try{
   // Closed identifier lists, not user input. Revision updates share the menu-write transaction.
   foreach(var table in new[]{"Categories","Products","ProductVariants"})foreach(var action in new[]{"INSERT","UPDATE","DELETE"}){
    using var command=connection.CreateCommand();command.Transaction=db.Database.CurrentTransaction?.GetDbTransaction();command.CommandText=$"CREATE TRIGGER IF NOT EXISTS Catalog_{table}_{action} AFTER {action} ON {table} BEGIN UPDATE CatalogState SET Revision=lower(hex(randomblob(16))) WHERE Id=1; END";command.ExecuteNonQuery();
   }
  }finally{if(close)connection.Close();}
 }
}
sealed class CatalogStamp{public string Revision{get;set;}="";public string Epoch{get;set;}="";}
record CatalogCategory(int Id,string Name,string Icon,CatalogProduct[] Products);
record CatalogProduct(int Id,int CategoryId,string Name,string? Icon,string? Description,bool IsActive,bool IsAvailable,CatalogVariant[] Variants);
record CatalogVariant(int Id,string Name,decimal Price,int SortOrder);
