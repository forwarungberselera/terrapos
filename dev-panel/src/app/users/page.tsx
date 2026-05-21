"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

interface UserDoc {
  uid: string;
  email: string;
  name: string;
  level: string;
}

interface TenantDoc {
  id: string;
  name: string;
}

interface MembershipDoc {
  tenantId: string;
  tenantName: string;
  role: string;
}

const LEVEL_OPTIONS = ["free", "seed", "core", "orbit"] as const;
const ROLE_OPTIONS = ["staff", "admin", "owner"] as const;

const LEVEL_COLORS: Record<string, string> = {
  free: "#6b7280",
  seed: "#22c55e",
  core: "#3b82f6",
  orbit: "#a855f7",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [tenants, setTenants] = useState<TenantDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [updatingLevel, setUpdatingLevel] = useState<string | null>(null);

  // Create user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // Assign/Unassign tenant modal
  const [assignUser, setAssignUser] = useState<UserDoc | null>(null);
  const [assignTenantId, setAssignTenantId] = useState("");
  const [assignRole, setAssignRole] = useState<string>("staff");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");
  const [userMemberships, setUserMemberships] = useState<MembershipDoc[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list: UserDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || "\u2014",
          name: data.name || data.displayName || "\u2014",
          level: data.level || "free",
        };
      });
      setUsers(list);
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const snap = await getDocs(collection(db, "tenants"));
      const list: TenantDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || data.storeName || d.id,
        };
      });
      setTenants(list);
    } catch (e) {
      console.error("Failed to load tenants:", e);
    }
  };

  const loadUserMemberships = async (uid: string) => {
    setLoadingMemberships(true);
    try {
      const snap = await getDocs(collection(db, `users/${uid}/tenantMemberships`));
      const list: MembershipDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          tenantId: d.id,
          tenantName: data.name || d.id,
          role: data.role || "staff",
        };
      });
      setUserMemberships(list);
    } catch (e) {
      console.error("Failed to load memberships:", e);
      setUserMemberships([]);
    } finally {
      setLoadingMemberships(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadTenants();
  }, []);

  const handleDelete = async (uid: string, email: string) => {
    if (!confirm(`Hapus user "${email}" (${uid}) dari Firestore?\n\nIni hanya menghapus dokumen Firestore, bukan akun Firebase Auth.`)) {
      return;
    }
    setDeleting(uid);
    try {
      await deleteDoc(doc(db, "users", uid));
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (e: any) {
      console.error("Failed to delete user:", e);
      alert("Gagal hapus: " + (e?.message || ""));
    } finally {
      setDeleting(null);
    }
  };

  const handleSetLevel = async (uid: string, newLevel: string) => {
    setUpdatingLevel(uid);
    try {
      await updateDoc(doc(db, "users", uid), {
        level: newLevel,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, level: newLevel } : u))
      );
    } catch (e: any) {
      alert("Gagal update level: " + (e?.message || ""));
    } finally {
      setUpdatingLevel(null);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    const email = newEmail.trim();
    const pass = newPass.trim();

    if (!name || !email || !pass) {
      setCreateMsg("Semua field wajib diisi.");
      return;
    }
    if (pass.length < 6) {
      setCreateMsg("Password minimal 6 karakter.");
      return;
    }

    setCreating(true);
    setCreateMsg("");

    try {
      let secondaryApp = getApps().find((a) => a.name === "secondary");
      if (!secondaryApp) {
        const primaryApp = getApps()[0];
        secondaryApp = initializeApp(primaryApp.options, "secondary");
      }
      const secondaryAuth = getAuth(secondaryApp);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await updateProfile(cred.user, { displayName: name });

      await setDoc(doc(db, `users/${cred.user.uid}`), {
        uid: cred.user.uid,
        name,
        email,
        level: "free",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: "dev-panel",
      }, { merge: true });

      await secondaryAuth.signOut();

      setCreateMsg(`Akun "${email}" berhasil dibuat!`);
      setNewName("");
      setNewEmail("");
      setNewPass("");
      loadUsers();
    } catch (e: any) {
      setCreateMsg("Gagal: " + (e?.message || ""));
    } finally {
      setCreating(false);
    }
  };

  const openAssignModal = async (user: UserDoc) => {
    setAssignUser(user);
    setAssignMsg("");
    setAssignTenantId("");
    setAssignRole("staff");
    await loadUserMemberships(user.uid);
  };

  const handleAssignTenant = async () => {
    if (!assignUser || !assignTenantId) {
      setAssignMsg("Pilih tenant terlebih dahulu.");
      return;
    }

    setAssigning(true);
    setAssignMsg("");

    try {
      const uid = assignUser.uid;
      const tenantId = assignTenantId;
      const role = assignRole;

      // Get tenant name
      const tenantSnap = await getDoc(doc(db, `tenants/${tenantId}`));
      const tenantName = tenantSnap.exists()
        ? (tenantSnap.data().name || tenantSnap.data().storeName || tenantId)
        : tenantId;

      // Create tenantMemberships/{tenantId} di users/{uid}
      await setDoc(doc(db, `users/${uid}/tenantMemberships/${tenantId}`), {
        tenantId,
        name: tenantName,
        role,
        assignedBy: "dev-panel",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create staff/{uid} di tenants/{tenantId}
      await setDoc(doc(db, `tenants/${tenantId}/staff/${uid}`), {
        uid,
        email: assignUser.email,
        name: assignUser.name,
        role,
        assignedBy: "dev-panel",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAssignMsg(`Berhasil assign ke "${tenantName}" sebagai ${role}!`);
      setAssignTenantId("");
      setAssignRole("staff");

      // Refresh memberships
      await loadUserMemberships(uid);
    } catch (e: any) {
      setAssignMsg("Gagal: " + (e?.message || ""));
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignTenant = async (tenantId: string, tenantName: string) => {
    if (!assignUser) return;
    if (!confirm(`Unassign user "${assignUser.email}" dari tenant "${tenantName}"?\n\nUser tidak akan bisa akses tenant ini lagi.`)) {
      return;
    }

    setUnassigning(tenantId);
    try {
      const uid = assignUser.uid;

      // Hapus membership di users/{uid}/tenantMemberships/{tenantId}
      await deleteDoc(doc(db, `users/${uid}/tenantMemberships/${tenantId}`));

      // Hapus staff di tenants/{tenantId}/staff/{uid}
      await deleteDoc(doc(db, `tenants/${tenantId}/staff/${uid}`));

      setAssignMsg(`Berhasil unassign dari "${tenantName}".`);

      // Refresh memberships
      setUserMemberships((prev) => prev.filter((m) => m.tenantId !== tenantId));
    } catch (e: any) {
      setAssignMsg("Gagal unassign: " + (e?.message || ""));
    } finally {
      setUnassigning(null);
    }
  };

  return (
    <div>
      <style>{`
        .level-select{
          padding:4px 8px;
          border-radius:6px;
          border:1px solid var(--border);
          background:var(--bg);
          color:var(--text);
          font-size:12px;
          font-weight:600;
          cursor:pointer;
        }
        .modal-overlay{
          position:fixed;
          inset:0;
          background:rgba(0,0,0,0.6);
          display:grid;
          place-items:center;
          z-index:9999;
          padding:16px;
          overflow-y:auto;
        }
        .modal-card{
          background:var(--panel);
          border:1px solid var(--border);
          border-radius:16px;
          padding:24px;
          max-width:540px;
          width:100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .modal-title{
          font-size:18px;
          font-weight:800;
          margin-bottom:4px;
        }
        .modal-sub{
          font-size:13px;
          color:var(--muted);
          margin-bottom:16px;
        }
        .modal-field{
          margin-bottom:12px;
        }
        .modal-field label{
          display:block;
          font-size:12px;
          font-weight:600;
          margin-bottom:4px;
          color:var(--muted);
        }
        .modal-field select{
          width:100%;
          padding:10px 12px;
          border-radius:8px;
          border:1px solid var(--border);
          background:var(--bg);
          color:var(--text);
          font-size:14px;
        }
        .modal-actions{
          display:flex;
          gap:8px;
          margin-top:16px;
        }
        .membership-item{
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 12px;
          background:var(--bg);
          border:1px solid var(--border);
          border-radius:10px;
          margin-bottom:8px;
        }
        .membership-item .info{
          flex:1;
        }
        .membership-item .info .name{
          font-weight:700;
          font-size:13px;
        }
        .membership-item .info .meta{
          font-size:11px;
          color:var(--muted);
          margin-top:2px;
        }
        .role-pill{
          display:inline-block;
          padding:2px 8px;
          border-radius:4px;
          font-size:10px;
          font-weight:700;
          text-transform:uppercase;
          background:var(--panel);
          border:1px solid var(--border);
        }
        .role-pill.owner{ color:#10b981; border-color:#10b981; }
        .role-pill.admin{ color:#3b82f6; border-color:#3b82f6; }
        .role-pill.staff{ color:#6b7280; border-color:#6b7280; }
        .section-divider{
          border:none;
          border-top:1px solid var(--border);
          margin:16px 0;
        }
        .section-label{
          font-size:13px;
          font-weight:700;
          color:var(--text);
          margin-bottom:10px;
        }
      `}</style>

      <h1 className="page-title">User Manager</h1>
      <p className="page-sub">Buat akun, set level, assign/unassign tenant ke user.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loading ? "..." : users.length}
          </div>
          <div className="stat-note">Firestore user docs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Tenants</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {tenants.length}
          </div>
          <div className="stat-note">Available for assignment</div>
        </div>
      </div>

      {/* CREATE USER */}
      <div className="card">
        <div className="card-title">Buat Akun Baru</div>
        <div className="card-sub">Daftarkan akun via Firebase Auth + simpan profil di Firestore.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>Nama</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama lengkap"
            />
          </div>
          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>Email</label>
            <input
              className="input"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@contoh.com"
            />
          </div>
          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>Password</label>
            <input
              className="input"
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Min 6 karakter"
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating..." : "Buat Akun"}
            </button>
          </div>
        </div>

        {createMsg && (
          <p className="small" style={{ marginTop: 10, color: createMsg.includes("berhasil") ? "var(--success)" : "var(--danger)" }}>
            {createMsg}
          </p>
        )}
      </div>

      {/* USER LIST */}
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="card-title">User List</div>
          <div className="spacer" />
          <button className="btn" onClick={() => { loadUsers(); loadTenants(); }}>Refresh</button>
        </div>
        <div className="card-sub">
          Set level, assign/unassign tenant. Delete hanya hapus Firestore doc.
        </div>

        {loading ? (
          <p className="small">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="small">No users found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Level</th>
                  <th>UID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td><b>{u.name}</b></td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="level-select"
                        value={u.level}
                        onChange={(e) => handleSetLevel(u.uid, e.target.value)}
                        disabled={updatingLevel === u.uid}
                        style={{ borderColor: LEVEL_COLORS[u.level] || "#6b7280" }}
                      >
                        {LEVEL_OPTIONS.map((lv) => (
                          <option key={lv} value={lv}>{lv.toUpperCase()}</option>
                        ))}
                      </select>
                    </td>
                    <td className="mono small">{u.uid.slice(0, 10)}...</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn"
                          onClick={() => openAssignModal(u)}
                        >
                          Tenants
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(u.uid, u.email)}
                          disabled={deleting === u.uid}
                        >
                          {deleting === u.uid ? "..." : "Del"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ASSIGN/UNASSIGN TENANT MODAL */}
      {assignUser && (
        <div className="modal-overlay" onClick={() => setAssignUser(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Kelola Tenant</div>
            <div className="modal-sub">
              User: <b>{assignUser.email}</b> ({assignUser.name})
            </div>

            {/* CURRENT MEMBERSHIPS */}
            <div className="section-label">Tenant Saat Ini</div>
            {loadingMemberships ? (
              <p className="small">Loading...</p>
            ) : userMemberships.length === 0 ? (
              <p className="small" style={{ color: "var(--muted)", fontStyle: "italic" }}>
                Belum ada tenant yang di-assign.
              </p>
            ) : (
              <div>
                {userMemberships.map((m) => (
                  <div key={m.tenantId} className="membership-item">
                    <div className="info">
                      <div className="name">{m.tenantName}</div>
                      <div className="meta">
                        ID: {m.tenantId} &middot; <span className={`role-pill ${m.role}`}>{m.role}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => handleUnassignTenant(m.tenantId, m.tenantName)}
                      disabled={unassigning === m.tenantId}
                    >
                      {unassigning === m.tenantId ? "..." : "Unassign"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <hr className="section-divider" />

            {/* ASSIGN NEW */}
            <div className="section-label">Assign Tenant Baru</div>

            <div className="modal-field">
              <label>Pilih Tenant</label>
              <select
                value={assignTenantId}
                onChange={(e) => setAssignTenantId(e.target.value)}
              >
                <option value="">-- Pilih Tenant --</option>
                {tenants
                  .filter((t) => !userMemberships.some((m) => m.tenantId === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
              </select>
            </div>

            <div className="modal-field">
              <label>Role di Tenant</label>
              <select
                value={assignRole}
                onChange={(e) => setAssignRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                ))}
              </select>
            </div>

            {assignMsg && (
              <p className="small" style={{ color: assignMsg.includes("Berhasil") ? "var(--success)" : "var(--danger)" }}>
                {assignMsg}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleAssignTenant}
                disabled={assigning}
                style={{ flex: 1 }}
              >
                {assigning ? "Assigning..." : "Assign Tenant"}
              </button>
              <button
                className="btn"
                onClick={() => setAssignUser(null)}
                style={{ flex: 1 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
