// Convert src/data/product_all.xlsx + src/data/category.json -> src/data/products.json
// Output shape matches the flat branch of normalizeRaw() in src/lib/model.js.
//
// Variant grouping key: (Brand, Type, Color, Size)
//  - Fallback to (Product name, Color, Size) when Type is missing (e.g. merchize).
// Category tree: hybrid — keep category.json as backbone, enrich with auto leaves
//  built from Category > Product list > Type path in Excel.

import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'src/data/product_all.xlsx');
const CATEGORY_PATH = path.join(ROOT, 'src/data/category.json');
const OUTPUT_PATH = path.join(ROOT, 'src/data/products.json');

const META_SHEETS = new Set([
  'Lịch sử thay đổi giá',
  'Cashback Program',
  'SO SÁNH DEAL 1717',
  'Sheet46',
  'bảng giá private PW',
  'Sellerwix- pw',
]);

// Synonyms to bridge Excel category labels -> curated category.json roots.
// Keys are lowercased Excel category names; values are the canonical curated root name.
const CATEGORY_SYNONYMS = {
  'home decor': 'Home and Living',
  'home and living': 'Home and Living',
  'home living': 'Home and Living',
  "baby clothing": "Baby's Clothing",
  "baby's clothing": "Baby's Clothing",
  'youth clothing': 'Kid Clothing',
  'clothing': 'Adult clothing',
  'apparel': 'Adult clothing',
  'adult clothing': 'Adult clothing',
  'tshirt': 'Adult clothing',
  't-shirt': 'Adult clothing',
  'tee': 'Adult clothing',
  'tank': 'Adult clothing',
  'tank top': 'Adult clothing',
  'hoodie': 'Adult clothing',
  'sweatshirt': 'Adult clothing',
  'longsleeve': 'Adult clothing',
  "baby's clothing": "Baby's Clothing",
  'kid clothing': 'Kid Clothing',
  'kids clothing': 'Kid Clothing',
  'accessories': 'Accessories',
  'tote bag': 'Accessories',
  'bag': 'Accessories',
  'hat': 'Accessories',
  'hats': 'Accessories',
};

const REGION_MAP = {
  'Domestic': 'US',
  'AK/HI/PR': 'AKHIPR',
  'International': 'INTL',
  'Canada': 'CA',
  'UK and Europe': 'EU',
  'UK': 'UK',
  'Europe': 'EU',
  'Australia': 'AU',
};
const REGION_RE = /^(Domestic|AK\/HI\/PR|International|Canada|UK and Europe|Europe|UK|Australia)-(.+?)$/;

const ALIASES = {
  productName: ['product name'],
  productSku: ['product sku', 'sku'],
  size: ['size'],
  color: ['color'],
  type: ['type', 'product type'],
  brand: ['brand'],
  category: ['category'],
  productList: ['product list'],
  baseCost: ['base cost (1-side)', 'base cost', 'base'],
  handleFee: ['handle fee tiktok'],
  rushFee: ['rush fee tiktok'],
  extraSide: ['extra side print price'],
  embroidery: ['embroidery pricing'],
  neckLabel: ['neck label price'],
  sleeve: ['left/right sleeve'],
  location: ['location'],
  tiktokLabel: ['tiktok label'],
};

// Deterministic fake delivery timeline per supplier catalog.
// Real tracking data isn't wired up yet — we generate plausible numbers so the
// "Giao nhanh nhất" KPI and delivery bars render instead of showing "—".
const FAKE_PLATFORMS = ['Etsy', 'TikTok Shop', 'Shopify'];
// VN-origin suppliers (POD in Vietnam, longer in-transit to US customers).
// Printway-US is the US branch and stays fast; only printway-vn is VN-origin.
const VN_ORIGIN = /(^|[-\s])vn\b|snapecom\s*-\s*vn|merchize|pentifine|flashship|gearment|podgasus|printway-vn/i;

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function fakeDeliveryFor(supplierName, catalogId, tiktokFlag) {
  const h = hashStr(catalogId);
  const isVN = VN_ORIGIN.test(supplierName);
  const platform = tiktokFlag ? 'TikTok Shop' : FAKE_PLATFORMS[h % 2]; // Etsy or Shopify
  // VN-origin (POD in Vietnam shipping to US): longer in-transit
  // US-origin suppliers: fastest fulfillment
  const submitDays    = isVN ? 1 + (h % 2)         : 1;
  const trackingDays  = isVN ? 2 + (h % 3)         : 1 + (h % 2);
  const inTransitDays = isVN ? 8 + (h % 5)         : 3 + (h % 4);
  const deliveredDays = isVN ? 1 + ((h >> 3) % 2)  : 1;
  return [{ platform, submitDays, trackingDays, inTransitDays, deliveredDays }];
}

function slug(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normStr(s) {
  if (s == null) return '';
  return String(s).replace(/\s+/g, ' ').trim();
}

function normHeader(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function parseNum(v) {
  if (v == null || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  let s = String(v).trim();
  if (!s || s === '-' || s === '—') return undefined;
  s = s.replace(/^\$/, '').replace(/\s/g, '');
  if (!s || s === '-') return undefined;
  // European decimal "2,13" -> 2.13 (no dot, comma followed by 1-3 digits)
  if (/^-?\d+,\d{1,3}$/.test(s) && !s.includes('.')) s = s.replace(',', '.');
  // Thousands separators "1,234.56" -> remove commas
  else if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 6); i++) {
    const row = (aoa[i] || []).map((c) => String(c ?? '').toLowerCase().trim());
    if (row.includes('product name')) return i;
  }
  return -1;
}

function buildColIndex(headerRow) {
  const idx = {};
  (headerRow || []).forEach((h, i) => {
    const k = normHeader(h).toLowerCase();
    if (k && !(k in idx)) idx[k] = i;
  });
  return idx;
}

function resolveCol(colIdx, aliases) {
  for (const a of aliases) if (a in colIdx) return colIdx[a];
  return -1;
}

function parseShippingColumns(headerRow) {
  const out = [];
  (headerRow || []).forEach((raw, i) => {
    const h = normHeader(raw);
    const m = h.match(REGION_RE);
    if (!m) return;
    const [, region, rest] = m;
    const bucket = REGION_MAP[region];
    let method = rest.trim();
    let kind = 'first';
    const addMatch = method.match(/^(.*?)\s+Additional\s+(?:Item|item)\s*$/);
    const surMatch = method.match(/^(.*?)\s+Surcharge\s*$/i);
    if (surMatch) { method = surMatch[1].trim(); kind = 'surcharge'; }
    else if (addMatch) { method = addMatch[1].trim(); kind = 'additional'; }
    out.push({ colIdx: i, region: bucket, method, kind });
  });
  return out;
}

function flattenCategoryTree(rows) {
  const nodes = [];
  const walk = (list, parentId) => {
    for (const n of list ?? []) {
      nodes.push({
        id: n.id,
        name: n.name,
        parentId: parentId,
        active: n.active === 1,
        image: n.image ?? null,
        thumbUrl: n.thumb_url ?? null,
        hasVariants: n.has_category_variants === 1,
        auto: false,
      });
      if (n.children?.length) walk(n.children, n.id);
    }
  };
  walk(rows, null);
  return nodes;
}

class CategoryMatcher {
  constructor(flatNodes) {
    this.nodes = [...flatNodes];
    this.childrenIndex = new Map();
    for (const n of this.nodes) {
      const key = n.parentId ?? 'ROOT';
      if (!this.childrenIndex.has(key)) this.childrenIndex.set(key, new Map());
      this.childrenIndex.get(key).set(String(n.name).toLowerCase().trim(), n.id);
    }
    this.uncategorizedId = null;
    this.stats = { autoLeaves: 0, uncategorizedProducts: 0 };
    this._autoCounter = 0;
  }

  _getOrCreate(parentId, name) {
    const key = parentId ?? 'ROOT';
    if (!this.childrenIndex.has(key)) this.childrenIndex.set(key, new Map());
    const map = this.childrenIndex.get(key);
    const nameLc = String(name).toLowerCase().trim();
    if (map.has(nameLc)) return map.get(nameLc);
    const id = `auto:${slug(name)}:${this._autoCounter++}`;
    this.nodes.push({
      id,
      name: String(name).trim(),
      parentId: parentId ?? null,
      active: true,
      image: null,
      thumbUrl: null,
      hasVariants: true,
      auto: true,
    });
    map.set(nameLc, id);
    this.stats.autoLeaves++;
    return id;
  }

  _ensureUncategorized() {
    if (this.uncategorizedId) return this.uncategorizedId;
    const id = 'auto:uncategorized';
    this.nodes.push({
      id,
      name: 'Uncategorized',
      parentId: null,
      active: true,
      image: null,
      thumbUrl: null,
      hasVariants: true,
      auto: true,
    });
    if (!this.childrenIndex.has('ROOT')) this.childrenIndex.set('ROOT', new Map());
    this.childrenIndex.get('ROOT').set('uncategorized', id);
    this.uncategorizedId = id;
    return id;
  }

  match(pathSegments) {
    const segs = (pathSegments || [])
      .map((s) => normStr(s))
      .filter((s) => s && s !== '-');
    if (!segs.length) {
      this.stats.uncategorizedProducts++;
      return this._ensureUncategorized();
    }
    // Apply synonym on the first segment to improve root matching
    if (segs[0]) {
      const syn = CATEGORY_SYNONYMS[segs[0].toLowerCase()];
      if (syn) segs[0] = syn;
    }
    let parentId = null;
    let segIdx = 0;
    while (segIdx < segs.length) {
      const map = this.childrenIndex.get(parentId ?? 'ROOT');
      if (!map) break;
      const existing = map.get(segs[segIdx].toLowerCase());
      if (!existing) break;
      parentId = existing;
      segIdx++;
    }
    // If segIdx === 0 (nothing matched curated tree), fall through to _getOrCreate
    // with parentId=null → creates a new root node for the Excel's top-level label.
    while (segIdx < segs.length) {
      parentId = this._getOrCreate(parentId, segs[segIdx]);
      segIdx++;
    }
    return parentId;
  }
}

function main() {
  console.log(`Reading ${path.basename(XLSX_PATH)}...`);
  const buf = fs.readFileSync(XLSX_PATH);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
  const categoryJson = JSON.parse(fs.readFileSync(CATEGORY_PATH, 'utf8'));
  const flatCats = flattenCategoryTree(categoryJson.rows ?? []);
  const matcher = new CategoryMatcher(flatCats);

  const suppliers = [];
  const productMap = new Map();
  const variantMap = new Map();
  const variantOffers = [];
  const supplierCatalogs = [];
  const catalogMap = new Map();
  const productCategoryPath = new Map();
  const productAttrs = new Map();

  let totalRows = 0;
  let skippedRows = 0;

  console.log('\nProcessing sheets:');
  for (const sheetName of wb.SheetNames) {
    if (META_SHEETS.has(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    if (!aoa.length) continue;

    const hdrRow = findHeaderRow(aoa);
    if (hdrRow < 0) {
      console.warn(`  [skip] "${sheetName}" — header row not found`);
      continue;
    }
    const header = aoa[hdrRow];
    const colIdx = buildColIndex(header);
    const dataRows = aoa.slice(hdrRow + 1).filter(
      (r) => r.some((c) => c != null && String(c).trim() !== '')
    );
    const shipCols = parseShippingColumns(header);

    const col = Object.fromEntries(
      Object.entries(ALIASES).map(([k, aliases]) => [k, resolveCol(colIdx, aliases)])
    );
    if (col.productName < 0) {
      console.warn(`  [skip] "${sheetName}" — no Product name column`);
      continue;
    }

    const supplierId = `sup_${slug(sheetName)}`;
    if (!suppliers.find((s) => s.id === supplierId)) {
      suppliers.push({
        id: supplierId,
        name: sheetName.trim(),
        active: true,
        tiktok: col.tiktokLabel >= 0,
      });
    }

    let sheetRowCount = 0;
    for (const row of dataRows) {
      const productName = normStr(row[col.productName]);
      if (!productName) { skippedRows++; continue; }
      const brand = normStr(row[col.brand]);
      const type = normStr(row[col.type]);
      let color = normStr(row[col.color]);
      let size = normStr(row[col.size]);
      let printLoc = '';
      // Printway-style sheets pack "COLOR/SIZE/PRINT-LOCATION" into the Size column
      // when there is no dedicated Color column. Split it so the variant matrix
      // stays 2-D (Color × Size) with Print-location as a 3rd attribute filter.
      if ((!color || color === '-') && size.includes('/')) {
        const parts = size.split('/').map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          color = parts[0];
          size = parts[1];
          if (parts.length >= 3) printLoc = parts.slice(2).join('/');
        }
      }
      const sku = normStr(row[col.productSku]);
      const baseCost = parseNum(col.baseCost >= 0 ? row[col.baseCost] : undefined);

      const typeKey = type && type !== '-' ? type : '';
      const brandKey = brand && brand !== '-' ? brand : '';
      let productKey;
      if (brandKey && typeKey) productKey = `${brandKey.toLowerCase()}|${typeKey.toLowerCase()}`;
      else if (typeKey) productKey = `type:${typeKey.toLowerCase()}`;
      else productKey = `pn:${productName.toLowerCase()}`;

      let product = productMap.get(productKey);
      if (!product) {
        const pid = `p_${slug(brandKey || productName).slice(0, 24)}_${slug(typeKey || sku || productName).slice(0, 32)}_${productMap.size}`;
        product = {
          id: pid,
          name: typeKey ? `${productName} · ${typeKey}` : productName,
          code: typeKey || sku || productName.slice(0, 32),
          active: true,
          categoryId: null,
          image: null,
          attributes: [],
        };
        productMap.set(productKey, product);
        productAttrs.set(product.id, { Color: new Set(), Size: new Set(), Print: new Set() });
        let rootHint = col.category >= 0 ? normStr(row[col.category]) : '';
        if (!rootHint) rootHint = sheetName.trim();
        const pathSegs = [
          rootHint,
          col.productList >= 0 ? normStr(row[col.productList]) : '',
          typeKey,
        ];
        productCategoryPath.set(product.id, pathSegs);
      }

      const attrs = productAttrs.get(product.id);
      const colorVal = color && color !== '-' ? color : '';
      const sizeVal = size && size !== '-' ? size : '';
      const printVal = printLoc && printLoc !== '-' ? printLoc : '';
      if (colorVal) attrs.Color.add(colorVal);
      if (sizeVal) attrs.Size.add(sizeVal);
      if (printVal) attrs.Print.add(printVal);

      const variantKey = `${product.id}::${colorVal.toLowerCase()}::${sizeVal.toLowerCase()}::${printVal.toLowerCase()}`;
      let variant = variantMap.get(variantKey);
      if (!variant) {
        const vid = `v_${slug(product.id).slice(0, 40)}_${slug(colorVal || 'nocolor').slice(0, 16)}_${slug(sizeVal || 'nosize').slice(0, 16)}_${variantMap.size}`;
        variant = {
          id: vid,
          productId: product.id,
          active: true,
          options: {
            Color: colorVal || '—',
            Size: sizeVal || '—',
            ...(printVal ? { Print: printVal } : {}),
          },
        };
        variantMap.set(variantKey, variant);
      }

      const catalogId = `cat_${supplierId}_${product.id}`;
      let catalog = catalogMap.get(catalogId);
      if (!catalog) {
        catalog = {
          id: catalogId,
          supplierId,
          productId: product.id,
          name: `${sheetName.trim()} – ${product.name}`,
          enabled: true,
          priority: 0,
          type: 'POD',
          tiktok: col.tiktokLabel >= 0,
          delivery: fakeDeliveryFor(sheetName, catalogId, col.tiktokLabel >= 0),
        };
        catalogMap.set(catalogId, catalog);
        supplierCatalogs.push(catalog);
      }

      // shipping: region -> Map<method, {method, first, additional, surcharge}>
      const shipMap = {};
      for (const sc of shipCols) {
        const v = parseNum(row[sc.colIdx]);
        if (v === undefined) continue;
        if (!shipMap[sc.region]) shipMap[sc.region] = new Map();
        const map = shipMap[sc.region];
        if (!map.has(sc.method)) map.set(sc.method, { method: sc.method });
        map.get(sc.method)[sc.kind] = v;
      }
      const shipping = {};
      for (const [region, map] of Object.entries(shipMap)) {
        shipping[region] = [...map.values()];
      }

      const fees = [];
      const pushFee = (name, colKey) => {
        const idx = col[colKey];
        if (idx == null || idx < 0) return;
        const amt = parseNum(row[idx]);
        if (amt != null) fees.push({ name, amount: amt });
      };
      pushFee('Handle (TikTok)', 'handleFee');
      pushFee('Rush (TikTok)', 'rushFee');
      pushFee('Extra side print', 'extraSide');
      pushFee('Embroidery', 'embroidery');
      pushFee('Neck label', 'neckLabel');
      pushFee('Left/Right sleeve', 'sleeve');

      variantOffers.push({
        id: `off_${variant.id}_${catalogId}`,
        variantId: variant.id,
        supplierCatalogId: catalogId,
        baseCost: baseCost ?? 0,
        shipping,
        fees,
        active: true,
        sku: sku || undefined,
      });
      sheetRowCount++;
      totalRows++;
    }
    console.log(`  ${sheetName.padEnd(28)} → ${sheetRowCount} rows`);
  }

  // Resolve categoryId per product
  const productsById = new Map([...productMap.values()].map((p) => [p.id, p]));
  for (const [pid, segs] of productCategoryPath.entries()) {
    const catId = matcher.match(segs);
    const product = productsById.get(pid);
    if (product) product.categoryId = catId;
  }

  // Assign priority within each product by supplier order (sheet order)
  const supplierOrder = new Map(suppliers.map((s, i) => [s.id, i]));
  const byProduct = new Map();
  for (const c of supplierCatalogs) {
    if (!byProduct.has(c.productId)) byProduct.set(c.productId, []);
    byProduct.get(c.productId).push(c);
  }
  for (const list of byProduct.values()) {
    list.sort((a, b) => supplierOrder.get(a.supplierId) - supplierOrder.get(b.supplierId));
    list.forEach((c, i) => { c.priority = i; });
  }

  // Finalize product attributes with Color/Size values
  const sizeOrder = { 'xs':0,'s':1,'m':2,'l':3,'xl':4,'2xl':5,'xxl':5,'3xl':6,'xxxl':6,'4xl':7,'5xl':8 };
  const products = [...productMap.values()].map((p) => {
    const a = productAttrs.get(p.id);
    const colorValues = [...a.Color].sort();
    const sizeValues = [...a.Size].sort((x, y) => {
      const xo = sizeOrder[x.toLowerCase()], yo = sizeOrder[y.toLowerCase()];
      if (xo != null && yo != null) return xo - yo;
      if (xo != null) return -1;
      if (yo != null) return 1;
      return x.localeCompare(y, undefined, { numeric: true });
    });
    const printValues = [...a.Print].sort();
    return {
      ...p,
      attributes: [
        { name: 'Color', values: colorValues.length ? colorValues : ['—'] },
        { name: 'Size', values: sizeValues.length ? sizeValues : ['—'] },
        ...(printValues.length ? [{ name: 'Print', values: printValues }] : []),
      ],
    };
  });

  const variants = [...variantMap.values()];

  console.log('\n──── Summary ────');
  console.log(`Suppliers:          ${suppliers.length}`);
  console.log(`Products:           ${products.length}`);
  console.log(`Variants:           ${variants.length}`);
  console.log(`Supplier catalogs:  ${supplierCatalogs.length}`);
  console.log(`Variant offers:     ${variantOffers.length}`);
  console.log(`Categories (total): ${matcher.nodes.length}  (auto leaves: ${matcher.stats.autoLeaves}, into Uncategorized: ${matcher.stats.uncategorizedProducts})`);
  console.log(`Rows read:          ${totalRows}  (skipped: ${skippedRows})`);

  const output = {
    categories: matcher.nodes,
    suppliers,
    products,
    variants,
    supplierCatalogs,
    variantOffers,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
  const sz = fs.statSync(OUTPUT_PATH).size;
  console.log(`\nWrote ${path.relative(ROOT, OUTPUT_PATH)}  (${(sz / 1024 / 1024).toFixed(2)} MB)`);
}

main();
