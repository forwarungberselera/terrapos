"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";

type Member = { id: string; name: string; phone: string; points: number };

export default function MembersPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const [members, setMembers] = useState<Member[]>([]);
  const [qText, setQText] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/members`);
    const qy = query(ref, orderBy("name", "asc"));
    return onSnapshot(qy, (snap) => {
      const arr: Member[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, name: data.name || "", phone: data.phone || "", points: Number(data.points || 0) };
      });
      setMembers(arr);
    }, (e) => setErr(e.message));
  }, [tenantId]);

  const filtered = useMemo(() => {
    const s = qText.trim().toLowerCase();
    if (!s) return members;
    return members.filter((m) => (m.name || "").toLowerCase().includes(s) || (m.phone || "").toLowerCase().includes(s));
  }, [members, qText]);

  async function addMember() {
    if (!tenantId) return;
    setErr(null);
    const n = name.trim();
    const p = phone.trim();
    if (!n) return setErr("Nama wajib diisi.");
    if (!p) return setErr("No HP wajib diisi.");

    setBusy(true);
    try {
      await addDoc(collection(db, `tenants/${tenantId}/members`), { name: n, phone: p, points: 0, createdAt: serverTimestamp() });
      setName(""); setPhone("");
    } catch (e: any) {
      setErr(e?.message || "Gagal tambah member");
    } finally {
      setBusy(false);
    }
  }

  async function addPoint(m: Member, plus: number) {
    if (!tenantId) return;
    await updateDoc(doc(db, `tenants/${tenantId}/members/${m.id}`), { points: Math.max(0, (m.points || 0) + plus), updatedAt: serverTimestamp() });
  }

  async function removeMember(m: Member) {
    if (!tenantId) return;
    if (!confirm(`Hapus "${m.name}"?`)) return;
    await deleteDoc(doc(db, `tenants/${tenantId}/members/${m.id}`));
  }

  if (loading || loadingRole) return <TerraPage><div className="card">Loading...</div></TerraPage>;

  if (role !== "owner") {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman Members hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>Kembali ke POS</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Members</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">User: {email} | Role: <b>{role}</b></div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/products")}>Products</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => r.push("/settings")}>Settings</button>
          <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="h1">Tambah Member</div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Nama</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="small">No HP</div>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={addMember}>
            {busy ? "Menyimpan..." : "Tambah"}
          </button>
        </div>

        <div className="card">
          <div className="row">
            <div className="h1">Daftar Member</div>
            <div className="spacer" />
            <input className="input" style={{ maxWidth: 360 }} value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Cari nama/no hp..." />
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {filtered.map((m) => (
              <div key={m.id} className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>{m.name}</div>
                <div className="small">{m.phone}</div>
                <div style={{ marginTop: 6, fontWeight: 900 }}>Points: {m.points}</div>

                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => addPoint(m, +1)}>+1</button>
                  <button className="btn" onClick={() => addPoint(m, +10)}>+10</button>
                  <button className="btn" onClick={() => addPoint(m, -1)}>-1</button>
                  <button className="btn btn-danger" onClick={() => removeMember(m)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && <div className="small" style={{ marginTop: 12 }}>Belum ada member.</div>}
        </div>
      </div>
    </TerraPage>
  );
}