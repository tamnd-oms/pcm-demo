import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../lib/router.js';

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export default function CommandPalette({ index, onClose }) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo(() => {
    const terms = strip(q).split(/\s+/).filter(Boolean);
    const hits = terms.length ? index.filter((e) => { const k = strip(`${e.keys} ${e.label}`); return terms.every((t) => k.includes(t)); }) : index.filter((e) => e.type === 'Sản phẩm');
    const groups = new Map();
    for (const h of hits) {
      if (!groups.has(h.type)) groups.set(h.type, []);
      if (groups.get(h.type).length < 6) groups.get(h.type).push(h);
    }
    return [...groups.entries()];
  }, [q, index]);
  const flat = results.flatMap(([, list]) => list);

  const go = (e) => { if (!e) return; navigate(e.route); onClose(); };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') go(flat[cursor]);
  };

  let n = -1;
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Tìm kiếm">
        <input ref={inputRef} className="palette-input" placeholder="Tên sản phẩm, mã (G18500B), ID variant (9905), supplier, catalog…"
          value={q} onChange={(e) => { setQ(e.target.value); setCursor(0); }} onKeyDown={onKey} />
        <div className="palette-results">
          {flat.length === 0 && <div className="empty">Không tìm thấy “{q}”.</div>}
          {results.map(([type, list]) => (
            <div key={type}>
              <div className="palette-group">{type}</div>
              {list.map((e) => {
                n += 1;
                const i = n;
                return (
                  <button key={e.route + e.label} className={`palette-item ${i === cursor ? 'is-on' : ''}`} onMouseEnter={() => setCursor(i)} onClick={() => go(e)}>
                    <span>{e.label}</span>
                    <span className="muted small ellipsis">{e.sub}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot muted small">↑↓ chọn · Enter mở · Esc đóng</div>
      </div>
    </div>
  );
}
