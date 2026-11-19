import { useCallback, useEffect, useMemo, useState } from 'react';
import categoryData from './data/category.json';
import p158Variants from './data/p158-variants.json';
import { buildModel } from './lib/model.js';
import { navigate, useRoute } from './lib/router.js';
import Explorer from './components/Explorer.jsx';
import Product360 from './components/Product360.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { Toast } from './components/ui.jsx';

const initialRaw = {
  ...categoryData,
  productVariants: { p158: p158Variants },
};

export default function App() {
  // Dữ liệu thô giữ trong state để thao tác (đổi priority, bật/tắt) phản ánh ngay mọi màn hình.
  // Khi nối API: thay `category` bằng dữ liệu fetch và gọi API trong các hàm actions bên dưới.
  const [raw, setRaw] = useState(initialRaw);
  const model = useMemo(() => buildModel(raw), [raw]);
  const route = useRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const notify = useCallback((text) => {
    setToast(text);
    window.clearTimeout(notify.t);
    notify.t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const actions = useMemo(() => ({
    reorderCatalogs(orderedIds) {
      setRaw((r) => ({
        ...r,
        supplierCatalogs: r.supplierCatalogs.map((c) => (orderedIds.includes(c.id) ? { ...c, priority: orderedIds.indexOf(c.id) } : c)),
      }));
      notify('Đã cập nhật thứ tự ưu tiên supplier');
    },
    toggleCatalog(id, field) {
      setRaw((r) => ({ ...r, supplierCatalogs: r.supplierCatalogs.map((c) => (c.id === id ? { ...c, [field]: !c[field] } : c)) }));
    },
    notify,
  }), [notify]);

  const [section, id, tab] = route.parts;
  const product = section === 'p' ? model.productById.get(id) : null;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')}>
          <span className="brand-mark">◆</span> Catalog Hub
        </button>
        <nav className="crumbs">
          <a href="#/">Catalog</a>
          {product && product.categoryPath.map((c) => (
            <span key={c.id}> › <a href={`#/?cat=${c.id}`}>{c.name}</a></span>
          ))}
          {product && <span> › <b>{product.code}</b></span>}
        </nav>
        <button className="search-trigger" onClick={() => setPaletteOpen(true)}>
          <span>Tìm sản phẩm, SKU, ID variant, supplier…</span>
          <kbd>Ctrl K</kbd>
        </button>
      </header>

      <main className="main">
        {product
          ? <Product360 key={product.id} product={product} tab={tab ?? 'overview'} query={route.query} actions={actions} />
          : section === 'p'
            ? <div className="empty">Không tìm thấy sản phẩm. <a href="#/">Về Catalog</a></div>
            : <Explorer model={model} query={route.query} actions={actions} />}
      </main>

      {paletteOpen && <CommandPalette index={model.searchIndex} onClose={() => setPaletteOpen(false)} />}
      <Toast text={toast} />
    </div>
  );
}
