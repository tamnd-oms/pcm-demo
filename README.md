# Catalog Hub – Frontend React (mockup 1, 2, 3)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # bản build tĩnh trong dist/
```

## Màn hình

| Route | Màn hình |
| --- | --- |
| `#/` | Mockup 1 – Catalog Explorer (cây category, KPI, card sản phẩm, lọc chip, sắp xếp) |
| `#/?cat=cat-hoodie&f=missing` | Explorer đã lọc theo category + "Thiếu nguồn" (mọi bộ lọc nằm trên URL) |
| `#/p/:productId` | Mockup 2 – Product 360°, tab Tổng quan (so sánh supplier theo variant, cảnh báo, việc cần xử lý) |
| `#/p/:productId/variants?v=:variantId` | Mockup 3 – Ma trận Màu × Size + drawer so sánh supplier |
| `#/p/:productId/suppliers` | Tab Supplier: catalog, ngày giao Track17, bật/tắt, kéo thả priority |

`Ctrl/⌘ + K` mở ô tìm kiếm chung (sản phẩm, mã, ID variant, supplier, catalog supplier; gõ không dấu cũng được).

## Cấu trúc

```
src/
  data/sample.json        dữ liệu mẫu – thay bằng JSON của bạn
  lib/model.js            adapter normalizeRaw() + tính chỉ số (giá tổng, độ phủ, cảnh báo…)
  lib/router.js           hash router nhỏ, không cần thư viện
  App.jsx                 state dữ liệu + actions (đổi priority, bật/tắt) → chỗ nối API
  components/
    Explorer.jsx          mockup 1
    Product360.jsx        mockup 2 (header, tab, Tổng quan)
    VariantMatrix.jsx     mockup 3 (ma trận + drawer)
    SupplierTab.jsx       tab Supplier
    OfferCard.jsx         thẻ so sánh 1 nguồn (dùng chung cho tab Tổng quan và drawer)
    CommandPalette.jsx    Ctrl/⌘ + K
    ui.jsx                Badge, Kpi, DeliveryBar, CoverageBar, Toggle…
  styles.css              biến màu (sáng/tối), layout, responsive
```

## Định dạng JSON

```jsonc
{
  "categories": [{ "id": "cat-hoodie", "name": "Hoodie", "parentId": "cat-adult" }],
  "suppliers":  [{ "id": "swiftpod", "name": "Swiftpod", "color": "#111827" }],
  "products": [{
    "id": "p-g18500b", "code": "G18500B", "name": "G18500B Youth Hooded Sweatshirt",
    "categoryId": "cat-sweat", "active": true, "productType": "apparel", "image": null,
    "attributes": [{ "name": "Color", "values": ["Black", "Cardinal Red"] },
                   { "name": "Size",  "values": ["S", "M", "L"] }]
  }],
  "variants": [{ "id": 9904, "productId": "p-g18500b", "options": { "Color": "Black", "Size": "L" }, "active": true }],
  "supplierCatalogs": [{
    "id": "sc-1001", "productId": "p-g18500b", "supplierId": "swiftpod", "provider": null,
    "name": "GILDAN® HEAVY BLEND™ YOUTH HOODED SWEATSHIRT-GILDAN-18500B",
    "productType": "apparel", "enabled": true, "tiktok": false, "priority": 0, "processingDays": null,
    "delivery": [{ "platform": "Etsy", "submitDays": 0.8, "trackingDays": 1.3, "inTransitDays": 4.0, "deliveredDays": 3.2 }]
  }],
  "variantOffers": [{
    "id": 15982, "variantId": 9904, "supplierCatalogId": "sc-1001", "supplierVariantName": "Black / L",
    "baseCost": 13.81, "stock": "active", "active": true,
    "fees": [{ "name": "Add side", "amount": 4.0 }],
    "shipping": {
      "US": [{ "method": "Standard", "first": 9.18, "additional": 3.24, "surcharge": 0 }],
      "US-AK/HI/PR": [], "EU": [{ "method": "Standard", "first": 16.20, "additional": 10.80, "surcharge": 0 }]
    }
  }]
}
```

Quy ước tính toán (trong `lib/model.js`):

- **Tổng tối thiểu** = `baseCost` + ship US phương thức "Standard" (item đầu).
- **Đơn đang đi** = nguồn đầu tiên theo `priority` còn `stock: "active"`, `active` và catalog `enabled`.
- **Độ phủ**: variant 0 nguồn = đỏ, 1 nguồn = vàng, ≥ 2 nguồn = xanh.
- **Map nhầm**: `supplierCatalogs[].productType` khác `products[].productType`.

JSON thật có tên trường khác thì chỉ sửa `normalizeRaw()` trong `lib/model.js`; các component không phụ thuộc trực tiếp vào JSON gốc.
