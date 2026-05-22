"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { checkIsDeveloper } from "@/lib/developer";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

type UserItem = { uid: string; email: string; name: string; level: string };

export default function DevUsersPage() {
  const r = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { r.push("/login"); return; }
      setEmail(user.email || "");
      const dev = await checkIsDeveloper(user.uid, user.email || "");
      if (!dev) { r.push("/dev"); return; }
      setIsDev(true);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  useEffect(() => { if (isDev) loadUsers(); }, [isDev]);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => { const data = d.data() as any; return { uid: d.id, email: data.email || "-", name: data.name || "-", level: data.level || "free" }; }));
    } catch (e: any) { toast.error("Gagal load: " + (e?.message || "")); }
    finally { setLoadingUsers(false); }
  }

  async function changeLevel(u: UserItem, newLevel: string) {
    try {
      await updateDoc(doc(db, `users/${u.uid}`), { level: newLevel, updatedAt: serverTimestamp() });
      setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, level: newLevel } : x));
      toast.success(`Level ${u.email} → ${newLevel}`);
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
  }

  async function assignTenant(u: UserItem) {
    const tid = prompt(`Assign "${u.email}" ke tenant ID:`);
    if (!tid) return;
    const role = prompt("Role (owner/admin/staff):", "admin");
    if (!role) return;
    try {
      const tenantSnap = await getDoc(doc(db, `tenants/${tid}`));
      const tenantName = tenantSnap.exists() ? ((tenantSnap.data() as any).name || tid) : tid;
      await setDoc(doc(db, `users/${u.uid}/tenantMemberships/${tid}`), { tenantId: tid, name: tenantName, role, assignedBy: email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await setDoc(doc(db, `tenants/${tid}/staff/${u.uid}`), { uid: u.uid, email: u.email, name: u.name, role, assignedBy: email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      toast.success(`${u.email} → ${tenantName} (${role})`);
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
  }

  async function deleteUser(u: UserItem) {
    if (!confirm(`Hapus data Firestore untuk "${u.email}"?`)) return;
    try {
      await deleteDoc(doc(db, `users/${u.uid}`));
      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
      toast.success(`"${u.email}" dihapus.`);
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
  }

  async function createAccount() {
    if (!newName.trim() || !newEmail.trim() || !newPass.trim()) { toast.error("Semua field wajib diisi."); return; }
    if (newPass.length < 6) { toast.error("Password minimal 6 karakter."); return; }
    setCreating(true);
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth } = await import("firebase/auth");
      let secondaryApp = getApps().find((a) => a.name === "secondary");
      if (!secondaryApp) { const primaryApp = getApps()[0]; secondaryApp = initializeApp(primaryApp.options, "secondary"); }
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPass);
      await updateProfile(cred.user, { displayName: newName });
      await setDoc(doc(db, `users/${cred.user.uid}`), { uid: cred.user.uid, name: newName, email: newEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: email }, { merge: true });
      await secondaryAuth.signOut();
      toast.success(`Akun "${newEmail}" dibuat!`);
      setNewName(""); setNewEmail(""); setNewPass("");
      loadUsers();
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
    finally { setCreating(false); }
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return u.email.toLowerCase().includes(s) || u.name.toLowerCase().includes(s) || u.level.toLowerCase().includes(s);
  });

  if (loading) return <TerraPage maxWidth={900}><SkeletonStyles /><PageSkeleton cards={2} /></TerraPage>;

  return (
    <TerraPage maxWidth={900}>
      <style>{`
        .usr-row{padding:12px 14px;border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;gap:10px;background:var(--panel);flex-wrap:wrap;transition:all 0.15s;}
        .usr-row:hover{border-color:var(--brand);}
        .usr-actions{display:flex;gap:6px;flex-wrap:wrap;}
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">User Management</div>
            <div className="small">Kelola akun, ubah level, assign tenant, buat akun baru.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dev")}>← Dev Console</button>
        </div>
      </div>

      {/* CREATE ACCOUNT */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>Buat Akun Baru</div>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><div className="small">Nama</div><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama" /></div>
          <div><div className="small">Email</div><input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@contoh.com" /></div>
          <div><div className="small">Password</div><input className="input" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Min 6 char" /></div>
        </div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={createAccount} disabled={creating}>{creating ? "Membuat..." : "Buat Akun"}</button>
      </div>

      {/* SEARCH */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <input className="input" style={{ flex: 1 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari user (nama, email, level)..." />
          <button className="btn" onClick={loadUsers} disabled={loadingUsers}>{loadingUsers ? "..." : "Refresh"}</button>
        </div>
        <div className="small" style={{ marginTop: 6 }}>{filtered.length} user</div>
      </div>

      {/* USER LIST */}
      <div style={{ marginTop: 14, display: "grid", gap: 8, maxHeight: 600, overflowY: "auto" }}>
        {loadingUsers ? <div className="card"><div className="small">Memuat...</div></div> :
          filtered.map((u) => (
            <div key={u.uid} className="usr-row">
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{u.name}</div>
                <div className="small">{u.email}</div>
              </div>
              <select className="input" style={{ width: 90, fontSize: 12, padding: "6px 8px" }} value={u.level} onChange={(e) => changeLevel(u, e.target.value)}>
                <option value="free">Free</option>
                <option value="seed">Seed</option>
                <option value="core">Core</option>
                <option value="orbit">Orbit</option>
              </select>
              <div className="usr-actions">
                <button className="btn" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => assignTenant(u)}>Assign</button>
                <button className="btn btn-danger" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => deleteUser(u)}>Hapus</button>
              </div>
            </div>
          ))
        }
      </div>
    </TerraPage>
  );
}
