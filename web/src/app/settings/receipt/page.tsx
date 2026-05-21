"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useToast } from "@/components/Toast";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";

type ReceiptConfig = {
  storeName: string;
  address: string;
  footer: string;
  cashierName: string;
  fontSize: number;
  showLogo: boolean;
  showQR: boolean;
  showAddress: boolean;
  showCashier: boolean;
  showTableNo: boolean;
  showOrderNo: boolean;
  showDateTime: boolean;
  showPaymentMethod: boolean;
};

const DEFAULT_CONFIG: ReceiptConfig = {
  storeName: "TerraPOS",
  address: "",
  footer: "Terima kasih.",
  cashierName: "Kasir TerraPOS",
  fontSize: 13,
  showLogo: false,
  showQR: false,
  showAddress: true,
  showCashier: true,
  showTableNo: true,
  showOrderNo: true,
  showDateTime: true,
  showPaymentMethod: true,
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function ReceiptSettingsPage() {
  const r = useRouter();
  const { tenantId, loading } = useTenant();
  const { role, loadingRole } = useRole();
  const toast = useToast();

  const [config, setConfig] = useState<ReceiptConfig>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState(false);

  const canEdit = ["owner", "developer"].includes((role || "").toString().toLowerCase());

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d: any = snap.data();
          setConfig({
            storeName: d.storeName || DEFAULT_CONFIG.storeName,
            address: d.address || DEFAULT_CONFIG.address,
            footer: d.footer || DEFAULT_CONFIG.footer,
            cashierName: d.cashierName || DEFAULT_CONFIG.cashierName,
            fontSize: d.receiptFontSize ?? DEFAULT_CONFIG.fontSize,
            showLogo: d.receiptShowLogo ?? DEFAULT_CONFIG.showLogo,
            showQR: d.receiptShowQR ?? DEFAULT_CONFIG.showQR,
            showAddress: d.receiptShowAddress ?? DEFAULT_CONFIG.showAddress,
            showCashier: d.receiptShowCashier ?? DEFAULT_CONFIG.showCashier,
            showTableNo: d.receiptShowTableNo ?? DEFAULT_CONFIG.showTableNo,
            showOrderNo: d.receiptShowOrderNo ?? DEFAULT_CONFIG.showOrderNo,
            showDateTime: d.receiptShowDateTime ?? DEFAULT_CONFIG.showDateTime,
            showPaymentMethod: d.receiptShowPaymentMethod ?? DEFAULT_CONFIG.showPaymentMethod,
          });
        }
      } catch (e: any) {
        toast.error(e?.message || "Gagal load settings");
      }
    })();
  }, [tenantId]);

  async function save() {
    if (!tenantId || !canEdit) return;
    setBusy(true);
    try {
      await setDoc(
        doc(db, `tenants/${tenantId}/settings/main`),
        {
          storeName: config.storeName.trim() || "TerraPOS",
          address: config.address.trim(),
          footer: config.footer.trim() || "Terima kasih.",
          cashierName: config.cashierName.trim() || "Kasir TerraPOS",
          receiptFontSize: config.fontSize,
          receiptShowLogo: config.showLogo,
          receiptShowQR: config.showQR,
          receiptShowAddress: config.showAddress,
          receiptShowCashier: config.showCashier,
          receiptShowTableNo: config.showTableNo,
          receiptShowOrderNo: config.showOrderNo,
          receiptShowDateTime: config.showDateTime,
          receiptShowPaymentMethod: config.showPaymentMethod,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success("Receipt settings tersimpan!");
    } catch (e: any) {
      toast.error(e?.message || "Gagal simpan");
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof ReceiptConfig>(key: K, val: ReceiptConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: val }));
  }

  if (loading || loadingRole)
    return (
      <TerraPage>
        <SkeletonStyles />
        <PageSkeleton cards={3} />
      </TerraPage>
    );

  if (!canEdit) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman ini hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/dashboard")}>
            Dashboard
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={1100}>
      <style>{`
        .receipt-shell{
          display:grid;
          grid-template-columns: 1fr 320px;
          gap:16px;
          align-items:start;
        }
        @media (max-width: 860px){
          .receipt-shell{
            grid-template-columns: 1fr;
          }
        }
        .toggle-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:10px 0;
          border-bottom:1px solid var(--border);
        }
        .toggle-row:last-child{ border-bottom:none; }
        .toggle-label{
          font-weight:700;
          font-size:13px;
          color:var(--text);
        }
        .toggle-desc{
          font-size:11px;
          color:var(--muted);
          margin-top:2px;
        }
        .toggle-switch{
          position:relative;
          width:44px;
          height:24px;
          border-radius:999px;
          background:var(--border);
          cursor:pointer;
          transition: background 0.2s ease;
          flex-shrink:0;
        }
        .toggle-switch.active{
          background:var(--brand);
        }
        .toggle-switch::after{
          content:'';
          position:absolute;
          top:3px;
          left:3px;
          width:18px;
          height:18px;
          border-radius:50%;
          background:#fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          transition: transform 0.2s ease;
        }
        .toggle-switch.active::after{
          transform:translateX(20px);
        }
        .preview-card{
          position:sticky;
          top:16px;
          border:1px solid var(--border);
          border-radius:var(--radius-lg);
          background:var(--panel);
          box-shadow:var(--shadow-card);
          overflow:hidden;
        }
        .preview-header{
          padding:14px 16px;
          border-bottom:1px solid var(--border);
          font-weight:900;
          font-size:13px;
          color:var(--text);
          text-transform:uppercase;
          letter-spacing:0.3px;
        }
        .preview-body{
          padding:16px;
          font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background:#fafafa;
          min-height:300px;
        }
        .preview-body .store-name{
          font-weight:900;
          text-align:center;
        }
        .preview-body .center{
          text-align:center;
        }
        .preview-body .muted{
          color:var(--muted);
        }
        .preview-body .line{
          border-top:1px dashed var(--border);
          margin:8px 0;
        }
        .preview-body .item-row{
          display:flex;
          justify-content:space-between;
          padding:3px 0;
        }
        .preview-body .total-row{
          display:flex;
          justify-content:space-between;
          font-weight:900;
          padding:3px 0;
        }
        .font-slider{
          width:100%;
          margin-top:8px;
          accent-color:var(--brand);
        }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Pengaturan Struk</div>
            <div className="small">Atur tampilan struk / bill belanja</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        </div>
      </div>

      <div className="receipt-shell">
        {/* LEFT: SETTINGS */}
        <div style={{ display: "grid", gap: 14 }}>
          {/* Store Info */}
          <div className="card">
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>Informasi Toko</div>

            <div className="small">Nama Toko</div>
            <input
              className="input"
              value={config.storeName}
              onChange={(e) => update("storeName", e.target.value)}
              placeholder="Nama toko"
            />

            <div className="small" style={{ marginTop: 10 }}>Alamat</div>
            <input
              className="input"
              value={config.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Jl. Contoh No. 123"
            />

            <div className="small" style={{ marginTop: 10 }}>Nama Kasir (default)</div>
            <input
              className="input"
              value={config.cashierName}
              onChange={(e) => update("cashierName", e.target.value)}
              placeholder="Kasir TerraPOS"
            />

            <div className="small" style={{ marginTop: 10 }}>Footer Struk</div>
            <input
              className="input"
              value={config.footer}
              onChange={(e) => update("footer", e.target.value)}
              placeholder="Terima kasih."
            />
          </div>

          {/* Font Size */}
          <div className="card">
            <div style={{ fontWeight: 900, fontSize: 14 }}>Ukuran Font Struk</div>
            <div className="small" style={{ marginTop: 4 }}>
              {config.fontSize}px — {config.fontSize <= 11 ? "Kecil" : config.fontSize <= 13 ? "Normal" : config.fontSize <= 15 ? "Besar" : "Sangat Besar"}
            </div>
            <input
              type="range"
              className="font-slider"
              min={10}
              max={18}
              step={1}
              value={config.fontSize}
              onChange={(e) => update("fontSize", Number(e.target.value))}
            />
            <div className="row" style={{ marginTop: 4 }}>
              <span className="small">10px</span>
              <div className="spacer" />
              <span className="small">18px</span>
            </div>
          </div>

          {/* Show/Hide Fields */}
          <div className="card">
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>Tampilkan / Sembunyikan</div>

            <ToggleItem
              label="Logo Toko"
              desc="Tampilkan logo di bagian atas struk"
              value={config.showLogo}
              onChange={(v) => update("showLogo", v)}
            />
            <ToggleItem
              label="QR Code"
              desc="QR code untuk pembayaran digital"
              value={config.showQR}
              onChange={(v) => update("showQR", v)}
            />
            <ToggleItem
              label="Alamat"
              desc="Tampilkan alamat toko di struk"
              value={config.showAddress}
              onChange={(v) => update("showAddress", v)}
            />
            <ToggleItem
              label="Nama Kasir"
              desc="Tampilkan nama kasir yang melayani"
              value={config.showCashier}
              onChange={(v) => update("showCashier", v)}
            />
            <ToggleItem
              label="No. Meja"
              desc="Tampilkan nomor meja pelanggan"
              value={config.showTableNo}
              onChange={(v) => update("showTableNo", v)}
            />
            <ToggleItem
              label="No. Order"
              desc="Tampilkan nomor order"
              value={config.showOrderNo}
              onChange={(v) => update("showOrderNo", v)}
            />
            <ToggleItem
              label="Tanggal & Waktu"
              desc="Tampilkan waktu transaksi"
              value={config.showDateTime}
              onChange={(v) => update("showDateTime", v)}
            />
            <ToggleItem
              label="Metode Pembayaran"
              desc="Tampilkan metode bayar (CASH/QRIS)"
              value={config.showPaymentMethod}
              onChange={(v) => update("showPaymentMethod", v)}
            />
          </div>

          {/* Save */}
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "14px 0", fontSize: 14 }}
            disabled={busy}
            onClick={save}
          >
            {busy ? "Menyimpan..." : "Simpan Pengaturan Struk"}
          </button>
        </div>

        {/* RIGHT: LIVE PREVIEW */}
        <div className="preview-card">
          <div className="preview-header">Preview Struk</div>
          <div className="preview-body" style={{ fontSize: config.fontSize }}>
            {config.showLogo && (
              <div className="center" style={{ marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--brandSoft)", border: "1px solid var(--brand2)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 900, color: "var(--brand)" }}>
                  T
                </div>
              </div>
            )}

            <div className="store-name">{config.storeName || "TerraPOS"}</div>

            {config.showAddress && config.address && (
              <div className="center muted" style={{ fontSize: config.fontSize - 2 }}>
                {config.address}
              </div>
            )}

            <div className="center" style={{ marginTop: 6 }}>
              <span style={{ display: "inline-block", padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 999, fontSize: config.fontSize - 2, fontWeight: 900 }}>
                STRUK
              </span>
            </div>

            <div className="line" />

            {config.showDateTime && (
              <div className="muted" style={{ fontSize: config.fontSize - 2 }}>
                Waktu: {new Date().toLocaleString("id-ID")}
              </div>
            )}
            {config.showOrderNo && (
              <div className="muted" style={{ fontSize: config.fontSize - 2 }}>
                Order: ORD-001
              </div>
            )}
            {config.showTableNo && (
              <div className="muted" style={{ fontSize: config.fontSize - 2 }}>
                Meja: 5
              </div>
            )}
            {config.showCashier && (
              <div className="muted" style={{ fontSize: config.fontSize - 2 }}>
                Kasir: {config.cashierName || "Kasir"}
              </div>
            )}
            {config.showPaymentMethod && (
              <div className="muted" style={{ fontSize: config.fontSize - 2 }}>
                Metode: CASH
              </div>
            )}

            <div className="line" />

            {/* Sample Items */}
            <div>
              <div style={{ fontWeight: 700 }}>Nasi Goreng</div>
              <div className="item-row">
                <span className="muted">2 x {rupiah(15000)}</span>
                <span style={{ fontWeight: 700 }}>{rupiah(30000)}</span>
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ fontWeight: 700 }}>Es Teh Manis</div>
              <div className="item-row">
                <span className="muted">1 x {rupiah(5000)}</span>
                <span style={{ fontWeight: 700 }}>{rupiah(5000)}</span>
              </div>
            </div>

            <div className="line" />

            <div className="item-row muted">
              <span>Subtotal</span>
              <span>{rupiah(35000)}</span>
            </div>
            <div className="item-row muted">
              <span>Diskon</span>
              <span>{rupiah(0)}</span>
            </div>
            <div className="total-row">
              <span>TOTAL</span>
              <span>{rupiah(35000)}</span>
            </div>

            {config.showPaymentMethod && (
              <>
                <div className="item-row muted">
                  <span>Bayar</span>
                  <span>{rupiah(50000)}</span>
                </div>
                <div className="item-row muted">
                  <span>Kembalian</span>
                  <span>{rupiah(15000)}</span>
                </div>
              </>
            )}

            <div className="line" />

            {config.showQR && (
              <div className="center" style={{ marginBottom: 8 }}>
                <div style={{ width: 60, height: 60, border: "1px solid var(--border)", borderRadius: 4, margin: "0 auto", display: "grid", placeItems: "center", fontSize: 9, color: "var(--muted)" }}>
                  [QR]
                </div>
              </div>
            )}

            <div className="center muted" style={{ fontSize: config.fontSize - 1 }}>
              {config.footer || "Terima kasih."}
            </div>
          </div>
        </div>
      </div>
    </TerraPage>
  );
}

function ToggleItem({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        <div className="toggle-desc">{desc}</div>
      </div>
      <div
        className={`toggle-switch ${value ? "active" : ""}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      />
    </div>
  );
}
