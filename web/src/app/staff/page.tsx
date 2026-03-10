"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";

export default function StaffPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const [uid, setUid] = useState("");
  const [staffRole, setStaffRole] = useState<"kasir" | "owner">("kasir");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addStaff() {
    if (!tenantId) return;
    const id = uid.trim();
    if (!id) return setErr("UID wajib diisi.");

    setBusy(true); setErr(null);
    try {
      await setDoc(doc(db, `tenants/${tenantId}/staff/${id}`), {
        role: staffRole,
        createdAt: serverTimestamp(),
      }, { merge: true });

      alert("Staff ditambahkan.");
      setUid("");
    } catch (e: any) {
      setErr(e?.message || "Gagal tambah staff");
    } finally {
      setBusy(false);
    }
  }

  if (loading || loadingRole) {
    return <TerraPage><div className="card">Loading...</div></TerraPage>;
  }

  if (role !== "owner") {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Hanya owner yang boleh buka halaman Staff.</div>
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
            <div className="h1">Staff</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">User: {email}</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/setup")}>Ganti Tenant</button>
          <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Tambah Staff (pakai UID)</div>
        <div className="small" style={{ marginTop: 6 }}>
          Ambil UID dari Firebase Console → Authentication → Users → UID
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="small">UID</div>
          <input className="input" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="contoh: p8S3k...UID..." />
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="small">Role</div>
          <select className="input" value={staffRole} onChange={(e) => setStaffRole(e.target.value as any)}>
            <option value="kasir">Kasir</option>
            <option value="owner">Owner</option>
          </select>
        </div>

        {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={addStaff}>
          {busy ? "Menyimpan..." : "Tambah Staff"}
        </button>
      </div>
    </TerraPage>
  );
}