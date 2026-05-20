"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";

interface UserDoc {
  uid: string;
  email: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleDelete = async (uid: string) => {
    if (!confirm(`Delete user document "${uid}" from Firestore? This only removes the Firestore doc, not the Auth account.`)) {
      return;
    }
    setDeleting(uid);
    try {
      await deleteDoc(doc(db, "users", uid));
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (e) {
      console.error("Failed to delete user:", e);
      alert("Failed to delete user doc. Check console.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">User Manager</h1>
      <p className="page-sub">Manage user documents in the &quot;users&quot; collection.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loading ? "..." : users.length}
          </div>
          <div className="stat-note">Firestore user docs</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="card-title">User List</div>
          <div className="spacer" />
          <button className="btn" onClick={loadUsers}>
            Refresh
          </button>
        </div>
        <div className="card-sub">
          UID, email, name. Delete removes Firestore doc only (not Firebase Auth).
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
                  <th>UID</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td className="mono small">{u.uid}</td>
                    <td>{u.email}</td>
                    <td>{u.name}</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(u.uid)}
                        disabled={deleting === u.uid}
                      >
                        {deleting === u.uid ? "Deleting..." : "Delete"}
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
