"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  getCountFromServer,
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

  useEffect(() => {
    (async () => {
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
            name: data.name || "Unnamed",
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
    })();
  }, []);

  return (
    <div>
      <h1 className="page-title">Tenants</h1>
      <p className="page-sub">All registered tenants and their order counts.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Tenants</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loading ? "..." : tenants.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Orders (all)</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {loading ? "..." : tenants.reduce((sum, t) => sum + t.ordersCount, 0)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Tenant List</div>
        <div className="card-sub">Name, owner, created date, and order count.</div>

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
                  <th>Owner Email</th>
                  <th>Created</th>
                  <th>Orders</th>
                  <th>ID</th>
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
