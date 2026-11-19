import { useEffect, useMemo, useRef, useState } from 'react';
import { colorToHex, days, money } from '../lib/model.js';
import { navigate, setQuery } from '../lib/router.js';
import { Badge, Kpi, Thumb } from './ui.jsx';

const PAGE_SIZE = 20;

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

const Chevron = ({ open }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden
    style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>
    <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
    <path d="M2 3h12M4 8h8M6 13h4" />
  </svg>
);
const SortIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 3v10M4 3L2 5M4 3l2 2M12 13V3M12 13l-2-2M12 13l2-2" />
  </svg>
);

function useClickOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return;
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    document.addEventListener('mousedown', on);
    document.addEventListener('touchstart', on);
    return () => { document.removeEventListener('mousedown', on); document.removeEventListener('touchstart', on); };
  }, [active, ref, onOutside]);
}

function catTrail(model, cat) {
  const names = [];
  for (let c = cat; c; c = c.parentId ? model.catById.get(c.parentId) : null) names.unshift(c.name);
  return names.join(' › ');
}

function CategoryBar({ model, cat }) {
  const [openId, setOpenId] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpenId(null), openId != null);

  const activeRootId = cat ? (cat.parentId ? model.catById.get(cat.parentId)?.id ?? cat.id : cat.id) : null;
  const rootId = (() => {
    if (!cat) return null;
    let c = cat;
    while (c?.parentId && model.catById.has(c.parentId)) c = model.catById.get(c.parentId);
    return c?.id ?? null;
  })();

  const pickCat = (id) => { setOpenId(null); setQuery({ cat: id }); };

  return (
    <nav className="cat-bar" ref={ref} aria-label="Danh mục">
      <button className={`cat-tab ${!cat ? 'is-active' : ''}`} onClick={() => pickCat(null)}>
        <span>Tất cả</span>
      </button>
      {model.rootCats.map((c) => {
        const hasChildren = c.children.length > 0;
        const isActive = rootId === c.id;
        const isOpen = openId === c.id;
        return (
          <div key={c.id} className="cat-tab-wrap">
            <button
              className={`cat-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (hasChildren) setOpenId(isOpen ? null : c.id);
                else pickCat(c.id);
              }}
              aria-expanded={hasChildren ? isOpen : undefined}
            >
              <span>{c.name}</span>
              {c.issueCount > 0 && <span className="dot dot-critical" title={`${c.issueCount} sản phẩm thiếu nguồn`} />}
              {hasChildren && <Chevron open={isOpen} />}
            </button>
            {hasChildren && isOpen && (
              <div className="cat-dropdown" role="menu">
                <button className={`cat-dropdown-item ${cat?.id === c.id ? 'is-selected' : ''}`} onClick={() => pickCat(c.id)}>
                  <span className="cat-dropdown-name">Tất cả {c.name}</span>
                  <span className="cat-dropdown-count">{c.productCount}</span>
                </button>
                {c.children.map((child) => (
                  <button
                    key={child.id}
                    className={`cat-dropdown-item ${cat?.id === child.id ? 'is-selected' : ''}`}
                    onClick={() => pickCat(child.id)}
                    role="menuitem"
                  >
                    <span className="cat-dropdown-name">
                      {child.name}
                      {child.issueCount > 0 && <span className="dot dot-critical" style={{ marginLeft: 6 }} />}
                    </span>
                    <span className="cat-dropdown-count">{child.productCount}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Popover({ open, onClose, children, align = 'left' }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose, open);
  if (!open) return null;
  return <div className={`popover popover-${align}`} ref={ref} role="dialog">{children}</div>;
}

function FilterPopover({ open, onClose, model, supplier }) {
  return (
    <Popover open={open} onClose={onClose}>
      <div className="popover-row">
        <label className="popover-label">Nhà cung cấp</label>
        <select
          className="select"
          value={supplier}
          onChange={(e) => setQuery({ supplier: e.target.value || null })}
        >
          <option value="">Mọi supplier</option>
          {model.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="popover-foot">
        <button className="btn btn-outline btn-sm" onClick={() => { setQuery({ supplier: null }); onClose(); }}>Xoá bộ lọc</button>
        <button className="btn btn-primary btn-sm" onClick={onClose}>Xong</button>
      </div>
    </Popover>
  );
}

function SortPopover({ open, onClose, sort }) {
  return (
    <Popover open={open} onClose={onClose} align="right">
      <div className="popover-label">Sắp xếp theo</div>
      {Object.entries(SORTS).map(([k, s]) => (
        <button
          key={k}
          className={`popover-option ${sort === k ? 'is-selected' : ''}`}
          onClick={() => { setQuery({ sort: k }); onClose(); }}
        >
          <span>{s.label}</span>
          {sort === k && <span aria-hidden>✓</span>}
        </button>
      ))}
    </Popover>
  );
}

function pickAttr(product, name) {
  return (product.attributes ?? product.attrs ?? []).find((a) => a.name?.toLowerCase() === name.toLowerCase());
}

function ColorSwatches({ product, max = 6 }) {
  const attr = pickAttr(product, 'Color');
  if (!attr?.values?.length) return null;
  const shown = attr.values.slice(0, max);
  const extra = attr.values.length - shown.length;
  return (
    <div className="swatch-row" aria-label={`${attr.values.length} màu`}>
      {shown.map((v) => (
        <span key={v} className="swatch-dot" style={{ background: colorToHex(v) }} title={v} />
      ))}
      {extra > 0 && <span className="swatch-more">+{extra}</span>}
    </div>
  );
}

function ProductCard({ p }) {
  const m = p.metrics;
  const bad = m.missing;
  const open = () => navigate(`/p/${p.id}`);
  const sizeAttr = pickAttr(p, 'Size');
  const colorAttr = pickAttr(p, 'Color');
  const sizeCount = sizeAttr?.values?.length ?? 0;
  const colorCount = colorAttr?.values?.length ?? 0;

  return (
    <article
      className={`pcard ${bad ? 'is-critical' : ''}`}
      onClick={open}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      role="link"
      aria-label={p.name}
    >
      <div className="pcard-img">
        {p.image
          ? <img src={p.image} alt={p.name} loading="lazy" />
          : <Thumb product={p} size={160} />}
        <div className="pcard-overlays pcard-overlays-left">
          {bad
            ? <Badge tone="critical">Thiếu nguồn</Badge>
            : !p.active && <Badge tone="muted">Inactive</Badge>}
        </div>
        <div className="pcard-overlays pcard-overlays-right">
          {m.tiktokCount > 0 && <Badge tone="accent" title={`${m.tiktokCount} catalog TikTok`}>TikTok</Badge>}
        </div>
      </div>
      <div className="pcard-body">
        <h3 className="pcard-title" title={p.name}>{p.name}</h3>
        <div className="pcard-price">
          {m.bestTotal != null ? (
            <>
              <span className="muted small">Từ </span>
              <b>{money(m.bestTotal)}</b>
            </>
          ) : (
            <span className="muted small">Chưa có giá</span>
          )}
        </div>
        <div className="pcard-meta">
          {sizeCount > 0 && <span>{sizeCount} sizes</span>}
          {colorCount > 0 && <span>{colorCount} colors</span>}
          {p.suppliers.length > 0 && <span>{p.suppliers.length} suppliers</span>}
        </div>
        <ColorSwatches product={p} />
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

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

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
  const filterActiveCount = (supplier ? 1 : 0);

  return (
    <div className="explorer">
      <CategoryBar model={model} cat={cat} />

      <div className="kpis">
        <Kpi value={kpi.products} label="Sản phẩm" />
        <Kpi value={kpi.catalogs} label="Catalog supplier đã map" />
        <Kpi
          value={kpi.fastest ? days(kpi.fastest.total) : '—'}
          label={kpi.fastest ? `Giao nhanh nhất · ${kpi.fastest.catalog.supplier.name}` : 'Giao nhanh nhất'}
          tone="good"
        />
        <Kpi
          value={kpi.missing}
          label="SP thiếu nguồn (bấm để lọc)"
          tone="critical"
          active={active.has('missing')}
          onClick={() => toggleFilter('missing')}
        />
      </div>

      <div className="explorer-toolbar">
        <input
          className="input explorer-search"
          placeholder="Tìm theo tên, mã, supplier…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="toolbar-actions">
          <div className="popover-wrap">
            <button
              className={`icon-pill ${filterActiveCount > 0 ? 'is-on' : ''}`}
              onClick={() => { setFilterOpen((o) => !o); setSortOpen(false); }}
              aria-expanded={filterOpen}
              aria-label="Bộ lọc mở rộng"
            >
              <FilterIcon />
              <span>Filter</span>
              {filterActiveCount > 0 && <span className="pill-count">{filterActiveCount}</span>}
            </button>
            <FilterPopover
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              model={model}
              supplier={supplier}
            />
          </div>
          <div className="chips chips-inline">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`chip chip-${f.tone} ${active.has(f.key) ? 'is-on' : ''}`}
                onClick={() => toggleFilter(f.key)}
              >{f.label}</button>
            ))}
          </div>
          <div className="popover-wrap">
            <button
              className="icon-pill icon-pill-square"
              onClick={() => { setSortOpen((o) => !o); setFilterOpen(false); }}
              aria-expanded={sortOpen}
              aria-label="Sắp xếp"
              title={`Sắp xếp: ${SORTS[sort].label}`}
            >
              <SortIcon />
            </button>
            <SortPopover open={sortOpen} onClose={() => setSortOpen(false)} sort={sort} />
          </div>
        </div>
      </div>

      <div className="list-meta">
        <div className="list-meta-crumbs">
          <span className="muted small">{cat ? catTrail(model, cat) : 'Toàn bộ catalog'}</span>
          <h1 className="list-meta-title">{cat ? cat.name : 'Catalog'}</h1>
        </div>
        <div className="list-meta-count">
          <span className="muted small">
            {list.length === 0
              ? '0 sản phẩm'
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, list.length)} / ${list.length} sản phẩm`}
          </span>
        </div>
      </div>

      <div className="product-grid">
        {pageItems.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
      {list.length === 0 && <div className="empty">Không có sản phẩm khớp bộ lọc.</div>}

      {pageCount > 1 && <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />}
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
