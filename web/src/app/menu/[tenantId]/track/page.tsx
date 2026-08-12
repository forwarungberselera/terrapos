"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection, onSnapshot, query, where, orderBy, limit,
} from "firebase/firestore";

export function generateStaticParams() {
  return [{ tenantId: "_" }];
}

type OrderItem = { name: string; qty: number; price: number; notes?: string };

type TrackedOrder = {
  id: string;
  orderNo: string;
  status: "OPEN" | "PAID" | "CANCELLED";
  tableNo: string | null;
  items: OrderItem[];
  subtotal: number;
  total: number;
  createdAt: any;
  customerName?: string | null;
};

function rupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

function getStatusInfo(status: string) {
  switch (status) {
    case "OPEN":
      return { label: "Sedang Diproses", icon: "⏳", color: "#f59e0b", bg: "#fef3c7" };
    case "PAID":
      return { label: "Selesai", icon: "✅", color: "#10b981", bg: "#d1fae5" };
    case "CANCELLED":
      return { label: "Dibatalkan", icon: "❌", color: "#ef4444", bg: "#fee2e2" };
    default:
      return { label: status, icon: "❓", color: "#6b7280", bg: "#f3f4f6" };
  }
}

export default function TrackOrderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.tenantId as string;
  const orderNo = searchParams.get("order") || "";
  const tableNumber = searchParams.get("table") || "";

  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }

    const ref = collection(db, `tenants/${tenantId}/orders`);

    // If orderNo provided, track specific order; else track by table
    let q;
    if (orderNo) {
      q = query(ref, where("orderNo", "==", orderNo), limit(1));
    } else if (tableNumber) {
      q = query(
        ref,
        where("tableNo", "==", tableNumber),
        where("source", "==", "customer_qr"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
    } else {
      setError("Link tidak valid. Tidak ada nomor pesanan atau meja.");
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(q, (snap) => {
      const arr: TrackedOrder[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          orderNo: x.orderNo || d.id,
          status: x.status || "OPEN",
          tableNo: x.tableNo ?? null,
          items: Array.isArray(x.items) ? x.items : [],
          subtotal: Number(x.subtotal || 0),
          total: Number(x.total || 0),
          createdAt: x.createdAt,
          customerName: x.customerName ?? null,
        };
      });
      setOrders(arr);
      setLoading(false);
    }, () => {
      setError("Gagal memuat status pesanan.");
      setLoading(false);
    });

    return () => unsub();
  }, [tenantId, orderNo, tableNumber]);

  if (!tenantId) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>Link tidak valid.</p>
      </div>
    );
  }

  return (
    <div className="track-page">
      <style>{trackStyles}</style>

      <header className="track-header">
        <h1>Status Pesanan</h1>
        {tableNumber && <span className="track-table">Meja {tableNumber}</span>}
      </header>

      {loading && (
        <div className="track-loading">Memuat status pesanan...</div>
      )}

      {error && !loading && (
        <div className="track-error">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="track-empty">
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <p>Belum ada pesanan ditemukan.</p>
        </div>
      )}

      {!loading && !error && orders.map((o) => {
        const statusInfo = getStatusInfo(o.status);
        return (
          <div key={o.id} className="track-card">
            <div className="track-card-top">
              <div>
                <div className="track-order-no">{o.orderNo}</div>
                {o.customerName && (
                  <div className="track-customer">{o.customerName}</div>
                )}
              </div>
              <div
                className="track-status-badge"
                style={{ background: statusInfo.bg, color: statusInfo.color }}
              >
                <span>{statusInfo.icon}</span>
                <span>{statusInfo.label}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="track-progress">
              <div className={`track-step ${o.status !== "CANCELLED" ? "active" : "cancelled"}`}>
                <div className="track-dot" />
                <span>Diterima</span>
              </div>
              <div className="track-line" />
              <div className={`track-step ${o.status === "PAID" ? "active" : ""}`}>
                <div className="track-dot" />
                <span>Selesai</span>
              </div>
            </div>

            {/* Items */}
            <div className="track-items">
              {o.items.map((it, idx) => (
                <div key={idx} className="track-item">
                  <span>{it.name} x{it.qty}</span>
                  <span>{rupiah(it.price * it.qty)}</span>
                </div>
              ))}
            </div>

            <div className="track-total">
              <span>Total</span>
              <span>{rupiah(o.total)}</span>
            </div>
          </div>
        );
      })}

      {/* Back to menu */}
      <div className="track-footer">
        <a href={`/menu/${tenantId}?table=${tableNumber}`} className="track-back-btn">
          ← Kembali ke Menu
        </a>
      </div>
    </div>
  );
}


const trackStyles = `
  .track-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg, #f8f9fb);
    font-family: var(--font-primary, system-ui, sans-serif);
    padding-bottom: 40px;
  }
  .track-header {
    background: var(--brand, #d59567);
    color: white;
    padding: 24px 16px 20px;
    text-align: center;
  }
  .track-header h1 {
    font-size: 20px;
    font-weight: 800;
    margin: 0;
  }
  .track-table {
    display: inline-block;
    margin-top: 6px;
    padding: 3px 12px;
    background: rgba(255,255,255,0.25);
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
  }
  .track-loading, .track-error, .track-empty {
    padding: 40px 20px;
    text-align: center;
    color: var(--muted, #6b7280);
  }
  .track-error { color: var(--danger, #ef4444); }
  .track-card {
    margin: 12px 16px;
    background: var(--panel, #fff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 16px;
    padding: 16px;
  }
  .track-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .track-order-no {
    font-size: 16px;
    font-weight: 800;
  }
  .track-customer {
    font-size: 12px;
    color: var(--muted, #6b7280);
    margin-top: 2px;
  }
  .track-status-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .track-progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin: 16px 0;
  }
  .track-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 60px;
  }
  .track-step span {
    font-size: 11px;
    color: var(--muted, #6b7280);
    font-weight: 600;
  }
  .track-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--border, #e5e7eb);
    border: 3px solid var(--border, #e5e7eb);
  }
  .track-step.active .track-dot {
    background: var(--brand, #d59567);
    border-color: var(--brand, #d59567);
  }
  .track-step.active span {
    color: var(--brand, #d59567);
  }
  .track-step.cancelled .track-dot {
    background: var(--danger, #ef4444);
    border-color: var(--danger, #ef4444);
  }
  .track-line {
    flex: 1;
    height: 3px;
    background: var(--border, #e5e7eb);
    margin: 0 8px;
    margin-bottom: 20px;
  }
  .track-items {
    border-top: 1px solid var(--border, #e5e7eb);
    padding-top: 10px;
  }
  .track-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
  }
  .track-total {
    display: flex;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid var(--border, #e5e7eb);
    margin-top: 8px;
    font-size: 15px;
    font-weight: 800;
    color: var(--brand, #d59567);
  }
  .track-footer {
    padding: 20px 16px;
    text-align: center;
  }
  .track-back-btn {
    display: inline-block;
    padding: 12px 24px;
    background: var(--panel, #fff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    color: var(--text, #111827);
    text-decoration: none;
    transition: background 0.15s;
  }
  .track-back-btn:active {
    background: var(--bg, #f8f9fb);
  }
`;
