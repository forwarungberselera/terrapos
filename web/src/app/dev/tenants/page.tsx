"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, db, authReadyPromise } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { checkIsDeveloper } from "@/lib/developer";
import { setStoredTenantId, getStoredTenantId } from "@/lib/tenant";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

type TenantItem = { id: string; ownerUid: string; ownerEmail?: string; name?: string; createdAt?: any };

export default function DevTenantsPage() {
  const r = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { await authReadyPromise; if (!auth.currentUser) { r.push("/login"); return; } return; }
      setEmail(user.email || "");
      setUid(user.uid);
      const dev = await checkIsDeveloper(user.uid, user.email || "");
      if (!dev) { r.push("/dev"); return; }
      setIsDev(true);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  useEffect(() => {
    if (!isDev) return;
    loadTenants();
  }, [isDev]);

  async function loadTenants() {
    setLoadingTenants(true);
    try {
      const snap = await getDocs(collection(db, "tenants"));
      setTenants(snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, ownerUid: data.ownerUid || "", ownerEmail: data.ownerEmail || "", name: data.name || data.storeName || d.id, createdAt: data.createdAt };
      }));
    } catch (e: any) { toast.error("Gagal load: " + (e?.message || "")); }
    finally { setLoadingTenants(false); }
  }

  async function switchToTenant(tid: string) {
    try {
      setStoredTenantId(tid);
      if (uid) {
        const { setActiveTenantId } = await import("@/lib/tenant");
        await setActiveTenantId(uid, tid);
      }
      toast.success(`Switched ke tenant: ${tid}`);
      setTimeout(() => { window.location.href = "/pos"; }, 500);
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
  }

  async function deleteTenant(t: TenantItem) {
    if (!confirm(`HAPUS tenant "${t.name}"?\nSemua data akan HILANG PERMANEN.`)) return;
    const confirmText = prompt('Ketik "HAPUS" untuk konfirmasi:');
    if (confirmText !== "HAPUS") { toast.error("Dibatalkan."); return; }
    try {
      await deleteDoc(doc(db, `tenants/${t.id}`));
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        for (const userDoc of usersSnap.docs) { try { await deleteDoc(doc(db, `users/${userDoc.id}/tenantMemberships/${t.id}`)); } catch {} }
      } catch {}
      toast.success(`Tenant "${t.name}" dihapus.`);
      setTenants((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
  }

  const filtered = tenants.filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (t.name || "").toLowerCase().includes(s) || t.id.toLowerCase().includes(s) || (t.ownerEmail || "").toLowerCase().includes(s);
  });

  if (loading) return <TerraPage maxWidth={800}><SkeletonStyles /><PageSkeleton cards={2} /></TerraPage>;

  return (
    <TerraPage maxWidth={800}>
      <style>{`
        .tn-row{padding:14px;border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;gap:12px;background:var(--panel);transition:all 0.15s;}
        .tn-row:hover{border-color:var(--brand);background:var(--brandSoft);}
        .tn-actions{display:flex;gap:6px;flex-shrink:0;}
        @media(max-width:640px){
          .tn-row{flex-direction:column;align-items:stretch;gap:10px;}
          .tn-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
          .tn-actions button{width:100%;text-align:center;}
        }
      `}</style>

      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="h1">Tenant Management</div>
            <div className="small">{tenants.length} tenant terdaftar</div>
          </div>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={() => r.push("/dev/create-tenant")}>+ Buat Tenant</button>
          <button className="btn" onClick={() => r.push("/dev")}>← Dev Console</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari tenant (nama, ID, email)..." style={{ width: "100%" }} />
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10, maxHeight: 600, overflowY: "auto" }}>
        {loadingTenants ? <div className="card"><div className="small">Memuat...</div></div> :
          filtered.length === 0 ? <div className="card"><div className="small">Tidak ada tenant ditemukan.</div></div> :
          filtered.map((t) => (
            <div key={t.id} className="tn-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{t.name}</div>
                <div className="small">ID: {t.id} • Owner: {t.ownerEmail || t.ownerUid || "-"}</div>
              </div>
              <div className="tn-actions">
                <button className="btn btn-primary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => switchToTenant(t.id)}>Switch</button>
                <button className="btn btn-danger" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => deleteTenant(t)}>Hapus</button>
              </div>
            </div>
          ))
        }
      </div>
    </TerraPage>
  );
}
