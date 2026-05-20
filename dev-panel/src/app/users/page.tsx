"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

interface UserDoc {
  uid: string;
  email: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list: UserDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || "—",
          name: data.name || data.displayName || "—",
        };
      });
      setUsers(list);
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
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
      // Use secondary app to avoid logging out current developer
      let secondaryApp = getApps().find((a) => a.name === "secondary");
      if (!secondaryApp) {
        const primaryApp = getApps()[0];
        secondaryApp = initializeApp(primaryApp.options, "secondary");
      }
      const secondaryAuth = getAuth(secondaryApp);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await updateProfile(cred.user, { displayName: name });

      // Save to Firestore
      await setDoc(doc(db, `users/${cred.user.uid}`), {
        uid: cred.user.uid,
        name,
        email,
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

  return (
    <div>
      <h1 className="page-title">User Manager</h1>
      <p className="page-sub">Buat akun baru dan kelola user Firestore.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loading ? "..." : users.length}
          </div>
          <div className="stat-note">Firestore user docs</div>
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
          <button className="btn" onClick={loadUsers}>Refresh</button>
        </div>
        <div className="card-sub">
          Delete hanya hapus Firestore doc, bukan Firebase Auth account.
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
                  <th>UID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td><b>{u.name}</b></td>
                    <td>{u.email}</td>
                    <td className="mono small">{u.uid.slice(0, 12)}...</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(u.uid, u.email)}
                        disabled={deleting === u.uid}
                      >
                        {deleting === u.uid ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
