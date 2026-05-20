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

type Refund = {
  id: string;
  orderNo: string;
  total: number;
  reason: string;
  refundedBy: string;
  createdAt: any;
};

type TabType = "ringkasan" | "harian" | "refund" | "export";

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


function formatDateTime(d: Date) {
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getStartOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function getEndOfDay(d: Date) { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; }
function getStartOfWeek(d: Date) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - day + (day === 0 ? -6 : 1)); r.setHours(0, 0, 0, 0); return r; }
function getEndOfWeek(d: Date) { const s = getStartOfWeek(d); const e = new Date(s); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999); return e; }
function getStartOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function getEndOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }

export default function ReportsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();
  const canAccess = ["owner", "developer"].includes((role || "").toString().toLowerCase());

  const [tab, setTab] = useState<TabType>("ringkasan");
  const [rangeMode, setRangeMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().split("T")[0]);
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [fetching, setFetching] = useState(false);


  const dateRange = useMemo(() => {
    if (rangeMode === "custom") {
      return { start: getStartOfDay(new Date(customStart + "T00:00:00")), end: getEndOfDay(new Date(customEnd + "T00:00:00")) };
    }
    const d = new Date(selectedDate + "T00:00:00");
    if (preset === "daily") return { start: getStartOfDay(d), end: getEndOfDay(d) };
    if (preset === "weekly") return { start: getStartOfWeek(d), end: getEndOfWeek(d) };
    return { start: getStartOfMonth(d), end: getEndOfMonth(d) };
  }, [rangeMode, preset, selectedDate, customStart, customEnd]);

  // Fetch orders
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      try {
        const ref = collection(db, `tenants/${tenantId}/orders`);
        const qy = query(ref, where("createdAt", ">=", Timestamp.fromDate(dateRange.start)), where("createdAt", "<=", Timestamp.fromDate(dateRange.end)), orderBy("createdAt", "desc"));
        const snap = await getDocs(qy);
        if (cancelled) return;
        setOrders(snap.docs.map((d) => { const data = d.data() as any; return { id: d.id, orderNo: data.orderNo || "", status: data.status || "", mode: data.mode || "", paymentMethod: data.paymentMethod || null, subtotal: Number(data.subtotal || 0), discount: Number(data.discount || 0), total: Number(data.total || 0), items: Array.isArray(data.items) ? data.items : [], createdAt: data.createdAt, paidAt: data.paidAt }; }));
      } catch {} finally { if (!cancelled) setFetching(false); }
    })();
    return () => { cancelled = true; };
  }, [tenantId, dateRange]);

  // Fetch refunds
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = collection(db, `tenants/${tenantId}/refunds`);
        const qy = query(ref, where("createdAt", ">=", Timestamp.fromDate(dateRange.start)), where("createdAt", "<=", Timestamp.fromDate(dateRange.end)), orderBy("createdAt", "desc"));
        const snap = await getDocs(qy);
        if (cancelled) return;
        setRefunds(snap.docs.map((d) => { const data = d.data() as any; return { id: d.id, orderNo: data.orderNo || "", total: Number(data.total || 0), reason: data.reason || data.description || "", refundedBy: data.refundedBy || data.userEmail || "", createdAt: data.createdAt }; }));
      } catch { if (!cancelled) setRefunds([]); }
    })();
    return () => { cancelled = true; };
  }, [tenantId, dateRange]);


  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "PAID");
    const cancelled = orders.filter((o) => o.status === "CANCELLED");
    const totalOmzet = paid.reduce((a, o) => a + o.total, 0);
    const totalDiscount = paid.reduce((a, o) => a + o.discount, 0);
    const cashOrders = paid.filter((o) => o.paymentMethod === "CASH");
    const qrisOrders = paid.filter((o) => o.paymentMethod === "QRIS");
    const cashTotal = cashOrders.reduce((a, o) => a + o.total, 0);
    const qrisTotal = qrisOrders.reduce((a, o) => a + o.total, 0);
    const totalRefund = refunds.reduce((a, r) => a + r.total, 0);
    const netRevenue = totalOmzet - totalRefund;

    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    paid.forEach((o) => { o.items.forEach((item: any) => { const key = (item.name || "").toString(); if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0 }; productMap[key].qty += Number(item.qty || 0); productMap[key].revenue += Number(item.price || 0) * Number(item.qty || 0); }); });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const dailyMap: Record<string, { date: string; total: number; count: number; cash: number; qris: number }> = {};
    paid.forEach((o) => { const d = toDate(o.paidAt || o.createdAt); if (!d) return; const key = d.toISOString().split("T")[0]; if (!dailyMap[key]) dailyMap[key] = { date: key, total: 0, count: 0, cash: 0, qris: 0 }; dailyMap[key].total += o.total; dailyMap[key].count += 1; if (o.paymentMethod === "CASH") dailyMap[key].cash += o.total; if (o.paymentMethod === "QRIS") dailyMap[key].qris += o.total; });
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return { totalOrders: orders.length, paidCount: paid.length, cancelledCount: cancelled.length, totalOmzet, totalDiscount, cashCount: cashOrders.length, cashTotal, qrisCount: qrisOrders.length, qrisTotal, topProducts, dailyBreakdown, avgTransaction: paid.length > 0 ? Math.round(totalOmzet / paid.length) : 0, totalRefund, refundCount: refunds.length, netRevenue };
  }, [orders, refunds]);


  function exportCSV() {
    const paid = orders.filter((o) => o.status === "PAID");
    let csv = "No,Order No,Tanggal,Metode,Subtotal,Diskon,Total,Items\n";
    paid.forEach((o, i) => { const d = toDate(o.paidAt || o.createdAt); csv += `${i + 1},"${o.orderNo}","${d ? formatDateTime(d) : "-"}","${o.paymentMethod || "-"}",${o.subtotal},${o.discount},${o.total},"${o.items.map((it: any) => `${it.name}x${it.qty}`).join("; ")}"\n`; });
    csv += `\n\nRINGKASAN\nTotal Transaksi,${stats.paidCount}\nTotal Omzet,${stats.totalOmzet}\nTotal Diskon,${stats.totalDiscount}\nTotal Refund,${stats.totalRefund}\nNet Revenue,${stats.netRevenue}\nCASH,${stats.cashCount} trx,${stats.cashTotal}\nQRIS,${stats.qrisCount} trx,${stats.qrisTotal}\n`;
    if (refunds.length > 0) { csv += `\n\nLAPORAN REFUND\nNo,Order No,Tanggal,Total,Alasan,Oleh\n`; refunds.forEach((rf, i) => { const d = toDate(rf.createdAt); csv += `${i + 1},"${rf.orderNo}","${d ? formatDateTime(d) : "-"}",${rf.total},"${rf.reason}","${rf.refundedBy}"\n`; }); }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `laporan-${rangeMode === "custom" ? customStart + "_" + customEnd : preset + "-" + selectedDate}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (loading || loadingRole) return <TerraPage><SkeletonStyles /><PageSkeleton cards={3} /></TerraPage>;
  if (!canAccess) return (<TerraPage><div className="card"><div className="h1">Akses ditolak</div><div className="small">Halaman laporan hanya untuk owner.</div><button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>Kembali</button></div></TerraPage>);

  return (
    <TerraPage>
      <style>{`
        .rp-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;}
        .rp-tab{padding:9px 16px;border-radius:8px;font-weight:700;font-size:13px;border:1px solid var(--border);background:var(--panel);cursor:pointer;transition:all 0.15s;}
        .rp-tab.active{background:var(--brand);color:#fff;border-color:var(--brand);}
        .rp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:14px;}
        .rp-stat{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px;}
        .rp-stat-val{font-size:20px;font-weight:900;margin-top:6px;}
        .rp-stat-label{font-size:11px;color:var(--muted);font-weight:700;}
        .rp-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;}
        .rp-table th,.rp-table td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);}
        .rp-table th{font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;}
        .rp-bar{height:8px;border-radius:4px;background:var(--brand);margin-top:4px;}
        .rp-refund-card{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--panel);margin-top:10px;}
      `}</style>


      {/* HEADER */}
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

        {/* RANGE SELECTOR */}
        <div className="row" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
          <button className={"rp-tab " + (rangeMode === "preset" ? "active" : "")} onClick={() => setRangeMode("preset")}>Preset</button>
          <button className={"rp-tab " + (rangeMode === "custom" ? "active" : "")} onClick={() => setRangeMode("custom")}>Custom Range</button>
        </div>

        {rangeMode === "preset" ? (
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className={"rp-tab " + (preset === "daily" ? "active" : "")} onClick={() => setPreset("daily")}>Harian</button>
            <button className={"rp-tab " + (preset === "weekly" ? "active" : "")} onClick={() => setPreset("weekly")}>Mingguan</button>
            <button className={"rp-tab " + (preset === "monthly" ? "active" : "")} onClick={() => setPreset("monthly")}>Bulanan</button>
            <input type="date" className="input" style={{ width: 160 }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        ) : (
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <div><div className="small">Dari</div><input type="date" className="input" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></div>
            <div><div className="small">Sampai</div><input type="date" className="input" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></div>
          </div>
        )}

        {/* TABS */}
        <div className="rp-tabs">
          <button className={"rp-tab " + (tab === "ringkasan" ? "active" : "")} onClick={() => setTab("ringkasan")}>Ringkasan</button>
          <button className={"rp-tab " + (tab === "harian" ? "active" : "")} onClick={() => setTab("harian")}>Breakdown Harian</button>
          <button className={"rp-tab " + (tab === "refund" ? "active" : "")} onClick={() => setTab("refund")}>Refund ({stats.refundCount})</button>
          <button className={"rp-tab " + (tab === "export" ? "active" : "")} onClick={() => setTab("export")}>Export</button>
        </div>
      </div>


      {fetching ? <div style={{ marginTop: 14 }}><SkeletonStyles /><PageSkeleton cards={2} /></div> : (<>

      {/* TAB: RINGKASAN */}
      {tab === "ringkasan" && (<>
        <div className="rp-grid">
          <div className="rp-stat"><div className="rp-stat-label">Total Omzet (Bruto)</div><div className="rp-stat-val" style={{ color: "var(--brand)" }}>{rupiah(stats.totalOmzet)}</div></div>
          <div className="rp-stat"><div className="rp-stat-label">Total Refund</div><div className="rp-stat-val" style={{ color: "var(--danger)" }}>{rupiah(stats.totalRefund)}</div><div className="rp-stat-label">{stats.refundCount} refund</div></div>
          <div className="rp-stat"><div className="rp-stat-label">Net Revenue</div><div className="rp-stat-val" style={{ color: "var(--success)" }}>{rupiah(stats.netRevenue)}</div></div>
          <div className="rp-stat"><div className="rp-stat-label">Transaksi Lunas</div><div className="rp-stat-val">{stats.paidCount}</div></div>
          <div className="rp-stat"><div className="rp-stat-label">Rata-rata / Transaksi</div><div className="rp-stat-val">{rupiah(stats.avgTransaction)}</div></div>
          <div className="rp-stat"><div className="rp-stat-label">Total Diskon</div><div className="rp-stat-val">{rupiah(stats.totalDiscount)}</div></div>
          <div className="rp-stat"><div className="rp-stat-label">CASH</div><div className="rp-stat-val">{rupiah(stats.cashTotal)}</div><div className="rp-stat-label">{stats.cashCount} trx</div></div>
          <div className="rp-stat"><div className="rp-stat-label">QRIS</div><div className="rp-stat-val">{rupiah(stats.qrisTotal)}</div><div className="rp-stat-label">{stats.qrisCount} trx</div></div>
          <div className="rp-stat"><div className="rp-stat-label">Dibatalkan</div><div className="rp-stat-val" style={{ color: "var(--danger)" }}>{stats.cancelledCount}</div></div>
        </div>

        {stats.topProducts.length > 0 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="h1">Top 10 Produk</div>
            <table className="rp-table"><thead><tr><th>#</th><th>Produk</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>
              {stats.topProducts.map((p, i) => (<tr key={p.name}><td>{i + 1}</td><td><b>{p.name}</b></td><td>{p.qty}</td><td>{rupiah(p.revenue)}</td></tr>))}
            </tbody></table>
          </div>
        )}
      </>)}


      {/* TAB: BREAKDOWN HARIAN */}
      {tab === "harian" && (<>
        {stats.dailyBreakdown.length > 0 ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="h1">Breakdown per Hari</div>
            <div className="small" style={{ marginTop: 4 }}>Merge semua transaksi dalam range yang dipilih, dikelompokkan per hari.</div>
            <table className="rp-table"><thead><tr><th>Tanggal</th><th>Trx</th><th>Cash</th><th>QRIS</th><th>Total</th><th>Grafik</th></tr></thead><tbody>
              {stats.dailyBreakdown.map((d) => { const max = Math.max(...stats.dailyBreakdown.map((x) => x.total), 1); return (
                <tr key={d.date}><td>{formatDate(new Date(d.date + "T00:00:00"))}</td><td>{d.count}</td><td>{rupiah(d.cash)}</td><td>{rupiah(d.qris)}</td><td><b>{rupiah(d.total)}</b></td><td><div className="rp-bar" style={{ width: `${Math.round((d.total / max) * 100)}%` }} /></td></tr>
              ); })}
              <tr style={{ fontWeight: 900 }}><td>TOTAL</td><td>{stats.dailyBreakdown.reduce((a, d) => a + d.count, 0)}</td><td>{rupiah(stats.dailyBreakdown.reduce((a, d) => a + d.cash, 0))}</td><td>{rupiah(stats.dailyBreakdown.reduce((a, d) => a + d.qris, 0))}</td><td>{rupiah(stats.totalOmzet)}</td><td></td></tr>
            </tbody></table>
          </div>
        ) : <div className="card" style={{ marginTop: 14 }}><div className="small">Tidak ada data di periode ini.</div></div>}
      </>)}

      {/* TAB: REFUND */}
      {tab === "refund" && (<>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row">
            <div>
              <div className="h1">Laporan Refund</div>
              <div className="small">Riwayat refund dalam periode yang dipilih.</div>
            </div>
            <div className="spacer" />
            <div className="rp-stat" style={{ padding: "10px 16px" }}>
              <div className="rp-stat-label">Total Refund</div>
              <div className="rp-stat-val" style={{ color: "var(--danger)", fontSize: 18 }}>{rupiah(stats.totalRefund)}</div>
              <div className="rp-stat-label">{stats.refundCount} transaksi</div>
            </div>
          </div>

          {refunds.length > 0 ? (
            <table className="rp-table"><thead><tr><th>#</th><th>Order</th><th>Tanggal</th><th>Total</th><th>Alasan</th><th>Oleh</th></tr></thead><tbody>
              {refunds.map((rf, i) => { const d = toDate(rf.createdAt); return (
                <tr key={rf.id}><td>{i + 1}</td><td><b>{rf.orderNo}</b></td><td>{d ? formatDateTime(d) : "-"}</td><td style={{ color: "var(--danger)", fontWeight: 800 }}>{rupiah(rf.total)}</td><td>{rf.reason || "-"}</td><td>{rf.refundedBy || "-"}</td></tr>
              ); })}
            </tbody></table>
          ) : <div className="small" style={{ marginTop: 14 }}>Tidak ada refund di periode ini.</div>}
        </div>
      </>)}


      {/* TAB: EXPORT */}
      {tab === "export" && (<>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="h1">Export Laporan</div>
          <div className="small" style={{ marginTop: 6 }}>Download laporan lengkap dalam format CSV (bisa dibuka di Excel/Google Sheets).</div>
          <div className="small" style={{ marginTop: 4 }}>Periode: <b>{formatDate(dateRange.start)} — {formatDate(dateRange.end)}</b></div>

          <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 12, background: "var(--brandSoft)" }}>
            <div style={{ fontWeight: 800 }}>Isi Export:</div>
            <ul style={{ margin: "8px 0 0 16px", fontSize: 13, lineHeight: 1.8, color: "var(--muted)" }}>
              <li>Daftar semua transaksi lunas (detail items)</li>
              <li>Ringkasan: omzet, diskon, CASH/QRIS, net revenue</li>
              <li>Laporan refund (jika ada)</li>
            </ul>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={exportCSV}>
            Download CSV ({stats.paidCount} transaksi + {stats.refundCount} refund)
          </button>
        </div>
      </>)}

      </>)}
    </TerraPage>
  );
}
