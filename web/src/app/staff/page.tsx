"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

type StaffItem = {
  id: string;
  uid: string;
  email: string;
  role: "owner" | "admin";
};

export default function StaffPage() {
  const r = useRouter();
  const { tenantId, loading } = useTenant();
  const { role, loadingRole } = useRole();

  const isOwner = (role || "").toLowerCase() === "owner";

  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!tenantId) return;

    const qy = query(collection(db, `tenants/${tenantId}/staff`), orderBy("email", "asc"));
    return onSnapshot(qy, (snap) => {
      const arr: StaffItem[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          uid: x.uid || d.id,
          email: x.email || "",
          role: (x.role || "admin") as "owner" | "admin",
        };
      });
      setStaff(arr);
    });
  }, [tenantId]);

  async function addAdmin() {
    try {
      if (!tenantId) return;
      if (!newEmail.trim()) {
        setMsg("Email wajib diisi.");
        return;
      }

      const usersSnap = await getDocs(query(collection(db, "users")));
      const found = usersSnap.docs.find((d) => {
        const x = d.data() as any;
        return (x.email || "").toLowerCase() === newEmail.trim().toLowerCase();
      });

      if (!found) {
        setMsg("User dengan email itu belum terdaftar.");
        return;
      }

      const userId = found.id;

      await setDoc(
        doc(db, `tenants/${tenantId}/staff/${userId}`),
        {
          uid: userId,
          email: newEmail.trim().toLowerCase(),
          role: "admin",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, `users/${userId}/tenantMemberships/${tenantId}`),
        {
          tenantId,
          name: tenantId,
          role: "admin",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNewEmail("");
      setMsg("Admin berhasil ditambahkan.");
    } catch (e: any) {
      setMsg(e?.message || "Gagal tambah admin.");
    }
  }

  async function setAdmin(userId: string) {
    if (!tenantId) return;
    await updateDoc(doc(db, `tenants/${tenantId}/staff/${userId}`), {
      role: "admin",
      updatedAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, `users/${userId}/tenantMemberships/${tenantId}`),
      {
        tenantId,
        name: tenantId,
        role: "admin",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  if (!isOwner) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman staff hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/dashboard")}>
            Kembali
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={900}>
      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Staff</div>
            <div className="small">Versi simpel: hanya owner dan admin.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="small">Tambah Admin (pakai email akun yang sudah terdaftar)</div>
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email admin"
          />
          <button className="btn btn-primary" onClick={addAdmin}>Tambah Admin</button>
        </div>
        {msg && <div style={{ marginTop: 10, fontWeight: 800 }}>{msg}</div>}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Daftar Staff</div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {staff.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 14,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 900 }}>{s.email || s.uid}</div>
              <div className="small" style={{ marginTop: 4 }}>
                Role: <b>{s.role}</b>
              </div>

              {s.role !== "owner" && (
                <button className="btn" style={{ marginTop: 10 }} onClick={() => setAdmin(s.uid)}>
                  Jadikan Admin
                </button>
              )}
            </div>
          ))}

          {staff.length === 0 && (
            <div className="small">Belum ada staff.</div>
          )}
        </div>
      </div>
    </TerraPage>
  );
}