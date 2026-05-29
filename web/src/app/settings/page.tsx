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

  const [storeName, setStoreName] = useState("TerraPOS");
  const [address, setAddress] = useState("");
  const [footer, setFooter] = useState("Terima kasih.");
  const [waNumber, setWaNumber] = useState("");
  const [waEnabled, setWaEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
          setWaNumber(d.waNotifyNumber || "");
          setWaEnabled(d.waNotifyEnabled ?? false);
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
        waNotifyNumber: waNumber.trim(),
        waNotifyEnabled: waEnabled,
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

  if (loading || loadingRole) return <TerraPage><SkeletonStyles /><PageSkeleton cards={2} /></TerraPage>;

  if (role !== "owner" && role !== "developer") {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman Settings hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>Kembali ke POS</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={720}>
      <PageHeader title="Settings">
        <button className="btn" onClick={() => r.push("/pos")}>POS</button>
        <button className="btn" onClick={() => r.push("/products")}>Products</button>
        <button className="btn" onClick={() => r.push("/staff-accounts")}>Staff PIN</button>
        <button className="btn" onClick={() => r.push("/setup")}>Ganti Tenant</button>
        <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
      </PageHeader>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="small">Nama Warung</div>
        <input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} />

        <div className="small" style={{ marginTop: 10 }}>Alamat</div>
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />

        <div className="small" style={{ marginTop: 10 }}>Footer Struk</div>
        <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} />

        {/* WhatsApp Notification */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="h1" style={{ fontSize: 16, marginBottom: 8 }}>WhatsApp Notifikasi</div>
          <div className="small" style={{ marginBottom: 10 }}>Terima notifikasi WA saat ada pesanan QR masuk.</div>

          <div className="small" style={{ marginTop: 8 }}>Nomor WhatsApp (format: 08xxx atau 628xxx)</div>
          <input className="input" value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="08123456789" />

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
            Aktifkan notifikasi WhatsApp
          </label>
        </div>

        {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={save}>
          {busy ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </TerraPage>
  );
}