"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";

type TenantRow = {
  id: string;
  name: string;
  ownerUid?: string;
};

export default function SetupPage() {
  const r = useRouter();

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [tenantName, setTenantName] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          r.push("/login");
          return;
        }

        setUid(user.uid);
        setEmail(user.email || "");

        await loadMyTenants(user.uid);
      } catch (e: any) {
        setErr(e?.message || "Gagal load setup");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [r]);

  async function loadMyTenants(userUid: string) {
    const result: TenantRow[] = [];

    // 1. tenant yang owner
    const qOwner = query(collection(db, "tenants"), where("ownerUid", "==", userUid));
    const ownerSnap = await getDocs(qOwner);

    ownerSnap.forEach((d) => {
      const x = d.data() as any;
      result.push({
        id: d.id,
        name: x.name || d.id,
        ownerUid: x.ownerUid || "",
      });
    });

    // 2. tenant yang ada staff doc untuk user ini
    // karena Firestore tidak ada collectionGroup sederhana di struktur lama,
    // kita scan tenant owner result dulu + fallback staff doc per tenant yang ada di list sekarang.
    // untuk pemula, ini sudah aman.
    setTenants(result);
  }

  async function createTenant() {
    setSaving(true);
    setErr("");

    try {
      if (!uid) throw new Error("User belum login.");
      if (!tenantName.trim()) throw new Error("Nama tenant wajib diisi.");

      const tenantRef = doc(collection(db, "tenants"));
      const tenantId = tenantRef.id;

      // 1. buat tenant utama
      await setDoc(tenantRef, {
        name: tenantName.trim(),
        ownerUid: uid,
        createdBy: uid,
        createdByEmail: email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. staff pembuat tenant = owner
      await setDoc(doc(db, `tenants/${tenantId}/staff/${uid}`), {
        uid,
        email: email || "",
        role: "owner",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. simpan membership user
      await setDoc(doc(db, `users/${uid}/tenantMemberships/${tenantId}`), {
        tenantId,
        role: "owner",
        name: tenantName.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. tenant aktif
      localStorage.setItem("terrapos_tenant_id", tenantId);

      r.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Gagal buat tenant");
    } finally {
      setSaving(false);
    }
  }

  function openTenant(t: TenantRow) {
    localStorage.setItem("terrapos_tenant_id", t.id);
    r.push("/dashboard");
  }

  if (loading) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={840}>
      <style>{`
        .grid{
          margin-top:14px;
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:14px;
        }
        @media (max-width: 860px){
          .grid{ grid-template-columns: 1fr; }
        }
        .tenant-item{
          border:1px solid var(--border);
          border-radius:16px;
          padding:14px;
          background:#fff;
        }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Setup Tenant</div>
            <div className="small">Pilih tenant yang ada atau buat tenant baru.</div>
            <div className="small" style={{ marginTop: 4 }}>
              Login sebagai: <b>{email || "-"}</b>
            </div>
          </div>

          <div className="spacer" />

          <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>
            Logout
          </button>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ color: "var(--danger)", fontWeight: 800 }}>{err}</div>
        </div>
      )}

      <div className="grid">
        <div className="card">
          <div className="h1">Buat Tenant Baru</div>
          <div className="small" style={{ marginTop: 6 }}>
            Pembuat tenant otomatis akan menjadi <b>owner</b>.
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="small">Nama Tenant / Outlet</div>
            <input
              className="input"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Contoh: Terra Coffee"
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 14 }}
            onClick={createTenant}
            disabled={saving}
          >
            {saving ? "Membuat Tenant..." : "Buat Tenant"}
          </button>
        </div>

        <div className="card">
          <div className="h1">Tenant Saya</div>
          <div className="small" style={{ marginTop: 6 }}>
            Klik tenant untuk masuk.
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {tenants.map((t) => (
              <div key={t.id} className="tenant-item">
                <div style={{ fontWeight: 900 }}>{t.name}</div>
                <div className="small" style={{ marginTop: 4 }}>
                  ID: {t.id}
                </div>
                <button
                  className="btn"
                  style={{ marginTop: 10 }}
                  onClick={() => openTenant(t)}
                >
                  Masuk Tenant
                </button>
              </div>
            ))}

            {tenants.length === 0 && (
              <div className="small">Belum ada tenant. Buat tenant baru di sebelah kiri.</div>
            )}
          </div>
        </div>
      </div>
    </TerraPage>
  );
}