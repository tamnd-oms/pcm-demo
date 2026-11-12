import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 20;
import { money, days } from '../lib/model.js';
import { navigate, setQuery } from '../lib/router.js';
import { AvatarStack, Badge, CoverageBar, DeliveryBar, Kpi, Thumb } from './ui.jsx';

const Ico = ({ d }) => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ verticalAlign: 'middle', flexShrink: 0 }} aria-hidden>
    <path d={d} />
  </svg>
);
const ICO_VARIANT  = 'M1 1h6v6H1zm8 0h6v6H9zM1 9h6v6H1zm8 0h6v6H9z';
const ICO_CATALOG  = 'M2 3h12v2H2zm0 4h12v2H2zm0 4h8v2H2z';
const ICO_SUPPLIER = 'M8 2a3 3 0 110 6 3 3 0 010-6zm0 7c-3.3 0-6 1.6-6 3v1h12v-1c0-1.4-2.7-3-6-3z';

const FILTERS = [
  { key: 'missing', label: 'Thiếu nguồn', tone: 'critical', test: (p) => p.metrics.missing || p.metrics.hasGap },
  { key: 'single', label: 'Chỉ 1 nguồn', tone: 'warning', test: (p) => p.metrics.singleSource },
  { key: 'tiktok', label: 'TikTok', tone: 'neutral', test: (p) => p.metrics.tiktokCount > 0 },
];
const SORTS = {
  name: { label: 'Tên A → Z', fn: (a, b) => a.name.localeCompare(b.name) },
  issues: { label: 'Nhiều vấn đề trước', fn: (a, b) => b.issues.length - a.issues.length },
  cost: { label: 'Giá vốn thấp nhất', fn: (a, b) => (a.metrics.bestTotal ?? 1e9) - (b.metrics.bestTotal ?? 1e9) },
  fast: { label: 'Giao nhanh nhất', fn: (a, b) => (a.metrics.fastest?.total ?? 1e9) - (b.metrics.fastest?.total ?? 1e9) },
};

function catTrail(model, cat) {
  const names = [];
  for (let c = cat; c; c = c.parentId ? model.catById.get(c.parentId) : null) names.unshift(c.name);
  return names.join(' › ');
}

function CategoryNode({ cat, selected, depth = 0 }) {
  const [open, setOpen] = useState(false);
  const isSel = selected === cat.id;
  return (
    <li>
      <div className={`tree-row ${isSel ? 'is-selected' : ''}`} style={{ paddingLeft: 8 + depth * 16 }}>
        {cat.children.length > 0
          ? <button className="tree-caret" onClick={() => setOpen(!open)} aria-label={open ? 'Thu gọn' : 'Mở rộng'}>{open ? '▾' : '▸'}</button>
          : <span className="tree-caret" />}
        <button className="tree-label" onClick={() => setQuery({ cat: isSel ? null : cat.id })}>
          {cat.name}
        </button>
        {cat.issueCount > 0 && <span className="dot dot-critical" title={`${cat.issueCount} sản phẩm thiếu nguồn`} />}
        <span className="tree-count">{cat.productCount}</span>
      </div>
      {open && cat.children.length > 0 && (
        <ul>{cat.children.map((c) => <CategoryNode key={c.id} cat={c} selected={selected} depth={depth + 1} />)}</ul>
      )}
    </li>
  );
}

function ProductCard({ p }) {
  const m = p.metrics;
  const bad = m.missing;
  const covPct = m.variantCount
    ? Math.round(((m.coverage.safe + m.coverage.one) / m.variantCount) * 100)
    : 0;
  const covTone = covPct === 100 ? 'text-good' : covPct >= 50 ? 'text-warn' : 'text-critical';
  const open = () => navigate(`/p/${p.id}`);
  return (
    <article className={`pcard ${bad ? 'is-critical' : ''}`} onClick={open} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open()}>
      <Thumb product={p} />
      <div className="pcard-body">
        <div className="pcard-head">
          <h3>{p.name}</h3>
          {bad ? <Badge tone="critical">Thiếu nguồn</Badge> : <Badge tone={p.active ? 'good' : 'muted'}>{p.active ? 'Active' : 'Inactive'}</Badge>}
        </div>
        {bad ? (
          <p className="text-critical">Chưa map catalog supplier nào cho {m.variantCount} variant</p>
        ) : (
          <>
            <div className="pcard-stats">
              <span className="pstat" title="Số variant"><Ico d={ICO_VARIANT} /> {m.variantCount} variant</span>
              <span className="pstat" title="Catalog đã map"><Ico d={ICO_CATALOG} /> {m.catalogCount} catalog</span>
              <span className="pstat" title="Nhà cung cấp"><Ico d={ICO_SUPPLIER} /> <AvatarStack suppliers={p.suppliers} /></span>
              {Object.keys(m.platforms).map((k) => <span key={k} className="pstat-chip">{k}</span>)}
            </div>
            <div className="pcard-row">
              <span className="pcard-cost">Từ <b>{money(m.bestTotal)}</b> <span className="muted">base+ship US</span></span>
              <span className="pcard-cov">
                <CoverageBar coverage={m.coverage} total={m.variantCount} />
                <b className={covTone}>{covPct}%</b>
                <span className="muted small"> phủ</span>
              </span>
            </div>
            {m.fastest
              ? <DeliveryBar d={m.fastest} scale={10} />
              : <p className="muted small">Chưa có dữ liệu ngày giao</p>}
          </>
        )}
      </div>
      <div className="pcard-actions">
        <button className={bad ? 'btn btn-primary' : 'btn btn-outline'} onClick={(e) => { e.stopPropagation(); navigate(bad ? `/p/${p.id}/suppliers` : `/p/${p.id}`); }}>
          {bad ? 'Map ngay' : 'Xem 360° →'}
        </button>
      </div>
    </article>
  );
}

export default function Explorer({ model, query }) {
  const [text, setText] = useState('');
  const active = new Set((query.f ?? '').split(',').filter(Boolean));
  const sort = SORTS[query.sort] ? query.sort : 'issues';
  const cat = query.cat
    ? model.catById.get(query.cat) ?? model.catById.get(Number(query.cat))
    : null;
  const supplier = query.supplier ?? '';

  const toggleFilter = (k) => {
    const next = new Set(active);
    next.has(k) ? next.delete(k) : next.add(k);
    setQuery({ f: [...next].join(',') });
  };

  const inCat = useMemo(() => {
    if (!cat) return model.products;
    const ids = new Set();
    const walk = (c) => { ids.add(c.id); c.children.forEach(walk); };
    walk(cat);
    return model.products.filter((p) => ids.has(p.categoryId));
  }, [model, cat]);

  const list = useMemo(() => {
    const q = text.trim().toLowerCase();
    return inCat
      .filter((p) => !q || `${p.name} ${p.code} ${p.suppliers.map((s) => s.name).join(' ')}`.toLowerCase().includes(q))
      .filter((p) => !supplier || p.suppliers.some((s) => s.id === supplier))
      .filter((p) => FILTERS.every((f) => !active.has(f.key) || f.test(p)))
      .sort(SORTS[sort].fn);
  }, [inCat, text, supplier, query.f, sort]);

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [list, currentPage]
  );
  useEffect(() => { setPage(1); }, [text, supplier, query.f, sort, query.cat]);

  const kpi = useMemo(() => {
    const fastest = inCat.map((p) => p.metrics.fastest).filter(Boolean).sort((a, b) => a.total - b.total)[0];
    return {
      products: inCat.length,
      catalogs: inCat.reduce((s, p) => s + p.metrics.catalogCount, 0),
      fastest,
      missing: inCat.filter((p) => p.metrics.missing || p.metrics.hasGap).length,
    };
  }, [inCat]);

  return (
    <div className="explorer">
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="eyebrow">Category</span>
          <button className="btn btn-primary btn-sm" onClick={() => window.alert('Form tạo category: nối vào API hiện có')}>+ Tạo</button>
        </div>
        <button className={`tree-all ${!cat ? 'is-selected' : ''}`} onClick={() => setQuery({ cat: null })}>
          Tất cả sản phẩm <span className="tree-count">{model.products.length}</span>
        </button>
        <ul className="tree">{model.rootCats.map((c) => <CategoryNode key={c.id} cat={c} selected={query.cat} />)}</ul>
        <p className="sidebar-note"><span className="dot dot-critical" /> có sản phẩm thiếu nguồn</p>
      </aside>

      <section className="explorer-main">
        <div className="page-head">
          <div>
            <div className="muted small">{cat ? catTrail(model, cat) : 'Toàn bộ catalog'}</div>
            <h1>{cat ? cat.name : 'Catalog'}</h1>
          </div>
        </div>

        <div className="kpis">
          <Kpi value={kpi.products} label="Sản phẩm" />
          <Kpi value={kpi.catalogs} label="Catalog supplier đã map" />
          <Kpi value={kpi.fastest ? days(kpi.fastest.total) : '—'} label={kpi.fastest ? `Giao nhanh nhất · ${kpi.fastest.catalog.supplier.name}` : 'Giao nhanh nhất'} tone="good" />
          <Kpi value={kpi.missing} label="SP thiếu nguồn (bấm để lọc)" tone="critical" active={active.has('missing')} onClick={() => toggleFilter('missing')} />
        </div>

        <div className="toolbar">
          <input className="input" placeholder="Lọc trong danh sách: tên, mã, supplier…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.key} className={`chip chip-${f.tone} ${active.has(f.key) ? 'is-on' : ''}`} onClick={() => toggleFilter(f.key)}>{f.label}</button>
            ))}
          </div>
          <select className="select" value={supplier} onChange={(e) => setQuery({ supplier: e.target.value || null })}>
            <option value="">Mọi supplier</option>
            {model.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="select" value={sort} onChange={(e) => setQuery({ sort: e.target.value })}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>

        <div className="list-meta">
          <span className="muted small">
            {list.length === 0
              ? '0 sản phẩm'
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, list.length)} / ${list.length} sản phẩm`}
          </span>
        </div>

        <div className="cards">
          {pageItems.map((p) => <ProductCard key={p.id} p={p} />)}
          {list.length === 0 && <div className="empty">Không có sản phẩm khớp bộ lọc.</div>}
        </div>

        {pageCount > 1 && (
          <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
        )}
      </section>
    </div>
  );
}

function Pagination({ page, pageCount, onChange }) {
  const pages = pageRange(page, pageCount);
  return (
    <nav className="pager" aria-label="Phân trang">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Trước</button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`gap-${i}`} className="pager-gap">…</span>
          : (
            <button
              key={p}
              className={`pager-num ${p === page ? 'is-active' : ''}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
            >{p}</button>
          )
      )}
      <button className="btn btn-outline btn-sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Sau →</button>
    </nav>
  );
}

function pageRange(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out = new Set([1, 2, pageCount - 1, pageCount, page - 1, page, page + 1]);
  const sorted = [...out].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
    result.push(sorted[i]);
  }
  return result;
}
