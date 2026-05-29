"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import PageHeader from "@/components/PageHeader";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useToast } from "@/components/Toast";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";

export default function SettingsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();
  const toast = useToast();

  // Store info
  const [storeName, setStoreName] = useState("TerraPOS");
  const [address, setAddress] = useState("");
  const [footer, setFooter] = useState("Terima kasih.");
  const [phone, setPhone] = useState("");
  const [openHours, setOpenHours] = useState("");

  // WhatsApp Notification
  const [waNumber, setWaNumber] = useState("");
  const [waEnabled, setWaEnabled] = useState(false);
  const [waApiUrl, setWaApiUrl] = useState("");
  const [waApiToken, setWaApiToken] = useState("");
  const [waMode, setWaMode] = useState<"manual" | "openwa" | "fonnte" | "wablas">("manual");

  // Tax
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercent, setTaxPercent] = useState("10");
  const [taxLabel, setTaxLabel] = useState("PB1");

  // State
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testingWA, setTestingWA] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d: any = snap.data();
          setStoreName(d.storeName || "TerraPOS");
          setAddress(d.address || "");
          setFooter(d.footer || "Terima kasih.");
          setPhone(d.phone || "");
          setOpenHours(d.openHours || "");
          setWaNumber(d.waNotifyNumber || "");
          setWaEnabled(d.waNotifyEnabled ?? false);
          setWaApiUrl(d.waApiUrl || "");
          setWaApiToken(d.waApiToken || "");
          setWaMode(d.waMode || "manual");
          setTaxEnabled(d.taxEnabled ?? false);
          setTaxPercent(d.taxPercent?.toString() || "10");
          setTaxLabel(d.taxLabel || "PB1");
        }
      } catch (e: any) {
        setErr(e?.message || "Gagal load settings");
      }
    })();
  }, [tenantId]);

  async function save() {
    if (!tenantId) return;
    setBusy(true); setErr(null);
    try {
      await setDoc(doc(db, `tenants/${tenantId}/settings/main`), {
        storeName: storeName.trim(),
        address: address.trim(),
        footer: footer.trim(),
        phone: phone.trim(),
        openHours: openHours.trim(),
        waNotifyNumber: waNumber.trim(),
        waNotifyEnabled: waEnabled,
        waApiUrl: waApiUrl.trim(),
        waApiToken: waApiToken.trim(),
        waMode,
        taxEnabled,
        taxPercent: Number(taxPercent) || 10,
        taxLabel: taxLabel.trim() || "PB1",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success("Settings tersimpan!");
    } catch (e: any) {
      setErr(e?.message || "Gagal simpan");
      toast.error(e?.message || "Gagal simpan");
    } finally {
      setBusy(false);
    }
  }

  async function testWA() {
    if (!waNumber.trim()) { toast.error("Isi nomor WA dulu"); return; }
    setTestingWA(true);
    try {
      let phone = waNumber.replace(/[^0-9]/g, "");
      if (phone.startsWith("0")) phone = "62" + phone.slice(1);
      if (!phone.startsWith("62")) phone = "62" + phone;

      const testMsg = `✅ Test notifikasi TerraPOS berhasil!\n\nNomor: ${phone}\nToko: ${storeName}\nWaktu: ${new Date().toLocaleString("id-ID")}`;

      if (waMode !== "manual" && waApiUrl.trim() && waApiToken.trim()) {
        let body: any;
        let headers: any = { "Content-Type": "application/json" };

        if (waMode === "openwa") {
          // Open-WA format
          headers["X-API-Key"] = waApiToken.trim();
          body = JSON.stringify({ chatId: `${phone}@c.us`, text: testMsg });
        } else if (waMode === "fonnte") {
          // Fonnte format
          headers["Authorization"] = waApiToken.trim();
          body = JSON.stringify({ target: phone, message: testMsg });
        } else {
          // Wablas format
          headers["Authorization"] = waApiToken.trim();
          body = JSON.stringify({ phone: phone, message: testMsg });
        }

        const res = await fetch(waApiUrl.trim(), { method: "POST", headers, body });
        if (res.ok) {
          toast.success("✅ Pesan test terkirim ke WhatsApp!");
        } else {
          const text = await res.text();
          toast.error("Gagal kirim: " + (text || res.statusText));
        }
      } else {
        // Manual mode
        const msg = `✅ Test notifikasi TerraPOS\n\nToko: ${storeName}\nWaktu: ${new Date().toLocaleString("id-ID")}`;
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, "_blank");
        toast.success("Link WA dibuka di tab baru");
      }
    } catch (e: any) {
      toast.error("Error: " + (e?.message || ""));
    } finally {
      setTestingWA(false);
    }
  }

  if (loading || loadingRole) return <TerraPage><SkeletonStyles /><PageSkeleton cards={2} /></TerraPage>;

  if (role !== "owner" && role !== "developer") {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman Settings hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/dashboard")}>Kembali</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={760}>
      <style>{`
        .settings-section {
          margin-top: 14px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 20px;
        }
        .settings-section-title {
          font-size: 16px;
          font-weight: 900;
          margin-bottom: 4px;
        }
        .settings-section-desc {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .settings-field {
          margin-bottom: 14px;
        }
        .settings-label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 6px;
        }
        .settings-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 640px) {
          .settings-row { grid-template-columns: 1fr; }
        }
        .settings-check {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
          padding: 10px 0;
        }
        .settings-check input {
          width: 20px;
          height: 20px;
          accent-color: var(--brand);
        }
        .settings-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
        }
        .wa-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          margin-bottom: 12px;
        }
        .wa-status.active { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
        .wa-status.inactive { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
      `}</style>

      <PageHeader title="Pengaturan Umum" subtitle="Konfigurasi toko & notifikasi">
        <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        <button className="btn" onClick={() => r.push("/settings/receipt")}>Struk</button>
      </PageHeader>

      {/* Section: Info Toko */}
      <div className="settings-section">
        <div className="settings-section-title">🏪 Informasi Toko</div>
        <div className="settings-section-desc">Data dasar outlet yang tampil di struk, menu customer, dan laporan.</div>

        <div className="settings-field">
          <label className="settings-label">Nama Toko / Outlet</label>
          <input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Contoh: Warung Kopi Nusantara" />
        </div>

        <div className="settings-row">
          <div className="settings-field">
            <label className="settings-label">Alamat</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Merdeka No. 123" />
          </div>
          <div className="settings-field">
            <label className="settings-label">No. Telepon</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08123456789" />
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-field">
            <label className="settings-label">Jam Buka</label>
            <input className="input" value={openHours} onChange={(e) => setOpenHours(e.target.value)} placeholder="08:00 - 22:00" />
          </div>
          <div className="settings-field">
            <label className="settings-label">Footer Struk</label>
            <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Terima kasih atas kunjungan Anda!" />
          </div>
        </div>
      </div>

      {/* Section: WhatsApp Notification */}
      <div className="settings-section">
        <div className="settings-section-title">📱 Notifikasi WhatsApp</div>
        <div className="settings-section-desc">
          Terima notifikasi otomatis ke WhatsApp saat ada pesanan QR dari customer.
        </div>

        {/* Status badge */}
        <div className={`wa-status ${waEnabled ? "active" : "inactive"}`}>
          <span style={{ fontSize: 16 }}>{waEnabled ? "✅" : "⏸️"}</span>
          <span style={{ fontWeight: 800, fontSize: 13 }}>
            {waEnabled ? "Notifikasi WhatsApp AKTIF" : "Notifikasi WhatsApp NONAKTIF"}
          </span>
        </div>

        <div className="settings-field">
          <label className="settings-label">Nomor WhatsApp Penerima</label>
          <input className="input" value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="08123456789 atau 628123456789" />
        </div>

        <div className="settings-field">
          <label className="settings-label">Mode Pengiriman</label>
          <select className="input" value={waMode} onChange={(e) => setWaMode(e.target.value as any)}>
            <option value="manual">Manual (buka link wa.me)</option>
            <option value="openwa">Otomatis - Open-WA (self-hosted, gratis)</option>
            <option value="fonnte">Otomatis - Fonnte.id</option>
            <option value="wablas">Otomatis - Wablas.com</option>
          </select>
          <div className="small" style={{ marginTop: 4 }}>
            {waMode === "manual" && "Saat order masuk, browser membuka WhatsApp dengan pesan ter-isi otomatis."}
            {waMode === "openwa" && "Gratis! Install Open-WA di VPS kamu. Docs: open-wa.org"}
            {waMode === "fonnte" && "Layanan berbayar dari Fonnte.id, stabil dan mudah."}
            {waMode === "wablas" && "Layanan berbayar dari Wablas.com."}
          </div>
        </div>

        {waMode !== "manual" && (
          <div className="settings-row">
            <div className="settings-field">
              <label className="settings-label">API URL</label>
              <input className="input" value={waApiUrl} onChange={(e) => setWaApiUrl(e.target.value)} placeholder={
                waMode === "openwa" ? "http://localhost:2785/api/sessions/default/messages/send-text"
                : waMode === "fonnte" ? "https://api.fonnte.com/send"
                : "https://api.wablas.com/api/send-message"
              } />
            </div>
            <div className="settings-field">
              <label className="settings-label">{waMode === "openwa" ? "X-API-Key" : "API Token"}</label>
              <input className="input" type="password" value={waApiToken} onChange={(e) => setWaApiToken(e.target.value)} placeholder={waMode === "openwa" ? "API key dari Open-WA config" : "Token dari provider"} />
            </div>
          </div>
        )}

        <label className="settings-check">
          <input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} />
          Aktifkan Notifikasi WhatsApp
        </label>

        <button className="btn" style={{ marginTop: 8 }} disabled={testingWA || !waNumber.trim()} onClick={testWA}>
          {testingWA ? "Mengirim..." : "🧪 Test Kirim WA"}
        </button>
      </div>

      {/* Section: Tax/Pajak */}
      <div className="settings-section">
        <div className="settings-section-title">💰 Pajak</div>
        <div className="settings-section-desc">Atur pajak yang ditampilkan di struk (PB1, Service Charge, dll).</div>

        <label className="settings-check">
          <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
          Aktifkan Pajak
        </label>

        {taxEnabled && (
          <div className="settings-row">
            <div className="settings-field">
              <label className="settings-label">Label Pajak</label>
              <input className="input" value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} placeholder="PB1" />
            </div>
            <div className="settings-field">
              <label className="settings-label">Persentase (%)</label>
              <input className="input" type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} placeholder="10" />
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="settings-section" style={{ borderColor: "transparent", boxShadow: "none", background: "transparent", padding: "14px 0" }}>
        {err && <div style={{ marginBottom: 10, color: "var(--danger)", fontWeight: 800, fontSize: 13 }}>{err}</div>}
        <button className="btn btn-primary" style={{ width: "100%", padding: 16, fontSize: 15 }} disabled={busy} onClick={save}>
          {busy ? "Menyimpan..." : "💾 Simpan Semua Pengaturan"}
        </button>
      </div>
    </TerraPage>
  );
}
