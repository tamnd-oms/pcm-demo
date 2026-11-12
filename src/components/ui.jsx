import { DELIVERY_SEGMENTS, days } from '../lib/model.js';

export function Badge({ tone = 'neutral', children, title }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export function SupplierAvatar({ supplier, size = 24 }) {
  const initials = supplier.name.slice(0, 2).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, background: supplier.color ?? '#64748b', fontSize: size * 0.4 }} title={supplier.name}>
      {initials}
    </span>
  );
}

export function AvatarStack({ suppliers, max = 5 }) {
  const shown = suppliers.slice(0, max);
  return (
    <span className="avatar-stack">
      {shown.map((s) => <SupplierAvatar key={s.id} supplier={s} size={22} />)}
      {suppliers.length > max && <span className="avatar avatar-more">+{suppliers.length - max}</span>}
    </span>
  );
}

export function Kpi({ value, label, tone, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`kpi ${tone ? `kpi-${tone}` : ''} ${active ? 'is-active' : ''}`} onClick={onClick}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </Tag>
  );
}

/** Thanh ngày giao 4 đoạn: Submit / Tracking / In-transit / Delivered (giữ màu như hệ thống cũ). */
export function DeliveryBar({ d, scale = 10, showTotal = true, compact }) {
  return (
    <div className={`delivery ${compact ? 'is-compact' : ''}`}>
      <span className="delivery-platform">{d.platform}</span>
      <div className="delivery-track">
        {DELIVERY_SEGMENTS.map((s) => d[s.key] > 0 && (
          <span key={s.key} className={`seg ${s.cls}`} style={{ width: `${(d[s.key] / scale) * 100}%` }} title={`${s.label}: ${d[s.key]} ngày`}>
            {!compact && d[s.key] / scale >= 0.09 ? d[s.key].toFixed(1) : ''}
          </span>
        ))}
      </div>
      {showTotal && <b className="delivery-total">{days(d.total)}</b>}
    </div>
  );
}

export function DeliveryLegend() {
  return (
    <div className="legend">
      {DELIVERY_SEGMENTS.map((s) => <span key={s.key}><i className={`seg ${s.cls}`} />{s.label}</span>)}
    </div>
  );
}

export function CoverageBar({ coverage, total }) {
  if (!total) return null;
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className="coverage" title={`${coverage.safe} an toàn · ${coverage.one} chỉ 1 nguồn · ${coverage.none} chưa có nguồn`}>
      <span className="cov-safe" style={{ width: pct(coverage.safe) }} />
      <span className="cov-one" style={{ width: pct(coverage.one) }} />
      <span className="cov-none" style={{ width: pct(coverage.none) }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle" title={label}>
      <input type="checkbox" checked={!!checked} onChange={onChange} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}

export function Thumb({ product, size = 56 }) {
  const hue = [...product.code].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return product.image
    ? <img className="thumb" src={product.image} alt="" style={{ width: size, height: size }} />
    : (
      <span className="thumb" style={{ width: size, height: size, background: `hsl(${hue} 45% 92%)`, color: `hsl(${hue} 40% 35%)` }}>
        {product.code.slice(0, 4)}
      </span>
    );
}

export function Toast({ text }) {
  return <div className={`toast ${text ? 'is-on' : ''}`} role="status">{text}</div>;
}
