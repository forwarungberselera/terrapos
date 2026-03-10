"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";

type MyTenant = { tenantId: string; name: string; role: string };

function makeId() {
  return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export default function SetupPage() {
  const r = useRouter();

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [tenants, setTenants] = useState<MyTenant[]>([]);
  const [newName, setNewName] = useState("Warkop Terra");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return r.push("/login");
      setUid(u.uid);
      setEmail(u.email ?? "");
      await loadMyTenants(u.uid);
    });
    return () => unsub();
  }, [r]);

  async function loadMyTenants(userId: string) {
    try {
      const ref = collection(db, `users/${userId}/tenants`);
      const snap = await getDocs(ref);
      const arr = snap.docs.map((d) => {
        const data = d.data() as any;
        return { tenantId: d.id, name: data.name || d.id, role: data.role || "owner" };
      });
      setTenants(arr);
    } catch (e: any) {
      setErr(e?.message || "Gagal load tenant list");
      setTenants([]);
    }
  }

  async function chooseTenant(tenantId: string) {
    setBusy(true); setErr(null);
    try {
      await setDoc(doc(db, "users", uid), { currentTenantId: tenantId, updatedAt: serverTimestamp() }, { merge: true });
      r.push("/pos");
    } catch (e: any) {
      setErr(e?.message || "Gagal memilih tenant");
    } finally {
      setBusy(false);
    }
  }

  async function createTenant() {
    const name = newName.trim();
    if (!name) return setErr("Nama tenant wajib diisi.");

    setBusy(true); setErr(null);
    try {
      const tenantId = makeId();

      // 1) membership user
      await setDoc(doc(db, `users/${uid}/tenants`, tenantId), {
        name, role: "owner", createdAt: serverTimestamp(),
      });

      // 2) tenant root
      await setDoc(doc(db, "tenants", tenantId), {
        name, ownerUid: uid, createdAt: serverTimestamp(),
      });

      // 3) staff owner ✅
      await setDoc(doc(db, `tenants/${tenantId}/staff/${uid}`), {
        role: "owner",
        email,
        createdAt: serverTimestamp(),
      });

      // 4) set current tenant
      await setDoc(doc(db, "users", uid), {
        currentTenantId: tenantId, updatedAt: serverTimestamp(),
      }, { merge: true });

      // 5) default settings
      await setDoc(doc(db, `tenants/${tenantId}/settings/main`), {
        storeName: name, address: "", footer: "Terima kasih.", createdAt: serverTimestamp(),
      });

      r.push("/pos");
    } catch (e: any) {
      setErr(e?.message || "Gagal buat tenant");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TerraPage maxWidth={980}>
      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Setup Tenant</div>
            <div className="small">User: {email || "-"}</div>
          </div>
          <div className="spacer" />
          <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="h1">Buat Tenant Baru</div>
          <div className="small" style={{ marginTop: 6 }}>1 tenant = 1 warung / 1 cabang</div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Nama</div>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>

          {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={createTenant}>
            {busy ? "Membuat..." : "Buat & Masuk"}
          </button>
        </div>

        <div className="card">
          <div className="h1">Pilih Tenant</div>
          <div className="small" style={{ marginTop: 6 }}>Klik untuk masuk</div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {tenants.map((t) => (
              <button key={t.tenantId} className="btn" style={{ textAlign: "left" }} disabled={busy} onClick={() => chooseTenant(t.tenantId)}>
                <div style={{ fontWeight: 900 }}>{t.name}</div>
                <div className="small">Role: {t.role}</div>
                <div className="small">ID: {t.tenantId}</div>
              </button>
            ))}
          </div>

          {tenants.length === 0 && <div className="small" style={{ marginTop: 12 }}>Belum ada tenant.</div>}
        </div>
      </div>
    </TerraPage>
  );
}