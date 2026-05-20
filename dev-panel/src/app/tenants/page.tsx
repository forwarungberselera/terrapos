"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  getCountFromServer,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

interface Tenant {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: string;
  ordersCount: number;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create tenant form
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const loadTenants = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "tenants"));
      const results: Tenant[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        let ordersCount = 0;
        try {
          const ordersSnap = await getCountFromServer(
            collection(db, "tenants", docSnap.id, "orders")
          );
          ordersCount = ordersSnap.data().count;
        } catch {
          ordersCount = 0;
        }

        results.push({
          id: docSnap.id,
          name: data.name || data.storeName || "Unnamed",
          ownerEmail: data.ownerEmail || data.email || "—",
          createdAt: data.createdAt
            ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt).toLocaleDateString("id-ID")
            : "—",
          ordersCount,
        });
      }

      setTenants(results);
    } catch (e) {
      console.error("Failed to load tenants:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreate = async () => {
    const id = newId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    const name = newName.trim();
    const ownerEmail = newOwnerEmail.trim();

    if (!id || !name) {
      setCreateMsg("Tenant ID dan Nama wajib diisi.");
      return;
    }

    if (tenants.some((t) => t.id === id)) {
      setCreateMsg("Tenant ID sudah ada.");
      return;
    }

    setCreating(true);
    setCreateMsg("");

    try {
      await setDoc(doc(db, `tenants/${id}`), {
        name,
        ownerEmail: ownerEmail || "",
        createdAt: serverTimestamp(),
        createdBy: "dev-panel",
      });

      // Create default settings
      await setDoc(doc(db, `tenants/${id}/settings/main`), {
        storeName: name,
        address: "",
        footer: "Terima kasih.",
        cashierName: "Kasir",
        createdAt: serverTimestamp(),
      });

      setCreateMsg(`Tenant "${name}" (${id}) berhasil dibuat!`);
      setNewId("");
      setNewName("");
      setNewOwnerEmail("");
      loadTenants();
    } catch (e: any) {
      setCreateMsg("Gagal: " + (e?.message || ""));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    const confirmText = prompt(
      `HAPUS tenant "${tenant.name}" (${tenant.id})?\n\n` +
      `Tenant ini punya ${tenant.ordersCount} orders.\n` +
      `Semua data akan HILANG PERMANEN.\n\n` +
      `Ketik "HAPUS" untuk konfirmasi:`
    );

    if (confirmText !== "HAPUS") return;

    setDeleting(tenant.id);
    try {
      // Delete tenant doc
      await deleteDoc(doc(db, `tenants/${tenant.id}`));

      // Cleanup memberships from users
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        for (const userDoc of usersSnap.docs) {
          try {
            await deleteDoc(doc(db, `users/${userDoc.id}/tenantMemberships/${tenant.id}`));
          } catch {}
        }
      } catch {}

      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      alert(`Tenant "${tenant.name}" berhasil dihapus.`);
    } catch (e: any) {
      alert("Gagal hapus: " + (e?.message || ""));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Tenants</h1>
      <p className="page-sub">Kelola semua tenant/outlet TerraPOS.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Tenants</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loading ? "..." : tenants.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {loading ? "..." : tenants.reduce((sum, t) => sum + t.ordersCount, 0)}
          </div>
        </div>
      </div>

      {/* CREATE TENANT */}
      <div className="card">
        <div className="card-title">Buat Tenant Baru</div>
        <div className="card-sub">Buat outlet/tenant baru beserta settings default-nya.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>Tenant ID</label>
            <input
              className="input"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="contoh: warung-pak-jo"
            />
          </div>
          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>Nama Outlet</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Warung Pak Jo"
            />
          </div>
          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>Owner Email (opsional)</label>
            <input
              className="input"
              type="email"
              value={newOwnerEmail}
              onChange={(e) => setNewOwnerEmail(e.target.value)}
              placeholder="owner@email.com"
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? "Creating..." : "Buat Tenant"}
        </button>

        {createMsg && (
          <p className="small" style={{ marginTop: 10, color: createMsg.includes("berhasil") ? "var(--success)" : "var(--danger)" }}>
            {createMsg}
          </p>
        )}
      </div>

      {/* TENANT LIST */}
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="card-title">Tenant List</div>
          <div className="spacer" />
          <button className="btn" onClick={loadTenants}>Refresh</button>
        </div>
        <div className="card-sub">Klik Delete untuk hapus tenant + cleanup membership.</div>

        {loading ? (
          <p className="small">Loading tenants...</p>
        ) : tenants.length === 0 ? (
          <p className="small">No tenants found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Created</th>
                  <th>Orders</th>
                  <th>ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.name}</b></td>
                    <td>{t.ownerEmail}</td>
                    <td>{t.createdAt}</td>
                    <td>
                      <span className="badge badge-success">{t.ordersCount}</span>
                    </td>
                    <td className="mono small">{t.id}</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(t)}
                        disabled={deleting === t.id}
                      >
                        {deleting === t.id ? "..." : "Delete"}
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
