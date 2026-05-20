"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

interface Tenant {
  id: string;
  name: string;
}

interface FeedItem {
  id: string;
  type: "order" | "refund";
  data: Record<string, unknown>;
  timestamp: string;
}

export default function MonitorPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);

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
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;

    setFeed([]);
    setListening(true);

    const ordersQuery = query(
      collection(db, "tenants", selectedTenant, "orders"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const refundsQuery = query(
      collection(db, "tenants", selectedTenant, "refunds"),
      orderBy("refundedAt", "desc"),
      limit(10)
    );

    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      const items: FeedItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: "order",
          data,
          timestamp: data.createdAt
            ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt).toLocaleString("id-ID")
            : "—",
        };
      });
      setFeed((prev) => {
        const refunds = prev.filter((f) => f.type === "refund");
        return [...items, ...refunds].slice(0, 20);
      });
    });

    const unsubRefunds = onSnapshot(refundsQuery, (snap) => {
      const items: FeedItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: "refund",
          data,
          timestamp: data.refundedAt
            ? new Date(data.refundedAt.seconds ? data.refundedAt.seconds * 1000 : data.refundedAt).toLocaleString("id-ID")
            : "—",
        };
      });
      setFeed((prev) => {
        const orders = prev.filter((f) => f.type === "order");
        return [...orders, ...items].slice(0, 20);
      });
    });

    return () => {
      unsubOrders();
      unsubRefunds();
      setListening(false);
    };
  }, [selectedTenant]);

  return (
    <div>
      <h1 className="page-title">Realtime Monitor</h1>
      <p className="page-sub">Live feed of orders and refunds for a selected tenant.</p>

      <div className="card">
        <div className="card-title">Select Tenant</div>
        <div className="card-sub">Choose a tenant to monitor in realtime.</div>

        {loading ? (
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
            {listening && (
              <span className="badge badge-success">● Live</span>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Live Feed</div>
        <div className="card-sub">Latest 10 orders and refunds (realtime via onSnapshot).</div>

        {feed.length === 0 ? (
          <p className="small">No data yet. Waiting for activity...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>ID</th>
                  <th>Timestamp</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td>
                      <span className={`badge ${item.type === "order" ? "badge-success" : "badge-danger"}`}>
                        {item.type === "order" ? "Order" : "Refund"}
                      </span>
                    </td>
                    <td className="mono small">{item.id}</td>
                    <td>{item.timestamp}</td>
                    <td className="small">
                      {item.type === "order"
                        ? `Total: ${item.data.total || "—"} | Status: ${item.data.status || "—"}`
                        : `Amount: ${item.data.amount || "—"} | Reason: ${item.data.reason || "—"}`}
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
