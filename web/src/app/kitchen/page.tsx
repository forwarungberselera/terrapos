"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import TerraPage from "@/components/TerraPage";
import {
  collection, onSnapshot, query, orderBy, limit, where, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { useToast } from "@/components/Toast";
import { playOrderNotificationRepeat } from "@/lib/order-notification";

type KitchenOrder = {
  id: string;
  orderNo: string;
  tableNo: string | null;
  items: { name: string; qty: number; price: number; notes?: string }[];
  total: number;
  source: string | null;
  customerName: string | null;
  createdAt: any;
};

function timeAgo(date: any): string {
  if (!date) return "";
  const d = typeof date?.toDate === "function" ? date.toDate() : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "Baru";
  if (diff < 60) return `${diff}m`;
  return `${Math.floor(diff / 60)}j ${diff % 60}m`;
}

export default function KitchenPage() {
  const router = useRouter();
  const { tenantId, loading } = useTenant();
  const { role, loadingRole } = useRole();
  const toast = useToast();

  const canView = ["owner", "admin", "developer"].includes((role || "").toString().toLowerCase());

  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  // Track new orders for sound
  const prevIdsRef = React.useRef<Set<string>>(new Set());
  const firstLoadRef = React.useRef(true);

  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/orders`);
    const q = query(ref, where("status", "==", "OPEN"), orderBy("createdAt", "asc"), limit(50));
    return onSnapshot(q, (snap) => {
      const arr: KitchenOrder[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          orderNo: x.orderNo || d.id,
          tableNo: x.tableNo ?? null,
          items: Array.isArray(x.items) ? x.items : [],
          total: Number(x.total || 0),
          source: x.source ?? null,
          customerName: x.customerName ?? null,
          createdAt: x.createdAt,
        };
      });
      setOrders(arr);

      // Sound for new orders
      const currentIds = new Set(arr.map((o) => o.id));
      if (firstLoadRef.current) {
        prevIdsRef.current = currentIds;
        firstLoadRef.current = false;
      } else {
        let hasNew = false;
        for (const id of currentIds) {
          if (!prevIdsRef.current.has(id)) { hasNew = true; break; }
        }
        if (hasNew) playOrderNotificationRepeat(2);
        prevIdsRef.current = currentIds;
      }
    });
  }, [tenantId]);

  async function markDone(orderId: string) {
    setCompleting(orderId);
    try {
      await updateDoc(doc(db, `tenants/${tenantId}/orders/${orderId}`), {
        status: "PAID",
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        kitchenDoneAt: serverTimestamp(),
      });
      toast.success("Order selesai!");
    } catch (e: any) {
      toast.error("Gagal: " + (e?.message || ""));
    } finally {
      setCompleting(null);
    }
  }

  if (loading || loadingRole) return <TerraPage><div className="card">Loading...</div></TerraPage>;
  if (!canView) {
    return <TerraPage><div className="card"><div className="h1">Akses ditolak</div></div></TerraPage>;
  }

  return (
    <TerraPage>
      <style>{`
        .kitchen-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .kitchen-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 14px; }
        .kitchen-card {
          background: var(--panel); border: 2px solid var(--border); border-radius: 16px;
          padding: 16px; transition: border-color 0.2s;
        }
        .kitchen-card.qr { border-color: #f59e0b; background: #fffbeb; }
        .kitchen-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .kitchen-orderno { font-size: 16px; font-weight: 900; }
        .kitchen-table { padding: 3px 10px; border-radius: 8px; background: var(--brandSoft); color: var(--brand); font-size: 12px; font-weight: 800; }
        .kitchen-time { font-size: 11px; color: var(--muted); font-weight: 700; }
        .kitchen-items { margin-top: 8px; }
        .kitchen-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px dashed var(--border); }
        .kitchen-item:last-child { border-bottom: none; }
        .kitchen-item-name { font-weight: 700; }
        .kitchen-item-qty { font-weight: 900; color: var(--brand); }
        .kitchen-item-note { font-size: 11px; color: var(--warning); font-style: italic; }
        .kitchen-done-btn {
          margin-top: 12px; width: 100%; padding: 12px; border: none; border-radius: 12px;
          background: var(--success, #10b981); color: white; font-size: 14px; font-weight: 800;
          cursor: pointer; transition: opacity 0.15s;
        }
        .kitchen-done-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .kitchen-done-btn:active { transform: scale(0.97); }
        .kitchen-empty { text-align: center; padding: 60px 20px; color: var(--muted); }
        .kitchen-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; }
        @media (max-width: 640px) { .kitchen-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="card">
        <div className="kitchen-header">
          <div>
            <div className="h1">Kitchen Display</div>
            <div className="small">{orders.length} pesanan menunggu</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => router.push("/orders")}>Orders</button>
            <button className="btn" onClick={() => router.push("/dashboard")}>Dashboard</button>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="kitchen-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍🍳</div>
          <div className="h1">Semua order selesai!</div>
          <div className="small" style={{ marginTop: 8 }}>Menunggu pesanan baru...</div>
        </div>
      ) : (
        <div className="kitchen-grid">
          {orders.map((o) => (
            <div key={o.id} className={`kitchen-card ${o.source === "customer_qr" ? "qr" : ""}`}>
              <div className="kitchen-card-top">
                <div>
                  <span className="kitchen-orderno">{o.orderNo}</span>
                  {o.source === "customer_qr" && (
                    <span className="kitchen-badge" style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e" }}>QR</span>
                  )}
                </div>
                <span className="kitchen-time">{timeAgo(o.createdAt)}</span>
              </div>

              {o.tableNo && <span className="kitchen-table">Meja {o.tableNo}</span>}
              {o.customerName && <div className="small" style={{ marginTop: 4 }}>👤 {o.customerName}</div>}

              <div className="kitchen-items">
                {o.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="kitchen-item">
                      <span className="kitchen-item-name">{item.name}</span>
                      <span className="kitchen-item-qty">x{item.qty}</span>
                    </div>
                    {item.notes && <div className="kitchen-item-note">📝 {item.notes}</div>}
                  </div>
                ))}
              </div>

              <button
                className="kitchen-done-btn"
                disabled={completing === o.id}
                onClick={() => markDone(o.id)}
              >
                {completing === o.id ? "Memproses..." : "✅ Selesai"}
              </button>
            </div>
          ))}
        </div>
      )}
    </TerraPage>
  );
}
