import { useState } from 'react';
import { money } from '../lib/model.js';
import { Badge, DeliveryBar, SupplierAvatar } from './ui.jsx';

export function offerBadges(offers) {
  if (!offers.length) return {};
  const minTotal = Math.min(...offers.map((o) => o.totalMin));
  const minBase = Math.min(...offers.map((o) => o.baseCost));
  const routed = offers.find((o) => o.usable);
  const res = {};
  for (const o of offers) {
    res[o.id] = [];
    if (o === routed) res[o.id].push({ tone: 'accent', text: 'Đơn đang đi' });
    if (o.totalMin === minTotal && offers.length > 1) res[o.id].push({ tone: 'good', text: 'Tổng rẻ nhất' });
    if (o.baseCost === minBase && o.totalMin !== minTotal && offers.length > 1) res[o.id].push({ tone: 'neutral', text: 'Base rẻ nhất' });
  }
  return res;
}

/** Cảnh báo khi nguồn rẻ nhất không phải nguồn đang nhận đơn. */
export function routingAlert(offers) {
  const routed = offers.find((o) => o.usable);
  if (!routed || offers.length < 2) return null;
  const cheapest = offers.reduce((m, o) => (o.totalMin < m.totalMin ? o : m));
  if (cheapest.id === routed.id) return null;
  const diff = money(routed.totalMin - cheapest.totalMin);
  return cheapest.usable
    ? `${cheapest.supplier.name} rẻ hơn ${diff} nhưng đang xếp ưu tiên thấp hơn ${routed.supplier.name}. Kéo lên đầu để tiết kiệm ${diff}/đơn.`
    : `Nguồn rẻ nhất (${cheapest.supplier.name}) đang ${cheapest.stock === 'inactive' ? 'hết kho' : 'tắt'} → đơn đi ${routed.supplier.name}, đắt hơn ${diff}.`;
}

export default function OfferCard({ offer, badges = [], rank, compact, dragProps }) {
  const [open, setOpen] = useState(false);
  const c = offer.catalog;
  const feeText = offer.fees.map((f) => `${f.name} ${money(f.amount)}`).join(' · ');
  const highlight = badges.some((b) => b.text === 'Tổng rẻ nhất');
  const { className: dragCls = '', ...dp } = dragProps ?? {};
  return (
    <div className={`offer ${highlight ? 'is-best' : ''} ${compact ? 'is-compact' : ''} ${dragCls}`} {...dp}>
      <div className="offer-head">
        {dragProps && <span className="drag-handle" title="Kéo để đổi ưu tiên">⋮⋮</span>}
        {rank != null && <span className="rank">{rank}</span>}
        <SupplierAvatar supplier={offer.supplier} />
        <div className="offer-title">
          <b>{offer.supplier.name}{c.provider ? ` (${c.provider})` : ''}</b>
          <span className="muted small ellipsis" title={c.name}>{c.name}</span>
        </div>
        <div className="offer-badges">{badges.map((b) => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}</div>
      </div>

      <div className="offer-sum">
        <span>{money(offer.baseCost)} <span className="muted">base</span></span>
        <span className="muted">+</span>
        <span>{money(offer.usStd?.first)} <span className="muted">ship US</span></span>
        <span className="muted">=</span>
        <b className="offer-total">{money(offer.totalMin)}</b>
      </div>

      <div className="offer-meta">
        <span className={offer.stock === 'inactive' ? 'text-critical' : 'text-good'}>
          ● Kho: {offer.stock === 'inactive' ? 'In-active' : 'Active'}
        </span>
        {!compact && feeText && <span className="muted small">{feeText}</span>}
      </div>

      {!compact && c.delivery.map((d) => <DeliveryBar key={d.platform} d={d} scale={10} />)}

      <button className="link-btn" onClick={() => setOpen(!open)}>{open ? 'Ẩn bảng giá ▴' : 'Bảng giá chi tiết ▾'}</button>
      {open && (
        <table className="price-table">
          <thead><tr><th>Vùng</th><th>Phương thức</th><th>Item đầu</th><th>Item thêm</th><th>Phụ phí</th></tr></thead>
          <tbody>
            {Object.entries(offer.shipping).flatMap(([zone, list]) => list.map((s, i) => (
              <tr key={zone + s.method}>
                <td>{i === 0 ? zone : ''}</td><td>{s.method}</td><td>{money(s.first)}</td><td>{money(s.additional)}</td><td>{money(s.surcharge)}</td>
              </tr>
            )))}
            {offer.fees.length > 0 && (
              <tr className="fees-row"><td>Phí</td><td colSpan={4}>{feeText}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
