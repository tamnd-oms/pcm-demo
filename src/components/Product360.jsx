import { useMemo, useState } from 'react';
import { colorToHex, days, money } from '../lib/model.js';
import { navigate } from '../lib/router.js';
import { Badge, SupplierAvatar, Thumb } from './ui.jsx';
import VariantMatrix from './VariantMatrix.jsx';
import SupplierTab from './SupplierTab.jsx';

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'variants', label: 'Variant' },
  { key: 'suppliers', label: 'Supplier' },
];

const SELL_MARKUP = 3;

function shipOptionsFromProduct(product) {
  const map = new Map();
  for (const v of product.variants) {
    for (const o of v.offers) {
      for (const [zone, methods] of Object.entries(o.shipping ?? {})) {
        for (const m of methods ?? []) {
          const key = `${zone}|${m.method}`;
          if (!map.has(key)) map.set(key, { key, zone, method: m.method, label: `${zone} ${m.method}` });
        }
      }
    }
  }
  const options = [...map.values()];
  const preferred = options.find((o) => o.zone === 'US' && /standard/i.test(o.method));
  if (preferred) options.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0));
  return options;
}

function shipPriceOfOffer(offer, shipOpt) {
  if (!shipOpt) return 0;
  const list = offer.shipping?.[shipOpt.zone] ?? [];
  const item = list.find((s) => s.method === shipOpt.method);
  return item?.first ?? 0;
}

function supportTags(catalog) {
  const tags = [];
  if (catalog.tiktok) tags.push({ tone: 'accent', text: 'TikTok' });
  if (catalog.priority === 1) tags.push({ tone: 'good', text: 'Ưu tiên 1' });
  if (catalog.labelSupport) tags.push({ tone: 'neutral', text: 'Label support' });
  if (catalog.rush) tags.push({ tone: 'warning', text: 'Rush' });
  return tags;
}

function buildCatalogRow(catalog, variants, shipOpt) {
  const offers = variants.flatMap((v) => v.offers.filter((o) => o.catalog.id === catalog.id).map((o) => ({ ...o, _variant: v })));
  if (offers.length === 0) return null;
  const bases = offers.map((o) => o.baseCost);
  const baseMin = Math.min(...bases);
  const baseMax = Math.max(...bases);
  const shipPrice = shipPriceOfOffer(offers[0], shipOpt);
  const totalMin = baseMin + shipPrice;
  const sellPrice = baseMin * SELL_MARKUP;
  const profit = sellPrice - totalMin;
  const sizes = new Set(), colors = new Set();
  for (const o of offers) {
    const opts = o._variant.options ?? {};
    if (opts.Size) sizes.add(opts.Size);
    if (opts.Color) colors.add(opts.Color);
  }
  return {
    catalog, baseMin, baseMax, shipPrice, totalMin, sellPrice, profit,
    sizes: [...sizes], colors: [...colors],
    tags: supportTags(catalog),
  };
}

const SORT_FNS = {
  base: (a, b) => a.baseMin - b.baseMin,
  ship: (a, b) => a.shipPrice - b.shipPrice,
  total: (a, b) => a.totalMin - b.totalMin,
  profit: (a, b) => b.profit - a.profit,
};
const SORT_LABEL = {
  base: 'Base cost',
  ship: 'Ship',
  total: 'Base + Ship',
  profit: 'Lợi nhuận/đơn',
};

function SortKpi({ sortKey, active, onClick, value, label, tone, children }) {
  return (
    <div
      className={`kpi kpi-sortable ${tone ? `kpi-${tone}` : ''} ${active ? 'is-sorted' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      aria-pressed={active}
      data-sort={sortKey}
    >
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">
        {label} <span className="kpi-sort-arrow" aria-hidden>↕</span>
      </div>
      {children}
    </div>
  );
}

function SupplierRow({ row, isBest }) {
  const { catalog, baseMin, shipPrice, totalMin, profit, sizes, colors, tags } = row;
  const shownColors = colors.slice(0, 6);
  const moreColors = colors.length - shownColors.length;
  return (
    <div className={`supplier-row ${isBest ? 'is-best' : ''}`}>
      <div className="sr-head">
        <SupplierAvatar supplier={catalog.supplier} size={40} />
        <div className="sr-title">
          <b className="sr-name">{catalog.supplier.name}</b>
          <span className="muted small ellipsis" title={catalog.name}>{catalog.name}</span>
        </div>
        <div className="sr-tags">
          {tags.length === 0
            ? <span className="muted small">—</span>
            : tags.map((t) => <Badge key={t.text} tone={t.tone}>{t.text}</Badge>)}
        </div>
      </div>

      <div className="sr-grid">
        <div className="sr-field">
          <div className="sr-field-label">Price</div>
          <div className="sr-price-main">Từ <b>{money(totalMin)}</b></div>
          <div className="muted small">
            base {money(baseMin)} + ship {money(shipPrice)}
          </div>
          <div className="muted small">Lợi nhuận ~ {money(profit)}</div>
        </div>
        <div className="sr-field">
          <div className="sr-field-label">Print area</div>
          <span className="muted">—</span>
        </div>
        <div className="sr-field">
          <div className="sr-field-label">Sizes</div>
          <div className="sr-sizes">
            {sizes.length === 0
              ? <span className="muted">—</span>
              : sizes.map((s) => <span key={s} className="sr-size">{s}</span>)}
          </div>
        </div>
        <div className="sr-field">
          <div className="sr-field-label">Colors</div>
          <div className="sr-colors">
            {colors.length === 0
              ? <span className="muted">—</span>
              : (
                <>
                  {shownColors.map((c) => (
                    <span key={c} className="sr-color" title={c}>
                      <span className="swatch-dot" style={{ background: colorToHex(c) }} />
                      {c}
                    </span>
                  ))}
                  {moreColors > 0 && <span className="muted small">+{moreColors}</span>}
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Overview({ product }) {
  const m = product.metrics;
  const [sortBy, setSortBy] = useState('total');
  const shipOptions = useMemo(() => shipOptionsFromProduct(product), [product]);
  const [shipOptKey, setShipOptKey] = useState(() => shipOptions[0]?.key ?? '');
  const shipOpt = shipOptions.find((o) => o.key === shipOptKey) ?? shipOptions[0];

  const rows = useMemo(() => {
    const built = product.catalogs
      .map((c) => buildCatalogRow(c, product.variants, shipOpt))
      .filter(Boolean);
    return built.sort(SORT_FNS[sortBy]);
  }, [product, shipOpt, sortBy]);

  const totals = useMemo(() => {
    if (rows.length === 0) return null;
    return {
      baseMin: Math.min(...rows.map((r) => r.baseMin)),
      baseMax: Math.max(...rows.map((r) => r.baseMax)),
      shipMin: Math.min(...rows.map((r) => r.shipPrice)),
      shipMax: Math.max(...rows.map((r) => r.shipPrice)),
      totalMin: Math.min(...rows.map((r) => r.totalMin)),
      profitMax: Math.max(...rows.map((r) => r.profit)),
    };
  }, [rows]);

  const [a1, a2] = product.attrs;
  const bestCatalogId = rows[0]?.catalog.id;

  return (
    <div className="overview">
      <div className="kpis">
        <SortKpi
          sortKey="base"
          active={sortBy === 'base'}
          onClick={() => setSortBy('base')}
          value={totals ? `${money(totals.baseMin)} – ${money(totals.baseMax)}` : '—'}
          label="Base cost"
        />
        <SortKpi
          sortKey="ship"
          active={sortBy === 'ship'}
          onClick={() => setSortBy('ship')}
          value={totals ? `${money(totals.shipMin)} – ${money(totals.shipMax)}` : '—'}
          label="Ship"
        >
          {shipOptions.length > 0 && (
            <select
              className="select select-sm kpi-ship-select"
              value={shipOpt?.key ?? ''}
              onChange={(e) => setShipOptKey(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Chọn loại ship"
            >
              {shipOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          )}
        </SortKpi>
        <SortKpi
          sortKey="total"
          active={sortBy === 'total'}
          onClick={() => setSortBy('total')}
          value={totals ? money(totals.totalMin) : '—'}
          label="Base + Ship"
          tone="good"
        />
        <SortKpi
          sortKey="profit"
          active={sortBy === 'profit'}
          onClick={() => setSortBy('profit')}
          value={totals ? money(totals.profitMax) : '—'}
          label={`Lợi nhuận/đơn (markup ${SELL_MARKUP}x)`}
          tone="good"
        />
      </div>

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Supplier so sánh</h2>
            <span className="muted small">
              Đang sort theo <b>{SORT_LABEL[sortBy]}</b>
              {sortBy === 'ship' && shipOpt ? ` · ${shipOpt.label}` : ''}
            </span>
          </div>
          {rows.length === 0 && (
            <div className="empty">
              Sản phẩm chưa có supplier catalog nào.{' '}
              <button className="link-btn" onClick={() => navigate(`/p/${product.id}/suppliers`)}>Map supplier →</button>
            </div>
          )}
          <div className="supplier-list">
            {rows.map((r) => (
              <SupplierRow key={r.catalog.id} row={r} isBest={r.catalog.id === bestCatalogId && rows.length > 1} />
            ))}
          </div>
          {a1 && a2 && (
            <button className="link-btn mt" onClick={() => navigate(`/p/${product.id}/variants`)}>
              Xem toàn bộ {m.variantCount} variant dạng ma trận {a1.name} × {a2.name} →
            </button>
          )}
        </section>

        <aside className="panel">
          <div className="panel-head"><h2>Cần xử lý</h2></div>
          {product.issues.length === 0 && <p className="muted">Không có vấn đề. Mọi variant đã có ≥ 2 nguồn.</p>}
          <ul className="issues">
            {product.issues.slice(0, 12).map((it, i) => (
              <li key={i}>
                <button onClick={() => navigate(`/p/${product.id}/${it.tab}${it.variantId ? `?v=${it.variantId}` : ''}`)}>
                  <span className={`dot dot-${it.level}`} />
                  <span>{it.text}</span>
                </button>
              </li>
            ))}
          </ul>
          {product.issues.length > 12 && <p className="muted small">+ {product.issues.length - 12} mục khác — xem tab Variant</p>}

          <div className="panel-head mt"><h2>Giao nhanh nhất</h2></div>
          {m.fastest
            ? <p><b>{days(m.fastest.total)}</b> · {m.fastest.catalog.supplier.name} · {m.fastest.platform}</p>
            : <p className="muted">Chưa có dữ liệu Track17.</p>}
        </aside>
      </div>
    </div>
  );
}

export default function Product360({ product, tab, query, actions }) {
  const m = product.metrics;
  const current = TABS.some((t) => t.key === tab) ? tab : 'overview';
  const counts = { variants: m.variantCount, suppliers: m.catalogCount };

  return (
    <div className="p360">
      <header className="p360-head">
        <Thumb product={product} size={72} />
        <div className="p360-title">
          <div className="muted small">{product.categoryPath.map((c) => c.name).join(' › ')}</div>
          <h1>{product.name}</h1>
          <div className="p360-meta">
            {m.missing ? <Badge tone="critical">Thiếu nguồn</Badge> : <Badge tone={product.active ? 'good' : 'muted'}>{product.active ? 'Active' : 'Inactive'}</Badge>}
            <span className="muted">
              {product.attrs.map((a) => `${a.values.length} ${a.name.toLowerCase()}`).join(' · ')} · {m.supplierCount} supplier · {m.catalogCount} catalog
            </span>
          </div>
        </div>
        <div className="p360-actions">
          <button className="btn btn-outline" onClick={() => actions.notify('Mở wizard Map catalog (mockup 4)')}>Map catalog</button>
          <button className="btn btn-primary" onClick={() => actions.notify('Mở form Sinh variant')}>Sinh variant</button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <a key={t.key} role="tab" aria-selected={current === t.key} className={`tab ${current === t.key ? 'is-active' : ''}`}
            href={`#/p/${product.id}${t.key === 'overview' ? '' : `/${t.key}`}${query.v ? `?v=${query.v}` : ''}`}>
            {t.label}{counts[t.key] != null && <span className="tab-count">{counts[t.key]}</span>}
          </a>
        ))}
      </nav>

      {current === 'overview' && <Overview product={product} />}
      {current === 'variants' && <VariantMatrix product={product} query={query} actions={actions} />}
      {current === 'suppliers' && <SupplierTab product={product} actions={actions} />}
    </div>
  );
}
