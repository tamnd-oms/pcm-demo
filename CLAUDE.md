# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Build static output to dist/
npm run preview   # Preview production build locally
```

No test runner or linter is configured.

## Architecture

**Catalog Hub** is a React 18 + Vite SPA for managing product catalogs with multi-supplier mapping. The UI is in Vietnamese and targets e-commerce platforms (TikTok Shop, Etsy, etc.).

### Data Flow

```
category.json (or API) → App.jsx → buildModel() → components
```

1. **`App.jsx`** holds all state. It loads raw JSON, calls `buildModel()`, and passes the resulting `model` object down to views. It also owns cross-cutting actions (`reorderCatalogs`, `toggleCatalog`, `notify`).

2. **`src/lib/model.js`** is the most critical file. `normalizeRaw()` adapts the raw API shape, then `buildModel()` computes everything — category trees, variant→offer mappings, cost/shipping metrics, delivery timelines, issue detection (10 types), and the command palette search index. All components read from `model`; none touch raw data.

3. **`src/lib/router.js`** is a minimal hash router. `useRoute()` parses `#/p/:productId/suppliers?v=123` into `{ parts, query }`. `setQuery()` updates URL state without full navigation.

4. **Components** are pure consumers of `model`:
   - `Explorer.jsx` — catalog listing with category breadcrumb, filters, and sort
   - `Product360.jsx` — product detail with 3 tabs (Overview / Variants / Suppliers)
   - `VariantMatrix.jsx` — color × size grid with supplier-priority drawer
   - `SupplierTab.jsx` — mapped catalog list with drag-to-reorder
   - `OfferCard.jsx` — reusable supplier pricing card (base cost + shipping + badges)
   - `CommandPalette.jsx` — global search (⌘K / Ctrl+K) with Vietnamese diacritic support
   - `ui.jsx` — shared primitives: `Badge`, `Avatar`, `KPI`, etc.

### Styling

All styles live in `src/styles.css` using CSS custom properties. Light/dark themes via `@media (prefers-color-scheme: dark)`. No CSS framework or CSS-in-JS. Key design tokens: `--brand: #f05a28`, `--accent: #2563eb`, `--good/--warn/--bad` for status colors.

### Replacing the Mock Data with a Real API

Only two files need to change:
- **`App.jsx` line ~13**: replace `useState(category)` with a `fetch` call.
- **`lib/model.js` `normalizeRaw()`**: adjust field mappings if the API shape differs.

No component changes required.

### Key Metrics Computed by `buildModel()`

- **Coverage**: variants with 0 / 1 / ≥2 supplier sources (bad / warn / good)
- **Cost**: base range, shipping range, best total (base + US Standard shipping)
- **Delivery**: fastest route summing submit + tracking + in-transit + delivered days
- **Issues detected**: no catalog, no source, single source, cheapest-off, type mismatch, and others
