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
function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function ReportsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const roleLower = (role || "").toString().toLowerCase();
  const canView = roleLower === "owner" || roleLower === "admin";

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

  const paidOrders = useMemo(() => orders.filter((o) => o.status === "PAID"), [orders]);

  const stats = useMemo(() => {
    const now = new Date();
    const sod = startOfDay(now);
    const som = startOfMonth(now);

    let todayRevenue = 0;
    let todayCount = 0;

    let monthRevenue = 0;
    let monthCount = 0;

    // produk terlaris bulan ini
    const topMap = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const o of paidOrders) {
      const dt: Date | null = o.paidAt?.toDate?.() ?? o.createdAt?.toDate?.() ?? null;
      if (!dt) continue;

      if (dt >= sod) {
        todayRevenue += o.total;
        todayCount += 1;
      }

      if (dt >= som) {
        monthRevenue += o.total;
        monthCount += 1;

        for (const it of o.items || []) {
          const key = (it.name || "Unknown").toString();
          const qty = Number(it.qty || 0);
          const rev = Number(it.price || 0) * qty;
          const prev = topMap.get(key) || { name: key, qty: 0, revenue: 0 };
          topMap.set(key, { name: key, qty: prev.qty + qty, revenue: prev.revenue + rev });
        }
      }
    }

    const top = Array.from(topMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const top1 = top[0]?.name || "-";

    return { todayRevenue, todayCount, monthRevenue, monthCount, top, top1 };
  }, [paidOrders]);

  function exportExcel() {
    if (!tenantId) return;
    if (paidOrders.length === 0) {
      alert("Belum ada order PAID untuk diexport.");
      return;
    }

    const rows = paidOrders.map((o) => {
      const dt: Date | null = o.paidAt?.toDate?.() ?? o.createdAt?.toDate?.() ?? null;
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
    XLSX.utils.book_append_sheet(wb, ws, "PAID Orders");
    XLSX.writeFile(wb, `TerraPOS_Reports_${tenantId}.xlsx`);
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
    <TerraPage>
      <style>{`
        .grid{ margin-top:14px; display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:14px; }
        table{ width:100%; border-collapse:collapse; }
        th, td{ padding:10px 8px; border-bottom:1px solid var(--border); text-align:left; }
        th{ font-size:12px; color: var(--muted); }
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
          <button className="btn btn-primary" onClick={exportExcel}>Export Excel</button>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ color: "var(--danger)", fontWeight: 900 }}>{err}</div>
        </div>
      )}

      <div className="grid">
        <div className="card">
          <div className="small">Omzet Hari Ini (PAID)</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, color: "var(--brand)" }}>
            Rp {rupiah(stats.todayRevenue)}
          </div>
          <div className="small" style={{ marginTop: 6 }}>Transaksi: {stats.todayCount}</div>
        </div>

        <div className="card">
          <div className="small">Omzet Bulan Ini (PAID)</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, color: "var(--brand)" }}>
            Rp {rupiah(stats.monthRevenue)}
          </div>
          <div className="small" style={{ marginTop: 6 }}>Transaksi: {stats.monthCount}</div>
        </div>

        <div className="card">
          <div className="small">Top Produk Bulan Ini</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
            {stats.top1}
          </div>
          <div className="small" style={{ marginTop: 6 }}>Berdasarkan omzet</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Top Produk (Bulan Ini)</div>
        <div className="small" style={{ marginTop: 6 }}>Urut berdasarkan omzet</div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Qty</th>
                <th>Omzet</th>
              </tr>
            </thead>
            <tbody>
              {stats.top.map((t) => (
                <tr key={t.name}>
                  <td style={{ fontWeight: 900 }}>{t.name}</td>
                  <td>{t.qty}</td>
                  <td style={{ fontWeight: 900, color: "var(--brand)" }}>Rp {rupiah(t.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stats.top.length === 0 && <div className="small" style={{ marginTop: 12 }}>Belum ada data bulan ini.</div>}
      </div>
    </TerraPage>
  );
}