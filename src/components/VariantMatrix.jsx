import { useMemo, useState } from 'react';
import { money } from '../lib/model.js';
import { setQuery } from '../lib/router.js';
import OfferCard, { offerBadges, routingAlert } from './OfferCard.jsx';

const LAYERS = {
  count: { label: 'Số supplier', hint: 'Số supplier đã map cho variant' },
  price: { label: 'Giá tốt nhất', hint: 'Base + ship US Standard thấp nhất' },
  stock: { label: 'Còn hàng', hint: 'Số nguồn đang còn kho / tổng nguồn' },
};

const tone = (v) => (!v || v.sourceCount === 0 ? 'none' : v.usableCount === 0 ? 'none' : v.sourceCount === 1 ? 'one' : 'safe');

function Drawer({ product, variant, actions, onClose }) {
  const [dragId, setDragId] = useState(null);
  const badges = offerBadges(variant.offers);
  const alert = routingAlert(variant.offers);

  const drop = (targetCatalogId) => {
    if (!dragId || dragId === targetCatalogId) return;
    const ids = product.catalogs.map((c) => c.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetCatalogId) + (product.catalogs.findIndex((c) => c.id === dragId) < product.catalogs.findIndex((c) => c.id === targetCatalogId) ? 1 : 0), 0, dragId);
    actions.reorderCatalogs(ids);
    setDragId(null);
  };

  return (
    <aside className="drawer" aria-label={`Supplier của ${variant.label}`}>
      <div className="drawer-head">
        <div>
          <h2>{variant.label}</h2>
          <div className="muted small">ID {variant.id} · {variant.sourceCount} supplier · xếp theo thứ tự ưu tiên</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
      {alert && <div className="alert alert-warning">⚠ {alert}</div>}
      {variant.offers.length === 0 && (
        <div className="alert alert-critical">Chưa có supplier nào cho variant này.</div>
      )}
      <div className="drawer-list">
        {variant.offers.map((o, i) => (
          <OfferCard key={o.id} offer={o} rank={i + 1} badges={badges[o.id]}
            dragProps={{
              draggable: true,
              onDragStart: () => setDragId(o.catalog.id),
              onDragOver: (e) => e.preventDefault(),
              onDrop: () => drop(o.catalog.id),
              className: dragId === o.catalog.id ? 'is-dragging' : undefined,
            }} />
        ))}
      </div>
      <div className="drawer-foot">
        <button className="btn btn-primary" onClick={() => actions.notify('Mở wizard Map catalog cho variant này')}>+ Map supplier</button>
        <span className="muted small">Kéo ⋮⋮ để đổi ưu tiên</span>
      </div>
    </aside>
  );
}

export default function VariantMatrix({ product, query, actions }) {
  const [layer, setLayer] = useState('count');
  const [selected, setSelected] = useState(() => new Set());
  const [rowAttr, colAttr, ...rest] = product.attrs;
  const [extra, setExtra] = useState(() => Object.fromEntries(rest.map((a) => [a.name, a.values[0]])));

  const find = useMemo(() => {
    const map = new Map();
    for (const v of product.variants) {
      if (rest.some((a) => v.options[a.name] !== extra[a.name])) continue;
      map.set(`${v.options[rowAttr?.name]}|${colAttr ? v.options[colAttr.name] : ''}`, v);
    }
    return (r, c) => map.get(`${r}|${c ?? ''}`);
  }, [product, extra]);

  const active = product.variants.find((v) => String(v.id) === query.v);
  const cols = colAttr ? colAttr.values : [null];
  const rows = rowAttr ? rowAttr.values : [];

  const toggleMany = (vs) => {
    const next = new Set(selected);
    const allOn = vs.every((v) => next.has(v.id));
    vs.forEach((v) => (allOn ? next.delete(v.id) : next.add(v.id)));
    setSelected(next);
  };

  const onCell = (e, v) => {
    if (!v) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) toggleMany([v]);
    else setQuery({ v: active?.id === v.id ? null : String(v.id) });
  };

  const cellText = (v) => {
    if (!v) return '·';
    if (layer === 'count') return v.sourceCount;
    if (layer === 'price') return v.cheapest ? money(v.cheapest.totalMin) : '—';
    return `${v.usableCount}/${v.sourceCount}`;
  };

  if (!rowAttr) return <div className="empty">Sản phẩm chưa có thuộc tính để dựng ma trận.</div>;

  return (
    <div className={`matrix-layout ${active ? 'has-drawer' : ''}`}>
      <section className="panel">
        <div className="panel-head wrap">
          <h2>Ma trận {rowAttr.name} × {colAttr?.name ?? ''}</h2>
          <div className="segmented" role="group" aria-label="Lớp hiển thị">
            {Object.entries(LAYERS).map(([k, l]) => (
              <button key={k} className={layer === k ? 'is-on' : ''} onClick={() => setLayer(k)} title={l.hint}>{l.label}</button>
            ))}
          </div>
          {rest.map((a) => (
            <select key={a.name} className="select" value={extra[a.name]} onChange={(e) => setExtra({ ...extra, [a.name]: e.target.value })}>
              {a.values.map((x) => <option key={x}>{x}</option>)}
            </select>
          ))}
        </div>

        <div className="matrix-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th className="corner">{rowAttr.name} ↓ {colAttr ? `${colAttr.name} →` : ''}</th>
                {cols.map((c) => (
                  <th key={c ?? 'x'}>
                    <button className="head-btn" title="Chọn cả cột" onClick={() => toggleMany(rows.map((r) => find(r, c)).filter(Boolean))}>{c ?? '—'}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <th>
                    <button className="head-btn" title="Chọn cả hàng" onClick={() => toggleMany(cols.map((c) => find(r, c)).filter(Boolean))}>{r}</button>
                  </th>
                  {cols.map((c) => {
                    const v = find(r, c);
                    const cls = `cell cell-${v ? tone(v) : 'empty'} ${active && v && active.id === v.id ? 'is-active' : ''} ${v && selected.has(v.id) ? 'is-selected' : ''}`;
                    return (
                      <td key={c ?? 'x'}>
                        <button className={cls} onClick={(e) => onCell(e, v)} disabled={!v}>
                          <span className="cell-main">{cellText(v)}</span>
                          {v && (
                            <span className="cell-tip" role="tooltip">
                              <b>{v.label}</b> · #{v.id}<br />
                              {v.sourceCount} nguồn · {v.usableCount} còn kho<br />
                              {v.cheapest ? <>Rẻ nhất: {v.cheapest.supplier.name} {money(v.cheapest.totalMin)}</> : 'Chưa có supplier'}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="matrix-legend">
          <span><i className="cell-swatch cell-none" />0 nguồn / hết kho</span>
          <span><i className="cell-swatch cell-one" />1 nguồn: rủi ro</span>
          <span><i className="cell-swatch cell-safe" />≥ 2 nguồn: an toàn</span>
        </div>
        <p className="muted small">Bấm ô: so sánh supplier · Shift + bấm hoặc bấm tiêu đề hàng/cột: chọn nhiều để map hàng loạt</p>

        {selected.size > 0 && (
          <div className="bulkbar">
            <b>Đã chọn {selected.size} variant</b>
            <button className="btn btn-primary btn-sm" onClick={() => actions.notify(`Mở wizard map supplier cho ${selected.size} variant`)}>Map supplier</button>
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
          </div>
        )}
      </section>

      {active && <Drawer product={product} variant={active} actions={actions} onClose={() => setQuery({ v: null })} />}
    </div>
  );
}
