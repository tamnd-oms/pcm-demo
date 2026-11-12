import { useMemo, useState } from 'react';
import { money } from '../lib/model.js';
import { Badge, DeliveryBar, DeliveryLegend, SupplierAvatar, Toggle } from './ui.jsx';

const SORTS = {
  priority: 'Thứ tự ưu tiên',
  fast: 'Giao nhanh nhất',
  cheap: 'Base cost thấp nhất',
};

export default function SupplierTab({ product, actions }) {
  const [sort, setSort] = useState('priority');
  const [dragId, setDragId] = useState(null);

  const rows = useMemo(() => {
    const stats = product.catalogs.map((c) => {
      const offers = product.variants.flatMap((v) => v.offers.filter((o) => o.catalog.id === c.id));
      const fastest = c.delivery.reduce((m, d) => (!m || d.total < m.total ? d : m), null);
      return {
        c, fastest,
        covered: new Set(offers.map((o) => o.variantId)).size,
        minBase: offers.length ? Math.min(...offers.map((o) => o.baseCost)) : null,
        mismatch: product.issues.some((i) => i.catalogId === c.id),
      };
    });
    if (sort === 'fast') return [...stats].sort((a, b) => (a.fastest?.total ?? 1e9) - (b.fastest?.total ?? 1e9));
    if (sort === 'cheap') return [...stats].sort((a, b) => (a.minBase ?? 1e9) - (b.minBase ?? 1e9));
    return stats;
  }, [product, sort]);

  const maxDays = Math.max(10, ...rows.flatMap((r) => r.c.delivery.map((d) => d.total)));

  const drop = (targetId) => {
    if (!dragId || dragId === targetId || sort !== 'priority') return;
    const ids = product.catalogs.map((c) => c.id);
    const from = ids.indexOf(dragId);
    ids.splice(from, 1);
    ids.splice(ids.indexOf(targetId) + (from <= ids.indexOf(targetId) ? 1 : 0), 0, dragId);
    actions.reorderCatalogs(ids);
    setDragId(null);
  };

  if (!product.catalogs.length) {
    return (
      <section className="panel empty-state">
        <h2>Chưa có catalog supplier nào</h2>
        <p className="muted">Map catalog từ bảng báo giá của supplier để sản phẩm có nguồn hàng.</p>
        <button className="btn btn-primary" onClick={() => actions.notify('Mở wizard Map catalog (mockup 4)')}>+ Map catalog đầu tiên</button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head wrap">
        <h2>{product.catalogs.length} catalog từ {product.metrics.supplierCount} supplier</h2>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <DeliveryLegend />
      </div>
      {sort !== 'priority' && <p className="muted small">Chuyển về “Thứ tự ưu tiên” để kéo thả đổi priority.</p>}

      <div className="sup-list">
        {rows.map(({ c, covered, minBase, mismatch }, i) => (
          <div key={c.id}
            className={`sup-row ${mismatch ? 'is-critical' : ''} ${!c.enabled ? 'is-off' : ''} ${dragId === c.id ? 'is-dragging' : ''}`}
            draggable={sort === 'priority'}
            onDragStart={() => setDragId(c.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(c.id)}>
            {sort === 'priority' && <span className="drag-handle" title="Kéo để đổi ưu tiên">⋮⋮</span>}
            <span className="rank">{i + 1}</span>
            <SupplierAvatar supplier={c.supplier} size={32} />
            <div className="sup-info">
              <b>{c.supplier.name}{c.provider ? ` (${c.provider})` : ''}</b>
              <span className="muted small ellipsis" title={c.name}>#{c.id} · {c.name}</span>
              {mismatch && <span className="text-critical small">✕ Khác loại sản phẩm — nghi map nhầm</span>}
              {i === 0 && sort === 'priority' && <span><Badge tone="accent">Nhận đơn đầu tiên</Badge></span>}
            </div>
            <div className="sup-stats">
              <span><b>{covered}</b>/{product.metrics.variantCount} variant</span>
              <span className="muted small">Base từ {money(minBase)}</span>
            </div>
            <div className="sup-delivery">
              {c.delivery.length
                ? c.delivery.map((d) => <DeliveryBar key={d.platform} d={d} scale={maxDays} />)
                : <span className="muted small">Chưa có dữ liệu Track17</span>}
              {c.processingDays != null && <span className="muted small">Processing {c.processingDays} ngày</span>}
            </div>
            <div className="sup-toggles">
              <Toggle checked={c.enabled} onChange={() => actions.toggleCatalog(c.id, 'enabled')} label="Enable" />
              <Toggle checked={c.tiktok} onChange={() => actions.toggleCatalog(c.id, 'tiktok')} label="TikTok" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
