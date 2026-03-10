"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export default function SettingsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const [storeName, setStoreName] = useState("TerraPOS");
  const [address, setAddress] = useState("");
  const [footer, setFooter] = useState("Terima kasih.");
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
        updatedAt: serverTimestamp(),
      }, { merge: true });
      alert("Tersimpan.");
    } catch (e: any) {
      setErr(e?.message || "Gagal simpan");
    } finally {
      setBusy(false);
    }
  }

  if (loading || loadingRole) return <TerraPage><div className="card">Loading...</div></TerraPage>;

  if (role !== "owner") {
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
      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Settings</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">User: {email} | Role: <b>{role}</b></div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/products")}>Products</button>
          <button className="btn" onClick={() => r.push("/staff")}>Staff</button>
          <button className="btn" onClick={() => r.push("/setup")}>Ganti Tenant</button>
          <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="small">Nama Warung</div>
        <input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} />

        <div className="small" style={{ marginTop: 10 }}>Alamat</div>
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />

        <div className="small" style={{ marginTop: 10 }}>Footer Struk</div>
        <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} />

        {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={save}>
          {busy ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </TerraPage>
  );
}