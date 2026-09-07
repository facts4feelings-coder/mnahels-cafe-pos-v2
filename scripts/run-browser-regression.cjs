const assert=require('assert/strict');
const timeout=setTimeout(()=>{console.error('Browser test exceeded four-minute execution budget');process.exit(1)},240000);timeout.unref();
(async()=>{const f=await require('./fixtures/cafe-server.cjs')();let ui;try{
 ui=await require('./test-v61-browser.cjs')(f);const menu=await f.api('Admin','/menu'),body={categoryId:menu[0].id,name:'QA Live Menu Item',isActive:true,isAvailable:true,variants:[{name:'Regular',price:321}]};
 const item=await f.api('Admin','/products','POST',body);await ui.catalog(item.id,true);await f.api('Admin','/products/'+item.id,'DELETE');await ui.catalog(item.id,false);
 const backup=await f.api('Admin','/backup/run','POST',{});await f.api('Admin','/admin/database/wipe','POST',{confirmation:'mnahel’s_cafe_wipe_db'});await ui.reset((await f.api('Cashier','/menu/revision')).epoch);
 await f.api('Admin','/backup/restore','POST',{name:backup.name});await ui.reset((await f.api('Cashier','/menu/revision')).epoch);
 assert.equal(f.sql([['PRAGMA foreign_key_check',[]]])[0].length,0);console.log('PASS: live two-role menu propagation, archive exclusion, ordinary draft preservation, reset/restore draft invalidation and FK integrity');
 }finally{try{await ui?.close()}finally{await f.close();clearTimeout(timeout)}}})().catch(e=>{console.error(e.stack);process.exitCode=1});
