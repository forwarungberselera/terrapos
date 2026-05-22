# TerraPOS Mobile UX - Konteks untuk Session Berikutnya

## Tujuan
Mengubah semua popup/modal yang masih berupa "centered modal" menjadi **bottom sheet** khusus mobile (<980px), sambil tetap mempertahankan tampilan desktop.

## Pattern yang Sudah Diterapkan (Contoh Referensi)

### File: `web/src/app/pos/page.tsx`
Sudah ada contoh implementasi yang benar:
- **Payment Popup**: `pos-pay-desktop` (centered modal) + `pos-pay-mobile` (bottom sheet)
- **Bill Success**: `bill-success-desktop` (centered modal) + `bill-success-mobile` (bottom sheet)

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
  <div className="xxx-desktop" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"grid", placeItems:"center", padding:16, zIndex:90 }}>
    <div className="card" style={{ width:440, maxWidth:"100%", textAlign:"center" }}>
      {/* content */}
    </div>
  </div>
)}

{/* MOBILE */}
{dialog && (
  <>
    <div className="xxx-mobile-overlay" />
    <div className="xxx-mobile">
      <div style={{ width:40, height:4, borderRadius:2, background:"var(--border)", margin:"0 auto 20px" }} />
      <div style={{ textAlign:"center" }}>
        {/* same content but with larger fonts/buttons */}
      </div>
    </div>
  </>
)}
```

---

## 7 Modal yang PERLU Diubah

### 1. `/web/src/app/orders/page.tsx` — Refund Modal
- **Trigger**: `refundOpen && refundOrder`
- **Konten**: Input PIN + textarea alasan + tombol "Konfirmasi Refund"
- **Prioritas**: TINGGI (sering dipakai kasir di HP)

### 2. `/web/src/app/orders/page.tsx` — Void/Cancel Modal
- **Trigger**: `voidOpen && voidOrder`
- **Konten**: Textarea alasan + tombol "Konfirmasi Batalkan"
- **Prioritas**: TINGGI

### 3. `/web/src/app/orders/page.tsx` — Shift Prompt Modal
- **Trigger**: `shiftPromptOpen && !activeShift`
- **Konten**: Info text + 2 tombol (Buka Shift / Tutup)
- **Prioritas**: MEDIUM

### 4. `/web/src/app/orders/page.tsx` — Pay Success Dialog
- **Trigger**: `paySuccessDialog`
- **Konten**: Checkmark + info order + tombol Cetak/Lewati
- **Prioritas**: TINGGI (muncul setelah setiap pembayaran)

### 5. `/web/src/app/pos/page.tsx` — Table Warning Modal
- **Trigger**: `showTableWarning`
- **Konten**: Warning icon + text + tombol OK
- **Prioritas**: MEDIUM (jarang muncul)

### 6. `/web/src/app/pos/page.tsx` — Shift Prompt Modal
- **Trigger**: `shiftPromptOpen && !activeShift`
- **Konten**: Info text + 2 tombol (Buka Shift / Ke Dashboard)
- **Prioritas**: MEDIUM

### 7. `/web/src/app/pos/page.tsx` — Success Dialog (Pay Now)
- **Trigger**: `successDialog`
- **Konten**: Checkmark + kembalian + tombol Cetak/Lewati
- **Prioritas**: TINGGI (muncul setelah setiap transaksi bayar sekarang)

---

## Modal yang TIDAK PERLU Diubah (sudah OK atau terlalu kecil)

| Modal | Alasan |
|-------|--------|
| Shift Confirm (shifts/page.tsx) | Sudah pakai `width:"90%"` + `maxWidth:400`, cukup OK |
| Shift Closed (shifts/page.tsx) | Sudah pakai `width:"90%"` + `maxWidth:420`, cukup OK |
| BT Connecting (printer/page.tsx) | Kecil (360px), hanya spinner, tidak ada interaksi |
| PrintingOverlay | Kecil (320px), hanya spinner, tidak ada interaksi |

---

## Cara Implementasi yang Direkomendasikan

### Opsi A: Per-file (Lebih bersih, lebih banyak kode)
- Tambah CSS class baru di `<style>` tag masing-masing halaman
- Render 2 versi: desktop class + mobile class (hidden/shown via CSS)
- Ini yang sudah dilakukan untuk payment popup & bill success

### Opsi B: Global CSS override (Lebih cepat, 1 file)
- Tambah di `globals.css` media query yang target semua modal `position:fixed` centered
- Override jadi bottom-aligned pada mobile
- **TIDAK DISARANKAN** karena bisa break layout lain

### **REKOMENDASI: Opsi A** — ikuti pattern yang sudah ada.

---

## Struktur File yang Relevan

```
web/src/app/
├── pos/page.tsx          → 2 modal perlu fix (Table Warning, Success Dialog, Shift Prompt)
├── orders/page.tsx       → 4 modal perlu fix (Refund, Void, Shift Prompt, Pay Success)
├── shifts/page.tsx       → 2 modal (sudah OK, optional upgrade)
├── printer/page.tsx      → 1 modal (sudah OK, skip)
└── ...

web/src/components/
├── NotificationBell.tsx  → ✅ Sudah mobile
├── MaintenanceGuard.tsx  → ✅ Full screen, sudah OK
├── PrintingOverlay.tsx   → ⚠️ Kecil, skip
└── ...
```

---

## Firestore Rules Reminder

Jangan lupa: **Firestore rules** (`firestore.rules`) perlu di-deploy terpisah ke Firebase Console agar collection `notifications` bisa dibaca oleh user biasa. Ini belum dilakukan dan menyebabkan notifikasi tidak muncul ke user.

Deploy rules via:
```bash
firebase deploy --only firestore:rules
```

Atau copy-paste isi `firestore.rules` ke Firebase Console → Firestore → Rules → Publish.

---

## Status Terakhir (Branch: main)

Commit terakhir: `c003e25` — bill success popup mobile bottom sheet
Semua perubahan sudah di-push ke `main` dan bisa di-deploy ke VPS via:
```bash
cd /var/www/terrapos && git fetch origin && git reset --hard origin/main && cd web && npm run build && pm2 restart terrapos
```

---

## Catatan Tambahan

- App menggunakan **Next.js 16 + React 19**
- Semua styling inline (no Tailwind classes, hanya CSS variables)
- `<style>` tag di dalam komponen untuk scoped CSS
- Breakpoint mobile: `max-width: 980px` (consistent across app)
- Breakpoint small mobile: `max-width: 640px`
- Animation keyframes: `fadeIn` dan `slideUp` sudah didefinisikan di pos/page.tsx dan orders/page.tsx
- TypeScript strict mode aktif (project tsconfig)
- Bahasa UI: **Bahasa Indonesia**
