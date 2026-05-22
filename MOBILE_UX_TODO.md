# TerraPOS - Konteks untuk Session Berikutnya

## Status Mobile UX: ✅ SELESAI (Semua 7 modal sudah dikonversi)

Semua popup/modal yang tadinya "centered modal" sudah diubah menjadi **bottom sheet** khusus mobile (<980px). Desktop tetap centered modal.

### Modal yang Sudah Selesai

| # | File | Modal | CSS Class |
|---|------|-------|-----------|
| 1 | `orders/page.tsx` | Refund | `refund-desktop` / `refund-mobile` |
| 2 | `orders/page.tsx` | Void/Cancel | `void-desktop` / `void-mobile` |
| 3 | `orders/page.tsx` | Shift Prompt | `shift-prompt-desktop` / `shift-prompt-mobile` |
| 4 | `orders/page.tsx` | Pay Success | `pay-success-desktop` / `pay-success-mobile` |
| 5 | `pos/page.tsx` | Table Warning | `table-warn-desktop` / `table-warn-mobile` |
| 6 | `pos/page.tsx` | Shift Prompt | `pos-shift-desktop` / `pos-shift-mobile` |
| 7 | `pos/page.tsx` | Success Dialog (Pay Now) | `pos-success-desktop` / `pos-success-mobile` |

### Modal yang sudah OK sebelumnya (tidak diubah)

| Modal | Alasan |
|-------|--------|
| Payment Popup (pos) | `pos-pay-desktop` / `pos-pay-mobile` — sudah dari awal |
| Bill Success (pos) | `bill-success-desktop` / `bill-success-mobile` — sudah dari awal |
| Payment Popup (orders) | `order-pay-desktop` / `order-pay-mobile` — sudah dari awal |
| Shift Confirm (shifts) | Sudah `width:"90%"` + `maxWidth:400`, cukup OK |
| Shift Closed (shifts) | Sudah `width:"90%"` + `maxWidth:420`, cukup OK |
| BT Connecting (printer) | Kecil, hanya spinner |
| PrintingOverlay | Kecil, hanya spinner |

---

## Pattern yang Dipakai (Referensi untuk Fitur Baru)

### CSS Pattern:
```css
/* Desktop: centered modal */
.xxx-desktop { display: grid; }
.xxx-mobile-overlay { display: none; }
.xxx-mobile { display: none !important; }

@media (max-width: 980px) {
  .xxx-desktop { display: none !important; }
  .xxx-mobile-overlay {
    display: block;
    position: fixed; inset: 0; z-index: 90;
    background: rgba(0,0,0,0.6);
    animation: fadeIn 0.2s ease;
  }
  .xxx-mobile {
    display: block !important;
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 91;
    background: var(--panel);
    border-radius: 24px 24px 0 0;
    padding: 20px 20px 40px;
    animation: slideUp 0.25s ease;
    box-shadow: 0 -12px 40px rgba(0,0,0,0.25);
  }
}
```

### HTML Pattern (Mobile Bottom Sheet):
```jsx
{/* DESKTOP */}
{dialog && (
  <div className="xxx-desktop" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", placeItems:"center", padding:16, zIndex:90 }}>
    <div className="card" style={{ width:440, maxWidth:"100%", textAlign:"center" }}>
      {/* content */}
    </div>
  </div>
)}

{/* MOBILE */}
{dialog && (
  <>
    <div className="xxx-mobile-overlay" onClick={closeHandler} />
    <div className="xxx-mobile">
      <div style={{ width:40, height:4, borderRadius:2, background:"var(--border)", margin:"0 auto 16px" }} />
      <div style={{ textAlign:"center" }}>
        {/* same content but with larger fonts/buttons */}
      </div>
    </div>
  </>
)}
```

---

## Hal yang Masih PERLU Dikerjakan

### 1. Firestore Rules Deploy
**Firestore rules** (`firestore.rules`) perlu di-deploy terpisah ke Firebase Console agar collection `notifications` bisa dibaca oleh user biasa. Ini belum dilakukan dan menyebabkan notifikasi tidak muncul ke user.

Deploy rules via:
```bash
firebase deploy --only firestore:rules
```

Atau copy-paste isi `firestore.rules` ke Firebase Console → Firestore → Rules → Publish.

### 2. PR Merge (jika belum)
PR #14 perlu di-merge di GitHub:
- Branch: `mobile-ux/refund-void-bottom-sheet`
- Target: `main`
- URL: https://github.com/forwarungberselera/terrapos/pull/14

Setelah merge, GitHub Action akan auto-deploy ke VPS.

---

## Struktur File yang Relevan

```
web/src/app/
├── pos/page.tsx          → POS kasir (cart, payment, promo)
├── orders/page.tsx       → Daftar orders (OPEN/PAID/CANCELLED/REFUND)
├── shifts/page.tsx       → Shift management
├── printer/page.tsx      → Bluetooth printer setup
├── dashboard/page.tsx    → Owner dashboard
├── settings/page.tsx     → Pengaturan toko
├── products/page.tsx     → CRUD produk/menu
├── promos/page.tsx       → CRUD promo
└── ...

web/src/components/
├── NotificationBell.tsx  → Notifikasi realtime
├── MaintenanceGuard.tsx  → Maintenance mode guard
├── PrintingOverlay.tsx   → Loading overlay saat print
├── Toast.tsx             → Toast notification system
├── TerraPage.tsx         → Layout wrapper
├── LevelBadge.tsx        → Badge level tenant
└── Skeleton.tsx          → Loading skeleton

web/src/lib/
├── firebase.ts           → Firebase config
├── receipt.ts            → Generate receipt HTML
├── rawbt.ts              → RawBT printer integration
├── bluetooth-printer.ts  → Web Bluetooth API
├── native-printer.ts     → Native app printer bridge
├── shifts.ts             → Shift utilities
├── audit.ts              → Audit logging
└── ...
```

---

## Tech Stack & Conventions

- **Next.js 16 + React 19** (App Router)
- **Firebase**: Firestore, Auth, Hosting rules
- **Styling**: Inline styles + `<style>` tag scoped CSS (NO Tailwind)
- **CSS Variables**: `--panel`, `--brand`, `--border`, `--brandSoft`, `--danger`, `--muted`, `--text`, `--input-bg`, `--font-mono`, `--font-primary`, `--radius`, `--shadow`, dll
- **Breakpoints**: `980px` (mobile), `640px` (small mobile), `768px` (tablet)
- **Animation keyframes**: `fadeIn`, `slideUp` (pos), `orderFadeIn`, `orderSlideUp` (orders)
- **TypeScript strict mode** aktif
- **Bahasa UI**: Bahasa Indonesia
- **Deploy**: GitHub Actions → SSH ke VPS → `git pull` → `npm run build` → `pm2 restart`
- **VPS path**: `/var/www/terrapos`
- **PM2 process name**: `terrapos`

---

## Deploy Command (Manual via PuTTY/SSH)

```bash
cd /var/www/terrapos && git pull origin main && cd web && npm install --production && npm run build && pm2 restart terrapos
```

---

## Status Terakhir

- **Branch aktif**: `mobile-ux/refund-void-bottom-sheet` (PR #14 → main)
- **Commit terakhir**: `4aa5942` — semua 7 modal bottom sheet selesai
- **TypeScript**: ✅ Pass tanpa error
- **Fitur terakhir**: Mobile UX bottom sheet untuk semua modal di orders & pos
