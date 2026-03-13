"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import * as XLSX from "xlsx";

type OrderItem = { name: string; price: number; qty: number };
type Order = {
  id: string;
  orderNo?: string;
  status?: "OPEN" | "PAID" | "CANCELLED";
  mode?: "PAY_NOW" | "PAY_LATER";
  paymentMethod?: "CASH" | "QRIS" | null;
  tableNo?: string | null;
  total: number;
  discount?: number;
  subtotal?: number;
  items?: OrderItem[];
  createdAt?: any;
  paidAt?: any;
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function formatDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateInput(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date();
  return d;
}

function formatDateTime(d: Date | null) {
  if (!d) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const roleLower = (role || "").toString().toLowerCase();
  const canView = roleLower === "owner" || roleLower === "admin";

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));

  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/orders`);
    const qy = query(ref, orderBy("createdAt", "desc"));
    return onSnapshot(
      qy,
      (snap) => {
        const arr: Order[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            orderNo: x.orderNo || d.id,
            status: x.status || "OPEN",
            mode: x.mode || "PAY_LATER",
            paymentMethod: x.paymentMethod ?? null,
            tableNo: x.tableNo ?? null,
            total: Number(x.total || 0),
            discount: Number(x.discount || 0),
            subtotal: Number(x.subtotal || 0),
            items: Array.isArray(x.items) ? x.items : [],
            createdAt: x.createdAt,
            paidAt: x.paidAt,
          };
        });
        setOrders(arr);
      },
      (e) => setErr(e.message)
    );
  }, [tenantId]);

  const paidOrders = useMemo(() => {
    return orders.filter((o) => o.status === "PAID");
  }, [orders]);

  const selectedDateStats = useMemo(() => {
    const picked = parseDateInput(selectedDate);
    const sod = startOfDay(picked);
    const eod = endOfDay(picked);

    const dayOrders = paidOrders.filter((o) => {
      const dt = toDateSafe(o.paidAt) || toDateSafe(o.createdAt);
      if (!dt) return false;
      return dt >= sod && dt <= eod;
    });

    let revenue = 0;
    let count = 0;
    let cashRevenue = 0;
    let qrisRevenue = 0;

    const productMap = new Map<
      string,
      {
        name: string;
        qty: number;
        revenue: number;
        orders: number;
      }
    >();

    for (const o of dayOrders) {
      revenue += Number(o.total || 0);
      count += 1;

      if (o.paymentMethod === "CASH") cashRevenue += Number(o.total || 0);
      if (o.paymentMethod === "QRIS") qrisRevenue += Number(o.total || 0);

      for (const it of o.items || []) {
        const key = (it.name || "Unknown").toString();
        const qty = Number(it.qty || 0);
        const rev = Number(it.price || 0) * qty;
        const prev = productMap.get(key) || {
          name: key,
          qty: 0,
          revenue: 0,
          orders: 0,
        };

        productMap.set(key, {
          name: key,
          qty: prev.qty + qty,
          revenue: prev.revenue + rev,
          orders: prev.orders + 1,
        });
      }
    }

    const soldProducts = Array.from(productMap.values()).sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.qty - a.qty;
    });

    return {
      dayOrders,
      revenue,
      count,
      cashRevenue,
      qrisRevenue,
      soldProducts,
    };
  }, [paidOrders, selectedDate]);

  const monthStats = useMemo(() => {
    const now = new Date();
    const som = startOfMonth(now);

    let revenue = 0;
    let count = 0;

    for (const o of paidOrders) {
      const dt = toDateSafe(o.paidAt) || toDateSafe(o.createdAt);
      if (!dt) continue;
      if (dt >= som) {
        revenue += Number(o.total || 0);
        count += 1;
      }
    }

    return { revenue, count };
  }, [paidOrders]);

  function exportExcel() {
    if (!tenantId) return;
    if (selectedDateStats.dayOrders.length === 0) {
      alert("Belum ada order PAID pada tanggal ini.");
      return;
    }

    const rows = selectedDateStats.dayOrders.map((o) => {
      const dt = toDateSafe(o.paidAt) || toDateSafe(o.createdAt);
      return {
        Tanggal: dt ? dt.toLocaleString("id-ID") : "-",
        OrderNo: o.orderNo || o.id,
        Status: o.status || "-",
        Mode: o.mode || "-",
        Meja: o.tableNo || "-",
        Metode: o.paymentMethod || "-",
        Subtotal: o.subtotal || 0,
        Diskon: o.discount || 0,
        Total: o.total || 0,
        Items: (o.items || [])
          .map((it) => `${it.name} x${it.qty} @${it.price}`)
          .join(" | "),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Reports");
    XLSX.writeFile(wb, `TerraPOS_Report_${selectedDate}.xlsx`);
  }

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  if (!canView) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Reports hanya untuk owner/admin.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>
            Kembali ke POS
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={1180}>
      <style>{`
        .grid{
          margin-top:14px;
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap:14px;
        }
        @media (max-width: 1000px){
          .grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px){
          .grid{ grid-template-columns: 1fr; }
        }
        .stat-card{
          border:1px solid var(--border);
          border-radius:18px;
          padding:16px;
          background:#fff;
        }
        .stat-label{
          font-size:12px;
          color:var(--muted);
          font-weight:700;
        }
        .stat-value{
          margin-top:8px;
          font-size:24px;
          font-weight:900;
          color:#111827;
        }
        table{
          width:100%;
          border-collapse:collapse;
        }
        th, td{
          padding:10px 8px;
          border-bottom:1px solid var(--border);
          text-align:left;
          vertical-align:top;
        }
        th{
          font-size:12px;
          color:var(--muted);
          font-weight:800;
        }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Reports</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">
              User: {email || "-"} | Role: <b>{role}</b>
            </div>
          </div>

          <div className="spacer" />

          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
        </div>

        <div className="row" style={{ marginTop: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ minWidth: 220 }}>
            <div className="small">Pilih Tanggal</div>
            <input
              className="input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="spacer" />

          <button className="btn btn-primary" onClick={exportExcel}>
            Export Excel Tanggal Ini
          </button>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ color: "var(--danger)", fontWeight: 900 }}>{err}</div>
        </div>
      )}

      <div className="grid">
        <div className="stat-card">
          <div className="stat-label">Omzet Tanggal Dipilih</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            Rp {rupiah(selectedDateStats.revenue)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Jumlah Transaksi</div>
          <div className="stat-value">{selectedDateStats.count}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Pembayaran Cash</div>
          <div className="stat-value">Rp {rupiah(selectedDateStats.cashRevenue)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Pembayaran QRIS</div>
          <div className="stat-value">Rp {rupiah(selectedDateStats.qrisRevenue)}</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="stat-card">
          <div className="stat-label">Omzet Bulan Ini</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            Rp {rupiah(monthStats.revenue)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Transaksi Bulan Ini</div>
          <div className="stat-value">{monthStats.count}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Produk Terjual pada {selectedDate}</div>
        <div className="small" style={{ marginTop: 6 }}>
          Menampilkan produk apa saja yang terjual pada tanggal yang dipilih.
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Total Qty</th>
                <th>Jumlah Muncul di Order</th>
                <th>Omzet</th>
              </tr>
            </thead>
            <tbody>
              {selectedDateStats.soldProducts.map((p) => (
                <tr key={p.name}>
                  <td style={{ fontWeight: 900 }}>{p.name}</td>
                  <td>{p.qty}</td>
                  <td>{p.orders}</td>
                  <td style={{ fontWeight: 900, color: "var(--brand)" }}>
                    Rp {rupiah(p.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedDateStats.soldProducts.length === 0 && (
          <div className="small" style={{ marginTop: 12 }}>
            Tidak ada produk terjual pada tanggal ini.
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Daftar Order pada {selectedDate}</div>
        <div className="small" style={{ marginTop: 6 }}>
          Hanya order dengan status <b>PAID</b>.
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Order No</th>
                <th>Meja</th>
                <th>Metode</th>
                <th>Items</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedDateStats.dayOrders.map((o) => {
                const dt = toDateSafe(o.paidAt) || toDateSafe(o.createdAt);
                return (
                  <tr key={o.id}>
                    <td>{formatDateTime(dt)}</td>
                    <td style={{ fontWeight: 900 }}>{o.orderNo || o.id}</td>
                    <td>{o.tableNo || "-"}</td>
                    <td>{o.paymentMethod || "-"}</td>
                    <td>
                      {(o.items || []).map((it, idx) => (
                        <div key={idx}>
                          {it.name} x{it.qty}
                        </div>
                      ))}
                    </td>
                    <td style={{ fontWeight: 900, color: "var(--brand)" }}>
                      Rp {rupiah(o.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedDateStats.dayOrders.length === 0 && (
          <div className="small" style={{ marginTop: 12 }}>
            Tidak ada transaksi pada tanggal ini.
          </div>
        )}
      </div>
    </TerraPage>
  );
}