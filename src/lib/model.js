// Biến JSON thô thành model đã tính sẵn chỉ số cho UI.
// Nếu JSON thật có tên trường khác, chỉ cần sửa adapter `normalizeRaw` bên dưới.

export const DELIVERY_SEGMENTS = [
  { key: 'submitDays', label: 'Submit', cls: 'seg-submit' },
  { key: 'trackingDays', label: 'Tracking', cls: 'seg-tracking' },
  { key: 'inTransitDays', label: 'In-transit', cls: 'seg-transit' },
  { key: 'deliveredDays', label: 'Delivered', cls: 'seg-delivered' },
];

const round2 = (n) => Math.round(n * 100) / 100;
export const money = (n) => (n == null ? '—' : `$${n.toFixed(2)}`);
export const days = (n) => (n == null ? '—' : `${n.toFixed(1)} ngày`);

export const COLOR_HEX = {
  black: '#111827', white: '#f8fafc', gray: '#9ca3af', grey: '#9ca3af',
  red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e',
  blue: '#3b82f6', navy: '#1e3a8a', purple: '#a855f7', pink: '#ec4899',
  brown: '#92400e', beige: '#e8d9b6', ivory: '#faf6ec', cream: '#f5efe0',
  khaki: '#c3b091', maroon: '#7f1d1d', teal: '#14b8a6', olive: '#556b2f',
  gold: '#d4a84f', silver: '#cbd5e1', charcoal: '#374151', tan: '#d2b48c',
};
export function colorToHex(name) {
  if (!name) return '#9ca3af';
  const key = name.toLowerCase().trim();
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  for (const k of Object.keys(COLOR_HEX)) if (key.includes(k)) return COLOR_HEX[k];
  return '#9ca3af';
}

// --- Helpers cho format API mới { rows: [...tree...], lastRow: 0 } ---

function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h);
}

function flattenTree(nodes, out = []) {
  for (const n of nodes) {
    out.push({
      id: n.id,
      name: n.name,
      parentId: n.parent_id ?? null,
      active: n.active === 1,
      image: n.image ?? null,
      thumbUrl: n.thumb_url ?? null,
      hasVariants: n.has_category_variants === 1,
    });
    if (n.children?.length) flattenTree(n.children, out);
  }
  return out;
}

const MOCK_SUPPLIERS = [
  { id: 'sup-1', name: 'Printify', active: true, tiktok: true },
  { id: 'sup-2', name: 'Printful', active: true, tiktok: false },
  { id: 'sup-3', name: 'Gooten',   active: true, tiktok: true },
];
const MOCK_COLORS    = ['Black', 'White', 'Navy'];
const MOCK_SIZES     = ['S', 'M', 'L', 'XL'];
const MOCK_BASES     = [4.99, 6.99, 8.99, 11.99, 14.99, 7.49, 9.49];
const MOCK_SHIPS     = [3.49, 3.99, 4.49, 5.49, 6.99];
const MOCK_PLATFORMS = ['Etsy', 'TikTok Shop', 'Shopify'];

function genMockData(categories) {
  const parentIds = new Set(categories.map((c) => c.parentId).filter(Boolean));
  const leaves = categories.filter((c) => !parentIds.has(c.id));

  const products = [], variants = [], supplierCatalogs = [], variantOffers = [];

  for (const leaf of leaves) {
    const pid = `p${leaf.id}`;
    const h = hashStr(String(leaf.id));

    const code = leaf.name.match(/^[\w\d-]+/)?.[0] ?? String(leaf.id);
    products.push({
      id: pid,
      name: leaf.name,
      code,
      active: leaf.active,
      categoryId: leaf.parentId,
      image: leaf.image,
      attributes: [
        { name: 'Color', values: MOCK_COLORS },
        { name: 'Size',  values: MOCK_SIZES  },
      ],
    });

    for (let ci = 0; ci < MOCK_COLORS.length; ci++)
      for (let si = 0; si < MOCK_SIZES.length; si++)
        variants.push({ id: `v${leaf.id}-${ci}-${si}`, productId: pid, options: { Color: MOCK_COLORS[ci], Size: MOCK_SIZES[si] } });

    const catCount = (h % 3) + 1;
    for (let idx = 0; idx < catCount; idx++) {
      const sup = MOCK_SUPPLIERS[(h + idx) % MOCK_SUPPLIERS.length];
      const catId = `cat-${leaf.id}-${sup.id}`;
      const hc = hashStr(catId);
      supplierCatalogs.push({
        id: catId, supplierId: sup.id, productId: pid,
        name: `${sup.name} – ${leaf.name}`,
        enabled: true, priority: idx + 1, type: 'POD', tiktok: sup.tiktok,
        delivery: [{
          platform: MOCK_PLATFORMS[hc % MOCK_PLATFORMS.length],
          submitDays: 1 + (hc % 2), trackingDays: 2 + (hc % 3),
          inTransitDays: 5 + (hc % 7), deliveredDays: 1 + (hc % 2),
        }],
      });

      for (let ci = 0; ci < MOCK_COLORS.length; ci++)
        for (let si = 0; si < MOCK_SIZES.length; si++) {
          const vid = `v${leaf.id}-${ci}-${si}`;
          const ho = hashStr(`${vid}${catId}`);
          variantOffers.push({
            id: `off-${vid}-${catId}`, variantId: vid, supplierCatalogId: catId,
            baseCost: MOCK_BASES[ho % MOCK_BASES.length],
            shipping: { US: [{ method: 'Standard', first: MOCK_SHIPS[ho % MOCK_SHIPS.length], additional: 1.5 }] },
            fees: [],
            active: true,
          });
        }
    }
  }

  return { products, variants, supplierCatalogs, variantOffers };
}

function normalizeVariantsData(json, productId, productName) {
  const rows = json.rows ?? [];
  const supplierMap = new Map();
  const catalogMap = new Map();

  for (const v of rows) {
    for (const csv of (v.category_supplier_variants ?? [])) {
      const cat = csv.category_catalog;
      const sup = cat?.supplier;
      if (sup && !supplierMap.has(sup.id))
        supplierMap.set(sup.id, { id: sup.id, name: sup.name, active: sup.active !== false, tiktok: sup.has_tiktok_order === 1 });
      if (cat && !catalogMap.has(cat.id))
        catalogMap.set(cat.id, {
          id: cat.id, supplierId: cat.supplier_id, productId,
          name: `${sup?.name ?? cat.supplier_id} – ${productName}`,
          enabled: cat.active === 1, priority: cat.priority ?? 0,
          type: 'POD', tiktok: sup?.has_tiktok_order === 1,
          delivery: [],
        });
    }
  }

  const colorMap = new Map(), sizeMap = new Map();
  for (const v of rows)
    for (const pv of (v.property_values ?? []))
      if (pv.property?.name === 'Color') colorMap.set(pv.name, pv.id);
      else if (pv.property?.name === 'Size') sizeMap.set(pv.name, pv.id);
  const sortByVal = (m) => [...m.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);

  const variants = rows.map((v) => {
    const options = {};
    for (const pv of (v.property_values ?? [])) options[pv.property?.name] = pv.name;
    return { id: v.id, productId, active: v.active === 1, options };
  });

  const variantOffers = [];
  for (const v of rows)
    for (const csv of (v.category_supplier_variants ?? [])) {
      if (!csv.active) continue;
      const ho = hashStr(`${v.id}${csv.category_catalog_id}`);
      variantOffers.push({
        id: `off-${v.id}-${csv.category_catalog_id}`, variantId: v.id,
        supplierCatalogId: csv.category_catalog_id,
        baseCost: MOCK_BASES[ho % MOCK_BASES.length],
        shipping: { US: [{ method: 'Standard', first: MOCK_SHIPS[ho % MOCK_SHIPS.length], additional: 1.5 }] },
        fees: [], active: true,
      });
    }

  return {
    suppliers: [...supplierMap.values()],
    supplierCatalogs: [...catalogMap.values()],
    variants, variantOffers,
    attrs: [
      { name: 'Color', values: sortByVal(colorMap) },
      { name: 'Size',  values: sortByVal(sizeMap)  },
    ],
  };
}

function normalizeApiFormat(raw) {
  const categories = flattenTree(raw.rows ?? []);
  const mock = genMockData(categories);  // { products, variants, supplierCatalogs, variantOffers }
  const suppliers = [...MOCK_SUPPLIERS];

  for (const [pid, variantsJson] of Object.entries(raw.productVariants ?? {})) {
    const leafId = parseInt(pid.replace('p', ''));
    const leaf = categories.find((c) => c.id === leafId);
    if (!leaf) continue;

    const real = normalizeVariantsData(variantsJson, pid, leaf.name);

    mock.variants         = mock.variants.filter((v) => v.productId !== pid).concat(real.variants);
    mock.supplierCatalogs = mock.supplierCatalogs.filter((c) => c.productId !== pid).concat(real.supplierCatalogs);
    mock.variantOffers    = mock.variantOffers.filter((o) => !real.variants.some((v) => v.id === o.variantId))
                              .concat(real.variantOffers);

    const product = mock.products.find((p) => p.id === pid);
    if (product) product.attributes = real.attrs;
    for (const sup of real.suppliers)
      if (!suppliers.some((s) => s.id === sup.id)) suppliers.push(sup);
  }

  return { categories, suppliers, ...mock };
}

// ---

/** Adapter: chỗ duy nhất phụ thuộc vào cấu trúc JSON nguồn. */
export function normalizeRaw(raw) {
  if (raw.rows != null) return normalizeApiFormat(raw);
  return {
    categories: raw.categories ?? [],
    suppliers: raw.suppliers ?? [],
    products: raw.products ?? [],
    variants: raw.variants ?? [],
    supplierCatalogs: raw.supplierCatalogs ?? [],
    variantOffers: raw.variantOffers ?? [],
  };
}

const pickStd = (list) => (list ?? []).find((s) => /standard/i.test(s.method)) ?? (list ?? [])[0] ?? null;
const deliveryTotal = (d) => DELIVERY_SEGMENTS.reduce((s, seg) => s + (d[seg.key] || 0), 0);

export function variantLabel(variant, attrs) {
  return attrs.map((a) => variant.options[a.name]).join(' / ');
}

export function buildModel(input) {
  const raw = normalizeRaw(input);
  const supplierById = new Map(raw.suppliers.map((s) => [s.id, s]));
  const catById = new Map(raw.categories.map((c) => [c.id, { ...c, children: [] }]));
  for (const c of catById.values()) if (c.parentId && catById.has(c.parentId)) catById.get(c.parentId).children.push(c);
  const rootCats = [...catById.values()].filter((c) => !c.parentId || !catById.has(c.parentId));
  const catPath = (id) => {
    const path = [];
    let c = catById.get(id);
    while (c) { path.unshift(c); c = c.parentId ? catById.get(c.parentId) : null; }
    return path;
  };

  const catalogById = new Map();
  for (const sc of raw.supplierCatalogs) {
    const delivery = (sc.delivery ?? []).map((d) => ({ ...d, total: round2(deliveryTotal(d)) }));
    catalogById.set(sc.id, { ...sc, supplier: supplierById.get(sc.supplierId) ?? { id: sc.supplierId, name: sc.supplierId }, delivery });
  }

  const offersByVariant = new Map();
  for (const o of raw.variantOffers) {
    const catalog = catalogById.get(o.supplierCatalogId);
    if (!catalog) continue;
    const usStd = pickStd(o.shipping?.US);
    const euStd = pickStd(o.shipping?.EU);
    const offer = {
      ...o, catalog, supplier: catalog.supplier, usStd, euStd,
      totalMin: round2(o.baseCost + (usStd?.first ?? 0)),
      usable: o.active !== false && o.stock !== 'inactive' && catalog.enabled !== false,
    };
    if (!offersByVariant.has(o.variantId)) offersByVariant.set(o.variantId, []);
    offersByVariant.get(o.variantId).push(offer);
  }

  const variantsByProduct = new Map();
  for (const v of raw.variants) {
    if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
    variantsByProduct.get(v.productId).push(v);
  }

  const products = raw.products.map((p) => {
    const attrs = p.attributes ?? [];
    const catalogs = raw.supplierCatalogs
      .filter((sc) => sc.productId === p.id)
      .map((sc) => catalogById.get(sc.id))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const prioIndex = new Map(catalogs.map((c, i) => [c.id, i]));

    const variants = (variantsByProduct.get(p.id) ?? []).map((v) => {
      const offers = (offersByVariant.get(v.id) ?? [])
        .slice()
        .sort((a, b) => prioIndex.get(a.catalog.id) - prioIndex.get(b.catalog.id));
      const cheapest = offers.reduce((m, o) => (!m || o.totalMin < m.totalMin ? o : m), null);
      const routed = offers.find((o) => o.usable) ?? null;
      return {
        ...v, label: variantLabel(v, attrs), offers, cheapest, routed,
        sourceCount: offers.length, usableCount: offers.filter((o) => o.usable).length,
      };
    });

    const allOffers = variants.flatMap((v) => v.offers);
    const bases = allOffers.map((o) => o.baseCost);
    const ships = allOffers.map((o) => o.usStd?.first).filter((n) => n != null);
    const totals = allOffers.map((o) => o.totalMin);
    let fastest = null;
    for (const c of catalogs) for (const d of c.delivery) if (!fastest || d.total < fastest.total) fastest = { ...d, catalog: c };

    const coverage = { none: 0, one: 0, safe: 0 };
    for (const v of variants) coverage[v.sourceCount === 0 ? 'none' : v.sourceCount === 1 ? 'one' : 'safe'] += 1;

    const issues = [];
    if (catalogs.length === 0) issues.push({ level: 'critical', type: 'no-catalog', text: 'Chưa map catalog supplier nào', tab: 'suppliers' });
    else {
      for (const v of variants) {
        if (v.sourceCount === 0) issues.push({ level: 'critical', type: 'no-source', text: `${v.label}: chưa có supplier nào`, variantId: v.id, tab: 'variants' });
        else if (v.sourceCount === 1) issues.push({ level: 'warning', type: 'single-source', text: `${v.label}: chỉ 1 supplier (${v.offers[0].supplier.name})`, variantId: v.id, tab: 'variants' });
        if (v.cheapest && v.routed && v.cheapest.id !== v.routed.id && !v.cheapest.usable)
          issues.push({ level: 'warning', type: 'cheapest-off', text: `${v.label}: nguồn rẻ nhất (${v.cheapest.supplier.name}) đang hết kho → đơn đi ${v.routed.supplier.name}, đắt hơn ${money(v.routed.totalMin - v.cheapest.totalMin)}`, variantId: v.id, tab: 'variants' });
      }
      for (const c of catalogs)
        if (c.productType && p.productType && c.productType !== p.productType)
          issues.push({ level: 'critical', type: 'type-mismatch', text: `“${c.name}” khác loại sản phẩm (${c.productType} ≠ ${p.productType}): nghi map nhầm`, catalogId: c.id, tab: 'suppliers' });
    }
    issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1));

    const platforms = {};
    for (const c of catalogs) for (const d of c.delivery) platforms[d.platform] = (platforms[d.platform] ?? 0) + 1;
    const range = (arr) => (arr.length ? [Math.min(...arr), Math.max(...arr)] : null);

    return {
      ...p, attrs, variants, catalogs,
      categoryPath: catPath(p.categoryId),
      suppliers: [...new Map(catalogs.map((c) => [c.supplier.id, c.supplier])).values()],
      metrics: {
        variantCount: variants.length, catalogCount: catalogs.length,
        supplierCount: new Set(catalogs.map((c) => c.supplierId)).size,
        tiktokCount: catalogs.filter((c) => c.tiktok).length,
        baseRange: range(bases), shipRange: range(ships), bestTotal: totals.length ? Math.min(...totals) : null,
        fastest, coverage, platforms,
        missing: catalogs.length === 0 || coverage.none === variants.length,
        hasGap: coverage.none > 0, singleSource: coverage.one > 0,
      },
      issues,
    };
  });

  const productById = new Map(products.map((p) => [p.id, p]));
  const productsInCat = (cat) => [
    ...products.filter((p) => p.categoryId === cat.id),
    ...cat.children.flatMap(productsInCat),
  ];
  for (const c of catById.values()) {
    const list = productsInCat(c);
    c.productCount = list.length;
    c.issueCount = list.filter((p) => p.metrics.missing || p.metrics.hasGap).length;
  }

  const searchIndex = [
    ...products.map((p) => ({ type: 'Sản phẩm', label: p.name, sub: p.categoryPath.map((c) => c.name).join(' › '), keys: `${p.name} ${p.code}`, route: `/p/${p.id}` })),
    ...products.flatMap((p) => p.variants.map((v) => ({ type: 'Variant', label: `#${v.id} · ${v.label}`, sub: p.name, keys: `${v.id} ${v.label} ${p.code}`, route: `/p/${p.id}/variants?v=${v.id}` }))),
    ...raw.suppliers.map((s) => ({ type: 'Supplier', label: s.name, sub: `${products.filter((p) => p.suppliers.some((x) => x.id === s.id)).length} sản phẩm`, keys: s.name, route: `/?supplier=${s.id}` })),
    ...[...catalogById.values()].map((c) => ({ type: 'Catalog supplier', label: c.name, sub: `${c.supplier.name}${c.provider ? ` (${c.provider})` : ''} · ${productById.get(c.productId)?.name ?? ''}`, keys: `${c.name} ${c.supplier.name}`, route: `/p/${c.productId}/suppliers` })),
  ];

  return { raw, suppliers: raw.suppliers, supplierById, rootCats, catById, products, productById, searchIndex };
}
