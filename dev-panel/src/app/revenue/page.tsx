"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

interface Tenant {
  id: string;
  name: string;
}

interface OrderDoc {
  id: string;
  total: number;
  createdAt: string;
  customerName: string;
}

export default function RevenuePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "tenants"));
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setTenants(list);
        if (list.length > 0) setSelectedTenant(list[0].id);
      } catch (e) {
        console.error("Failed to load tenants:", e);
      } finally {
        setLoadingTenants(false);
      }
    })();
  }, []);

  const loadOrders = async (tenantId: string) => {
    if (!tenantId) return;
    setLoadingOrders(true);
    try {
      const q = query(
        collection(db, "tenants", tenantId, "orders"),
        where("status", "==", "PAID")
      );
      const snap = await getDocs(q);
      const list: OrderDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          total: data.total || 0,
          createdAt: data.createdAt
            ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt).toLocaleDateString("id-ID")
            : "—",
          customerName: data.customerName || data.customer || "—",
        };
      });
      setOrders(list);
    } catch (e) {
      console.error("Failed to load orders:", e);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (selectedTenant) {
      loadOrders(selectedTenant);
    }
  }, [selectedTenant]);

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  return (
    <div>
      <h1 className="page-title">Revenue Analytics</h1>
      <p className="page-sub">Revenue breakdown from PAID orders per tenant.</p>

      <div className="card">
        <div className="card-title">Select Tenant</div>
        <div className="card-sub">Choose a tenant to analyze revenue.</div>

        {loadingTenants ? (
          <p className="small">Loading tenants...</p>
        ) : (
          <div className="row">
            <select
              className="input"
              style={{ maxWidth: 300 }}
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id})
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => loadOrders(selectedTenant)}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value" style={{ color: "var(--success)", fontSize: 20 }}>
            {loadingOrders ? "..." : formatCurrency(totalRevenue)}
          </div>
          <div className="stat-note">From PAID orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Order Count</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loadingOrders ? "..." : orders.length}
          </div>
          <div className="stat-note">PAID orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Order Value</div>
          <div className="stat-value" style={{ color: "var(--warning)", fontSize: 20 }}>
            {loadingOrders ? "..." : formatCurrency(avgOrder)}
          </div>
          <div className="stat-note">Per transaction</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Order Details</div>
        <div className="card-sub">{orders.length} PAID orders for this tenant.</div>

        {loadingOrders ? (
          <p className="small">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="small">No PAID orders found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 50).map((o) => (
                  <tr key={o.id}>
                    <td className="mono small">{o.id}</td>
                    <td>{o.customerName}</td>
                    <td>{o.createdAt}</td>
                    <td><b>{formatCurrency(o.total)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length > 50 && (
              <p className="small" style={{ marginTop: 8 }}>
                Showing first 50 of {orders.length} orders.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
