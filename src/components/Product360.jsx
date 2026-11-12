import { useMemo } from 'react';
import { money, days } from '../lib/model.js';
import { navigate, setQuery } from '../lib/router.js';
import { Badge, Kpi, Thumb } from './ui.jsx';
import OfferCard, { offerBadges, routingAlert } from './OfferCard.jsx';
import VariantMatrix from './VariantMatrix.jsx';
import SupplierTab from './SupplierTab.jsx';

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'variants', label: 'Variant' },
  { key: 'suppliers', label: 'Supplier' },
];

function Overview({ product, query }) {
  const m = product.metrics;
  // Variant để so sánh: theo URL ?v=, mặc định variant có nhiều nguồn nhất.
  const variant = useMemo(() => {
    const byId = product.variants.find((v) => String(v.id) === query.v);
    return byId ?? [...product.variants].sort((a, b) => b.sourceCount - a.sourceCount)[0];
  }, [product, query.v]);
  const offers = variant ? [...variant.offers].sort((a, b) => a.totalMin - b.totalMin) : [];
  const badges = offerBadges(variant?.offers ?? []);
  const alert = variant ? routingAlert(variant.offers) : null;
  const [a1, a2] = product.attrs;

  return (
    <div className="overview">
      <div className="kpis">
        <Kpi value={m.baseRange ? `${money(m.baseRange[0])} – ${money(m.baseRange[1])}` : '—'} label="Base cost" />
        <Kpi value={m.shipRange ? `${money(m.shipRange[0])} – ${money(m.shipRange[1])}` : '—'} label="Ship US Standard (item đầu)" />
        <Kpi value={money(m.bestTotal)} label="Tổng thấp nhất (base + ship)" tone="good" />
        <Kpi value={product.issues.length} label="Việc cần xử lý" tone={product.issues.length ? 'critical' : undefined} />
      </div>

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>So sánh supplier</h2>
            {variant && (
              <select className="select" value={variant.id} onChange={(e) => setQuery({ v: e.target.value })}>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>#{v.id} · {v.label} ({v.sourceCount} nguồn)</option>
                ))}
              </select>
            )}
          </div>
          {alert && <div className="alert alert-warning">⚠ {alert}</div>}
          {offers.length === 0 && <div className="empty">Variant này chưa có supplier. <button className="link-btn" onClick={() => navigate(`/p/${product.id}/suppliers`)}>Map supplier →</button></div>}
          <div className="offer-grid">
            {offers.map((o) => <OfferCard key={o.id} offer={o} badges={badges[o.id]} />)}
          </div>
          {a1 && a2 && (
            <button className="link-btn" onClick={() => navigate(`/p/${product.id}/variants${variant ? `?v=${variant.id}` : ''}`)}>
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

      {current === 'overview' && <Overview product={product} query={query} />}
      {current === 'variants' && <VariantMatrix product={product} query={query} actions={actions} />}
      {current === 'suppliers' && <SupplierTab product={product} actions={actions} />}
    </div>
  );
}
