"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where, Timestamp } from "firebase/firestore";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";

type Order = {
  id: string;
  orderNo: string;
  status: string;
  mode: string;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: any[];
  createdAt: any;
  paidAt: any;
};

type PeriodType = "daily" | "weekly" | "monthly";

function rupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function getStartOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getStartOfWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = r.getDate() - day + (day === 0 ? -6 : 1);
  r.setDate(diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getStartOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function getEndOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function getEndOfWeek(d: Date) {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getEndOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default function ReportsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const canAccess = ["owner", "developer"].includes((role || "").toString().toLowerCase());

  const [period, setPeriod] = useState<PeriodType>("daily");
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(false);

  const dateRange = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    if (period === "daily") return { start: getStartOfDay(d), end: getEndOfDay(d) };
    if (period === "weekly") return { start: getStartOfWeek(d), end: getEndOfWeek(d) };
    return { start: getStartOfMonth(d), end: getEndOfMonth(d) };
  }, [period, selectedDate]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    (async () => {
      setFetching(true);
      try {
        const ref = collection(db, `tenants/${tenantId}/orders`);
        const qy = query(
          ref,
          where("createdAt", ">=", Timestamp.fromDate(dateRange.start)),
          where("createdAt", "<=", Timestamp.fromDate(dateRange.end)),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qy);
        if (cancelled) return;

        const arr: Order[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            orderNo: data.orderNo || "",
            status: data.status || "",
            mode: data.mode || "",
            paymentMethod: data.paymentMethod || null,
            subtotal: Number(data.subtotal || 0),
            discount: Number(data.discount || 0),
            total: Number(data.total || 0),
            items: Array.isArray(data.items) ? data.items : [],
            createdAt: data.createdAt,
            paidAt: data.paidAt,
          };
        });
        setOrders(arr);
      } catch (e: any) {
        console.error("Reports fetch error:", e);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId, dateRange]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "PAID");
    const cancelled = orders.filter((o) => o.status === "CANCELLED");
    const open = orders.filter((o) => o.status === "OPEN");

    const totalOmzet = paid.reduce((a, o) => a + o.total, 0);
    const totalDiscount = paid.reduce((a, o) => a + o.discount, 0);
    const totalSubtotal = paid.reduce((a, o) => a + o.subtotal, 0);

    const cashOrders = paid.filter((o) => o.paymentMethod === "CASH");
    const qrisOrders = paid.filter((o) => o.paymentMethod === "QRIS");
    const cashTotal = cashOrders.reduce((a, o) => a + o.total, 0);
    const qrisTotal = qrisOrders.reduce((a, o) => a + o.total, 0);

    // Top products
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    paid.forEach((o) => {
      o.items.forEach((item: any) => {
        const key = (item.name || "").toString();
        if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0 };
        productMap[key].qty += Number(item.qty || 0);
        productMap[key].revenue += Number(item.price || 0) * Number(item.qty || 0);
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Per-day breakdown (for weekly/monthly)
    const dailyMap: Record<string, { date: string; total: number; count: number }> = {};
    paid.forEach((o) => {
      const d = toDate(o.paidAt || o.createdAt);
      if (!d) return;
      const key = d.toISOString().split("T")[0];
      if (!dailyMap[key]) dailyMap[key] = { date: key, total: 0, count: 0 };
      dailyMap[key].total += o.total;
      dailyMap[key].count += 1;
    });
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalOrders: orders.length,
      paidCount: paid.length,
      cancelledCount: cancelled.length,
      openCount: open.length,
      totalOmzet,
      totalDiscount,
      totalSubtotal,
      cashCount: cashOrders.length,
      cashTotal,
      qrisCount: qrisOrders.length,
      qrisTotal,
      topProducts,
      dailyBreakdown,
      avgTransaction: paid.length > 0 ? Math.round(totalOmzet / paid.length) : 0,
    };
  }, [orders]);

  function exportExcel() {
    const paid = orders.filter((o) => o.status === "PAID");
    let csv = "No,Order No,Tanggal,Metode Bayar,Subtotal,Diskon,Total,Items\n";
    paid.forEach((o, i) => {
      const d = toDate(o.paidAt || o.createdAt);
      const dateStr = d ? d.toLocaleString("id-ID") : "-";
      const items = o.items.map((it: any) => `${it.name}x${it.qty}`).join("; ");
      csv += `${i + 1},"${o.orderNo}","${dateStr}","${o.paymentMethod || "-"}",${o.subtotal},${o.discount},${o.total},"${items}"\n`;
    });

    // Summary
    csv += "\n\nRINGKASAN\n";
    csv += `Total Transaksi,${stats.paidCount}\n`;
    csv += `Total Omzet,${stats.totalOmzet}\n`;
    csv += `Total Diskon,${stats.totalDiscount}\n`;
    csv += `CASH,${stats.cashCount} transaksi,${stats.cashTotal}\n`;
    csv += `QRIS,${stats.qrisCount} transaksi,${stats.qrisTotal}\n`;
    csv += `Rata-rata/Transaksi,${stats.avgTransaction}\n`;

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${period}-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || loadingRole) {
    return <TerraPage><SkeletonStyles /><PageSkeleton cards={3} /></TerraPage>;
  }

  if (!canAccess) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman laporan hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>Kembali</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <style>{`
        .report-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-top:14px; }
        .stat-card{ background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:14px; }
        .stat-value{ font-size:20px; font-weight:900; margin-top:6px; }
        .stat-label{ font-size:12px; color:var(--muted); }
        .breakdown-table{ width:100%; border-collapse:collapse; margin-top:12px; font-size:13px; }
        .breakdown-table th, .breakdown-table td{ padding:8px 10px; text-align:left; border-bottom:1px solid var(--border); }
        .breakdown-table th{ font-weight:700; color:var(--muted); font-size:11px; text-transform:uppercase; }
        .bar{ height:8px; border-radius:4px; background:var(--brand); margin-top:4px; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Laporan Keuangan</div>
            <div className="small">Periode: {formatDate(dateRange.start)} — {formatDate(dateRange.end)}</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className={"btn " + (period === "daily" ? "btn-primary" : "")} onClick={() => setPeriod("daily")}>Harian</button>
          <button className={"btn " + (period === "weekly" ? "btn-primary" : "")} onClick={() => setPeriod("weekly")}>Mingguan</button>
          <button className={"btn " + (period === "monthly" ? "btn-primary" : "")} onClick={() => setPeriod("monthly")}>Bulanan</button>
          <input
            type="date"
            className="input"
            style={{ width: 170 }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button className="btn btn-primary" onClick={exportExcel} disabled={fetching}>Export CSV</button>
        </div>
      </div>

      {fetching ? (
        <div style={{ marginTop: 14 }}><SkeletonStyles /><PageSkeleton cards={2} /></div>
      ) : (
        <>
          <div className="report-grid">
            <div className="stat-card">
              <div className="stat-label">Total Omzet</div>
              <div className="stat-value" style={{ color: "var(--brand)" }}>{rupiah(stats.totalOmzet)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Transaksi Lunas</div>
              <div className="stat-value">{stats.paidCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rata-rata / Transaksi</div>
              <div className="stat-value">{rupiah(stats.avgTransaction)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Diskon Diberikan</div>
              <div className="stat-value">{rupiah(stats.totalDiscount)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">CASH</div>
              <div className="stat-value">{rupiah(stats.cashTotal)}</div>
              <div className="stat-label">{stats.cashCount} transaksi</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">QRIS</div>
              <div className="stat-value">{rupiah(stats.qrisTotal)}</div>
              <div className="stat-label">{stats.qrisCount} transaksi</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Order Dibatalkan</div>
              <div className="stat-value" style={{ color: "var(--danger)" }}>{stats.cancelledCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Order Masih Open</div>
              <div className="stat-value">{stats.openCount}</div>
            </div>
          </div>

          {/* Daily Breakdown for weekly/monthly */}
          {period !== "daily" && stats.dailyBreakdown.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="h1">Breakdown per Hari</div>
              <table className="breakdown-table">
                <thead>
                  <tr><th>Tanggal</th><th>Transaksi</th><th>Omzet</th><th>Grafik</th></tr>
                </thead>
                <tbody>
                  {stats.dailyBreakdown.map((d) => {
                    const maxTotal = Math.max(...stats.dailyBreakdown.map((x) => x.total), 1);
                    const pct = Math.round((d.total / maxTotal) * 100);
                    return (
                      <tr key={d.date}>
                        <td>{formatDate(new Date(d.date + "T00:00:00"))}</td>
                        <td>{d.count}</td>
                        <td><b>{rupiah(d.total)}</b></td>
                        <td><div className="bar" style={{ width: `${pct}%` }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Products */}
          {stats.topProducts.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="h1">Top 10 Produk</div>
              <table className="breakdown-table">
                <thead>
                  <tr><th>#</th><th>Produk</th><th>Qty Terjual</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {stats.topProducts.map((p, i) => (
                    <tr key={p.name}>
                      <td>{i + 1}</td>
                      <td><b>{p.name}</b></td>
                      <td>{p.qty}</td>
                      <td>{rupiah(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </TerraPage>
  );
}
