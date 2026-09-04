const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, value) => fs.writeFileSync(path.join(root, p), value, 'utf8');
function replaceRequired(value, oldText, newText, label) {
  if (value.includes(newText)) return value;
  if (!value.includes(oldText)) throw new Error(`${label} source was not found.`);
  return value.replace(oldText, newText);
}

const programPath = 'src/MnahelsCafe.Pos/Program.cs';
let program = read(programPath);
program = replaceRequired(program,
  'SchemaUpgrade.Apply(db);SeedData.Apply(db);V42MenuMigration.Apply(db);',
  'SchemaUpgrade.Apply(db);OrderEditingFeatures.ApplySchema(db);SeedData.Apply(db);V42MenuMigration.Apply(db);',
  'running-order schema startup hook');
program = replaceRequired(program,
  'ReceiptSettingsFeatures.MapApi(api,dataRoot);',
  'ReceiptSettingsFeatures.MapApi(api,dataRoot);OrderEditingFeatures.MapApi(api);',
  'running-order API hook');
program = replaceRequired(program,
  'o.Items.Add(new OrderItem{ProductName=v.Product!.Name,VariantName=v.Name,Quantity=qty,UnitPrice=v.Price,LineTotal=v.Price*qty,Notes=line.Notes});',
  'o.Items.Add(new OrderItem{VariantId=v.Id,ProductName=v.Product!.Name,VariantName=v.Name,Quantity=qty,UnitPrice=v.Price,LineTotal=v.Price*qty,Notes=line.Notes});',
  'paid-order variant identity');
program = replaceRequired(program,
  'record OrderLineView(string ProductName,string VariantName,int Quantity,decimal UnitPrice,decimal LineTotal,string? Notes);',
  'record OrderLineView(long Id,int? VariantId,string ProductName,string VariantName,int Quantity,decimal UnitPrice,decimal LineTotal,string? Notes);',
  'order line view identity');
program = replaceRequired(program,
  'new OrderLineView(i.ProductName,i.VariantName,i.Quantity,i.UnitPrice,i.LineTotal,i.Notes)',
  'new OrderLineView(i.Id,i.VariantId,i.ProductName,i.VariantName,i.Quantity,i.UnitPrice,i.LineTotal,i.Notes)',
  'order line view mapping');
program = replaceRequired(program,
  'class OrderItem{public long Id{get;set;}public long OrderId{get;set;}public Order? Order{get;set;}public string ProductName',
  'class OrderItem{public long Id{get;set;}public long OrderId{get;set;}public Order? Order{get;set;}public int? VariantId{get;set;}public string ProductName',
  'order item variant identity');
write(programPath, program);

const paymentPath = 'src/MnahelsCafe.Pos/PaymentFeatures.cs';
let payment = read(paymentPath);
payment = replaceRequired(payment,
  'order.Items.Add(new OrderItem { ProductName = variant.Product!.Name, VariantName = variant.Name,',
  'order.Items.Add(new OrderItem { VariantId = variant.Id, ProductName = variant.Product!.Name, VariantName = variant.Name,',
  'booked-order variant identity');
write(paymentPath, payment);

const v56Path = 'src/MnahelsCafe.Pos/wwwroot/v56.js';
let v56 = read(v56Path).replace(/\r\n/g, '\n');
v56 = v56.replace(/const RELEASE = '[^']+'/, "const RELEASE = '0.15.43'");
v56 = v56.replace('${esc(order.tokenNumber)} · ${esc(order.orderNumber)}', '${esc(order.tokenNumber)} · ${esc(order.receiptNumber || order.orderNumber || "Running order")}');
if (!v56.includes('originalQuantity:')) {
  const mapPattern = /  function mapCart\(order\) \{[\s\S]*?\n  \}\n\n  function clearEditForm/;
  if (!mapPattern.test(v56)) throw new Error('booked-order cart mapper source was not found.');
  v56 = v56.replace(mapPattern, `  function mapCart(order) {
    const menuProducts = (state.menu || []).flatMap(category => (category.products || []).map(product => ({ ...product })));
    const products = (state.products || []).length ? state.products : menuProducts;
    const variants = (state.variants || []).length ? state.variants : menuProducts.flatMap(product =>
      (product.variants || []).map(variant => ({ ...variant, productId: product.id, productName: product.name })));
    return (order.items || []).map(item => {
      const requestedId = Number(item.variantId || 0);
      const variant = variants.find(value => requestedId && Number(value.id) === requestedId) ||
        variants.find(value => String(value.name || '').toLowerCase() === String(item.variantName || '').toLowerCase() &&
          String(value.productName || products.find(product => Number(product.id) === Number(value.productId))?.name || '').toLowerCase() === String(item.productName || '').toLowerCase());
      if (!variant) throw new Error(\`${'${item.productName || \'An item\'}'} is no longer available in the live menu.\`);
      const product = products.find(value => Number(value.id) === Number(variant.productId)) ||
        menuProducts.find(value => (value.variants || []).some(option => Number(option.id) === Number(variant.id)));
      if (!product) throw new Error(\`${'${item.productName || \'An item\'}'} product is no longer available.\`);
      const quantity = Math.max(1, Number(item.quantity || 1));
      const price = Number(variant.price || item.unitPrice || 0);
      return {
        variantId: Number(variant.id), productId: Number(product.id), productName: product.name, name: product.name,
        variantName: variant.name, variant: variant.name, quantity, originalQuantity: quantity,
        unitPrice: price, price, lineTotal: price * quantity, notes: item.notes || null
      };
    });
  }

  function clearEditForm`);
}
if (!v56.includes('result?.order || result')) {
  v56 = replaceRequired(v56,
    '      const order = await apiRequest(`/orders/${orderId}`, {',
    '      const result = await apiRequest(`/orders/${orderId}`, {',
    'running-order update response');
  v56 = replaceRequired(v56,
    '      });\n      clearEditForm();',
    '      });\n      const order = result?.order || result;\n      clearEditForm();',
    'running-order update extraction');
  v56 = replaceRequired(v56,
    "      if (typeof window.showOrderComplete === 'function') window.showOrderComplete(order);",
    "      if (typeof window.mnahelsV58?.completeRunningOrder === 'function') await window.mnahelsV58.completeRunningOrder(order, result); else { state.lastOrder = order; toast('Running order updated; kitchen delta is ready.'); }",
    'running-order completion handler');
}
write(v56Path, v56);

const v57Path = 'src/MnahelsCafe.Pos/wwwroot/v57.js';
let v57 = read(v57Path).replace("const BUILD='0.15.42'", "const BUILD='0.15.43'");
write(v57Path, v57);

const indexPath = 'src/MnahelsCafe.Pos/wwwroot/index.html';
let index = read(indexPath).replace(/<meta name="application-version" content="[^"]+">/, '<meta name="application-version" content="0.15.43">');
if (!index.includes('/v58.css')) index = index.replace('</head>', '<link rel="stylesheet" href="/v58.css?v=20260904-running-order-43"></head>');
if (!index.includes('/v58.js')) index = index.replace('</body>', '<script src="/v58.js?v=20260904-running-order-43"></script></body>');
if (!index.includes('/v58.js') || !index.includes('/v58.css')) throw new Error('running-order UI assets were not installed.');
write(indexPath, index);
