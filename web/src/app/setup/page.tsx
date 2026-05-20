"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
} from "firebase/firestore";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";
import { setActiveTenantId } from "@/lib/tenant";

type TenantRow = {
  id: string;
  name: string;
  role?: string;
};

export default function SetupPage() {
  const r = useRouter();

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
    const membershipsSnap = await getDocs(
      query(collection(db, `users/${userUid}/tenantMemberships`))
    );

    const arr: TenantRow[] = [];
    const deletePromises: Promise<void>[] = [];

    for (const d of membershipsSnap.docs) {
      const x = d.data() as any;
      const tenantId = d.id;

      // Verifikasi apakah tenant masih ada di Firestore
      try {
        const tenantDoc = await getDoc(doc(db, `tenants/${tenantId}`));
        if (!tenantDoc.exists()) {
          // Tenant sudah dihapus — hapus membership stale ini
          deletePromises.push(
            deleteDoc(doc(db, `users/${userUid}/tenantMemberships/${tenantId}`))
          );
          continue;
        }

        // Tenant masih ada, ambil nama terbaru dari tenant doc
        const tenantData = tenantDoc.data() as any;
        arr.push({
          id: tenantId,
          name: tenantData.name || x.name || tenantId,
          role: x.role || "",
        });
      } catch {
        // Jika permission denied (bukan member), skip tapi tetap tampilkan dari cache
        arr.push({
          id: tenantId,
          name: x.name || tenantId,
          role: x.role || "",
        });
      }
    }

    // Cleanup stale memberships in background
    if (deletePromises.length > 0) {
      Promise.all(deletePromises).catch(() => {});
    }

    setTenants(arr);

    // Jika tidak punya tenant sama sekali, redirect ke waiting
    if (arr.length === 0) {
      r.push("/waiting");
    }
  }

  async function openTenant(t: TenantRow) {
    try {
      // Double-check tenant masih ada sebelum masuk
      const tenantDoc = await getDoc(doc(db, `tenants/${t.id}`));
      if (!tenantDoc.exists()) {
        // Tenant sudah dihapus, cleanup & refresh list
        await deleteDoc(doc(db, `users/${uid}/tenantMemberships/${t.id}`));
        setTenants((prev) => prev.filter((x) => x.id !== t.id));
        setErr("Tenant ini sudah dihapus. Daftar telah diperbarui.");
        return;
      }

      await setActiveTenantId(uid, t.id);
      r.push("/dashboard");
    } catch {
      await setActiveTenantId(uid, t.id);
      r.push("/dashboard");
    }
  }

  if (loading) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={600}>
      <style>{`
        .setup-wrap{
          min-height:80vh;
          min-height:80dvh;
          display:grid;
          place-items:center;
          padding:16px 0;
        }
        .tenant-item{
          border:1px solid var(--border);
          border-radius:16px;
          padding:14px;
          background:var(--bg);
          transition: border-color 0.2s;
        }
        .tenant-item:hover{
          border-color: var(--brand);
        }
        .role-badge{
          display:inline-block;
          padding:2px 8px;
          border-radius:4px;
          font-size:11px;
          font-weight:700;
          text-transform:uppercase;
          background:var(--panel);
          color:var(--brand);
        }
      `}</style>

      <div className="setup-wrap">
        <div style={{ width: "100%" }}>
          <div className="card">
            <div className="row">
              <div>
                <div className="h1">Pilih Outlet</div>
                <div className="small" style={{ marginTop: 4 }}>
                  Login sebagai: <b>{email || "-"}</b>
                </div>
              </div>

              <div className="spacer" />

              <button
                className="btn btn-danger"
                onClick={() => signOut(auth).then(() => r.push("/login"))}
              >
                Logout
              </button>
            </div>
          </div>

          {err && (
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ color: "var(--danger)", fontWeight: 800 }}>{err}</div>
            </div>
          )}

          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-title">Tenant Saya</div>
            <div className="card-sub">Pilih outlet untuk masuk.</div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {tenants.map((t) => (
                <div key={t.id} className="tenant-item">
                  <div className="row" style={{ alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900 }}>{t.name}</div>
                      <div className="small" style={{ marginTop: 4 }}>
                        <span className="role-badge">{t.role || "member"}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => openTenant(t)}
                    >
                      Masuk
                    </button>
                  </div>
                </div>
              ))}

              {tenants.length === 0 && (
                <div className="small" style={{ textAlign: "center", padding: 20 }}>
                  Belum ada outlet yang di-assign. Hubungi admin.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TerraPage>
  );
}
