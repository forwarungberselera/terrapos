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
type TenantOption = { id: string; name: string };

export default function DevUsersPage() {
  const r = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);

  // Assign modal state
  const [assignModal, setAssignModal] = useState<UserItem | null>(null);
  const [assignTenantId, setAssignTenantId] = useState("");
  const [assignRole, setAssignRole] = useState("admin");
  const [assigning, setAssigning] = useState(false);

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

  useEffect(() => { if (isDev) { loadUsers(); loadTenants(); } }, [isDev]);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => { const data = d.data() as any; return { uid: d.id, email: data.email || "-", name: data.name || "-", level: data.level || "free" }; }));
    } catch (e: any) { toast.error("Gagal load: " + (e?.message || "")); }
    finally { setLoadingUsers(false); }
  }

  async function loadTenants() {
    try {
      const snap = await getDocs(collection(db, "tenants"));
      setTenants(snap.docs.map((d) => { const data = d.data() as any; return { id: d.id, name: data.name || data.storeName || d.id }; }));
    } catch {}
  }

  async function changeLevel(u: UserItem, newLevel: string) {
    try {
      await updateDoc(doc(db, `users/${u.uid}`), { level: newLevel, updatedAt: serverTimestamp() });
      setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, level: newLevel } : x));
      toast.success(`Level ${u.email} → ${newLevel}`);
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
  }

  function openAssignModal(u: UserItem) {
    setAssignModal(u);
    setAssignTenantId(tenants.length > 0 ? tenants[0].id : "");
    setAssignRole("admin");
  }

  async function handleAssign() {
    if (!assignModal || !assignTenantId) { toast.error("Pilih tenant terlebih dahulu."); return; }
    setAssigning(true);
    try {
      const t = tenants.find((x) => x.id === assignTenantId);
      const tenantName = t?.name || assignTenantId;
      await setDoc(doc(db, `users/${assignModal.uid}/tenantMemberships/${assignTenantId}`), { tenantId: assignTenantId, name: tenantName, role: assignRole, assignedBy: email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await setDoc(doc(db, `tenants/${assignTenantId}/staff/${assignModal.uid}`), { uid: assignModal.uid, email: assignModal.email, name: assignModal.name, role: assignRole, assignedBy: email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      toast.success(`${assignModal.email} → ${tenantName} (${assignRole})`);
      setAssignModal(null);
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
    finally { setAssigning(false); }
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
        .usr-create-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px;}
        @media(max-width:640px){
          .usr-create-grid{grid-template-columns:1fr;}
          .usr-row{flex-direction:column;align-items:stretch;gap:8px;}
          .usr-actions{justify-content:stretch;}
          .usr-actions button{flex:1;}
        }
        .assign-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;}
        .assign-modal{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2);}
        .assign-modal .h1{font-size:16px;}
      `}</style>

      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
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
        <div className="usr-create-grid">
          <div><div className="small">Nama</div><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama" /></div>
          <div><div className="small">Email</div><input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@contoh.com" /></div>
          <div><div className="small">Password</div><input className="input" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Min 6 char" /></div>
        </div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={createAccount} disabled={creating}>{creating ? "Membuat..." : "Buat Akun"}</button>
      </div>

      {/* SEARCH */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari user (nama, email, level)..." />
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
                <button className="btn" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => openAssignModal(u)}>Assign Tenant</button>
                <button className="btn btn-danger" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => deleteUser(u)}>Hapus</button>
              </div>
            </div>
          ))
        }
      </div>

      {/* ASSIGN TENANT MODAL */}
      {assignModal && (
        <div className="assign-overlay" onClick={() => setAssignModal(null)}>
          <div className="assign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="h1">Assign Tenant</div>
            <div className="small" style={{ marginTop: 6 }}>
              Assign <b>{assignModal.name}</b> ({assignModal.email}) ke tenant:
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Pilih Tenant</div>
              {tenants.length === 0 ? (
                <div className="small" style={{ color: "var(--danger)" }}>Tidak ada tenant tersedia.</div>
              ) : (
                <select className="input" value={assignTenantId} onChange={(e) => setAssignTenantId(e.target.value)} style={{ width: "100%" }}>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Role</div>
              <select className="input" value={assignRole} onChange={(e) => setAssignRole(e.target.value)} style={{ width: "100%" }}>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAssign} disabled={assigning || !assignTenantId}>
                {assigning ? "Assigning..." : "Assign"}
              </button>
              <button className="btn" style={{ flex: 1 }} onClick={() => setAssignModal(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </TerraPage>
  );
}
