"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import * as XLSX from "xlsx";

type OrderItem = { name: string; price: number; qty: number; notes?: string; category?: string };
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

type RefundLog = {
  id: string;
  orderNo?: string;
  tableNo?: string | null;
  total: number;
  paymentMethod?: string | null;
  refundedByEmail?: string;
  refundedAt?: any;
  reason?: string;
  items?: OrderItem[];
};

type RangePreset = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
type ProductSort = "qty" | "revenue" | "orders";

type SoldProduct = {
  name: string;
  category: string;
  qty: number;
  revenue: number;
  orders: number;
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

function formatRangeLabel(from: Date, to: Date) {
  return `${from.toLocaleDateString("id-ID")} - ${to.toLocaleDateString("id-ID")}`;
}

function getPresetRange(preset: RangePreset) {
  const now = new Date();

  if (preset === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }

  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  if (preset === "30d") {
    const from = new Date(now);
    from.setDate(now.getDate() - 29);
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  const from = startOfMonth(now);
  return { from, to: endOfDay(now) };
}

export default function ReportsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const roleLower = (role || "").toString().toLowerCase();
  const canView = roleLower === "owner" || roleLower === "admin";

  const [orders, setOrders] = useState<Order[]>([]);
  const [refundLogs, setRefundLogs] = useState<RefundLog[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const initialRange = getPresetRange("today");
  const [rangePreset, setRangePreset] = useState<RangePreset>("today");
  const [dateFrom, setDateFrom] = useState(formatDateInput(initialRange.from));
  const [dateTo, setDateTo] = useState(formatDateInput(initialRange.to));
  const [categoryFilter, setCategoryFilter] = useState("Semua");
  const [productSort, setProductSort] = useState<ProductSort>("qty");

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

  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/refunds`);
    const qy = query(ref, orderBy("refundedAt", "desc"));
    return onSnapshot(
      qy,
      (snap) => {
        const arr: RefundLog[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            orderNo: x.orderNo || d.id,
            tableNo: x.tableNo ?? null,
            total: Number(x.total || 0),
            paymentMethod: x.paymentMethod ?? null,
            refundedByEmail: x.refundedByEmail || "",
            refundedAt: x.refundedAt,
            reason: x.reason || "",
            items: Array.isArray(x.items) ? x.items : [],
          };
        });
        setRefundLogs(arr);
      },
      (e) => setErr(e.message)
    );
  }, [tenantId]);

  const paidOrders = useMemo(() => orders.filter((o) => o.status === "PAID"), [orders]);

  const activeRange = useMemo(() => {
    const from = startOfDay(parseDateInput(dateFrom));
    const to = endOfDay(parseDateInput(dateTo));
    return from <= to ? { from, to } : { from: to, to: from };
  }, [dateFrom, dateTo]);

  const reportStats = useMemo(() => {
    const { from, to } = activeRange;

    const rangeOrders = paidOrders.filter((o) => {
      const dt = toDateSafe(o.paidAt) || toDateSafe(o.createdAt);
      return !!dt && dt >= from && dt <= to;
    });

    const rangeRefunds = refundLogs.filter((o) => {
      const dt = toDateSafe(o.refundedAt);
      return !!dt && dt >= from && dt <= to;
    });

    let revenue = 0;
    let count = 0;
    let cashRevenue = 0;
    let qrisRevenue = 0;
    let refundTotal = 0;

    const productMap = new Map<string, SoldProduct>();

    for (const o of rangeOrders) {
      revenue += Number(o.total || 0);
      count += 1;

      if (o.paymentMethod === "CASH") cashRevenue += Number(o.total || 0);
      if (o.paymentMethod === "QRIS") qrisRevenue += Number(o.total || 0);

      for (const it of o.items || []) {
        const name = (it.name || "Unknown").toString();
        const category = (it.category || "Lainnya").toString();
        const qty = Number(it.qty || 0);
        const itemRevenue = Number(it.price || 0) * qty;
        const prev = productMap.get(name) || {
          name,
          category,
          qty: 0,
          revenue: 0,
          orders: 0,
        };

        productMap.set(name, {
          name,
          category: prev.category || category,
          qty: prev.qty + qty,
          revenue: prev.revenue + itemRevenue,
          orders: prev.orders + 1,
        });
      }
    }

    for (const rf of rangeRefunds) {
      refundTotal += Number(rf.total || 0);
    }

    const soldProducts = Array.from(productMap.values());
    const avgOrder = count ? Math.round(revenue / count) : 0;

    return {
      rangeOrders,
      rangeRefunds,
      revenue,
      count,
      cashRevenue,
      qrisRevenue,
      refundTotal,
      netRevenue: revenue - refundTotal,
      avgOrder,
      soldProducts,
    };
  }, [activeRange, paidOrders, refundLogs]);

  const categoryOptions = useMemo(() => {
    return [
      "Semua",
      ...Array.from(
        new Set(reportStats.soldProducts.map((item) => (item.category || "Lainnya").toString()))
      ).sort((a, b) => a.localeCompare(b, "id-ID")),
    ];
  }, [reportStats.soldProducts]);

  const filteredProducts = useMemo(() => {
    const list =
      categoryFilter === "Semua"
        ? reportStats.soldProducts
        : reportStats.soldProducts.filter((item) => item.category === categoryFilter);

    return [...list].sort((a, b) => {
      if (productSort === "revenue") {
        if (b.revenue !== a.revenue) return b.revenue - a.revenue;
        return b.qty - a.qty;
      }
      if (productSort === "orders") {
        if (b.orders !== a.orders) return b.orders - a.orders;
        return b.qty - a.qty;
      }
      if (b.qty !== a.qty) return b.qty - a.qty;
      return b.revenue - a.revenue;
    });
  }, [reportStats.soldProducts, categoryFilter, productSort]);

  const categoryLeaders = useMemo(() => {
    return categoryOptions
      .filter((category) => category !== "Semua")
      .map((category) => {
        const items = reportStats.soldProducts
          .filter((product) => product.category === category)
          .sort((a, b) => {
            if (b.qty !== a.qty) return b.qty - a.qty;
            return b.revenue - a.revenue;
          });

        const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
        const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);

        return {
          category,
          leader: items[0] || null,
          totalQty,
          totalRevenue,
          skuCount: items.length,
        };
      })
      .filter((entry) => entry.leader);
  }, [categoryOptions, reportStats.soldProducts]);

  function applyRangePreset(preset: RangePreset) {
    setRangePreset(preset);
    if (preset === "custom") return;
    const next = getPresetRange(preset);
    setDateFrom(formatDateInput(next.from));
    setDateTo(formatDateInput(next.to));
  }

  function exportExcel() {
    if (!tenantId) return;

    const summaryRows = [
      { Metric: "Tenant", Value: tenantId },
      { Metric: "Periode", Value: formatRangeLabel(activeRange.from, activeRange.to) },
      { Metric: "Omzet Kotor", Value: reportStats.revenue },
      { Metric: "Refund", Value: reportStats.refundTotal },
      { Metric: "Omzet Bersih", Value: reportStats.netRevenue },
      { Metric: "Jumlah Transaksi", Value: reportStats.count },
      { Metric: "Rata-rata Order", Value: reportStats.avgOrder },
      { Metric: "Cash", Value: reportStats.cashRevenue },
      { Metric: "QRIS", Value: reportStats.qrisRevenue },
    ];

    const productRows = filteredProducts.map((product, index) => ({
      Rank: index + 1,
      Produk: product.name,
      Kategori: product.category,
      Qty: product.qty,
      OrderMuncul: product.orders,
      Omzet: product.revenue,
      KontribusiOmzetPct: reportStats.revenue
        ? Number(((product.revenue / reportStats.revenue) * 100).toFixed(2))
        : 0,
    }));

    const orderRows = reportStats.rangeOrders.map((o) => {
      const dt = toDateSafe(o.paidAt) || toDateSafe(o.createdAt);
      return {
        Tanggal: dt ? dt.toLocaleString("id-ID") : "-",
        OrderNo: o.orderNo || o.id,
        Meja: o.tableNo || "-",
        Metode: o.paymentMethod || "-",
        Subtotal: o.subtotal || 0,
        Diskon: o.discount || 0,
        Total: o.total || 0,
        Items: (o.items || []).map((it) => `${it.name} x${it.qty}`).join(" | "),
      };
    });

    const refundRows = reportStats.rangeRefunds.map((o) => {
      const dt = toDateSafe(o.refundedAt);
      return {
        Tanggal: dt ? dt.toLocaleString("id-ID") : "-",
        OrderNo: o.orderNo || o.id,
        Meja: o.tableNo || "-",
        RefundOleh: o.refundedByEmail || "-",
        Alasan: o.reason || "-",
        TotalRefund: o.total || 0,
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), "Produk");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), "Orders");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(refundRows), "Refunds");
    XLSX.writeFile(wb, `TerraPOS_Advanced_Report_${formatDateInput(activeRange.from)}_${formatDateInput(activeRange.to)}.xlsx`);
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
    <TerraPage maxWidth={1380}>
      <style>{`
        .stats-grid{
          margin-top:14px;
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap:14px;
        }
        @media (max-width: 1120px){
          .stats-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px){
          .stats-grid{ grid-template-columns: 1fr; }
        }
        .split-grid{
          margin-top:14px;
          display:grid;
          grid-template-columns: 1.2fr .8fr;
          gap:14px;
        }
        @media (max-width: 1080px){
          .split-grid{ grid-template-columns: 1fr; }
        }
        .leaders-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap:12px;
        }
        @media (max-width: 880px){
          .leaders-grid{ grid-template-columns: 1fr; }
        }
        .stat-card, .mini-card{
          border:1px solid var(--border);
          border-radius:18px;
          padding:16px;
          background:#fff;
        }
        .stat-label, .mini-label{
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
        .mini-value{
          margin-top:6px;
          font-size:18px;
          font-weight:900;
        }
        .filter-row{
          margin-top:14px;
          display:flex;
          flex-wrap:wrap;
          gap:10px;
        }
        .chip{
          border:1px solid var(--border);
          background:#fff;
          border-radius:999px;
          padding:8px 12px;
          font-size:12px;
          font-weight:800;
          cursor:pointer;
        }
        .chip.active{
          background:var(--brand);
          color:#fff;
          border-color:var(--brand);
        }
        .hero-panel{
          margin-top:14px;
          border:1px solid var(--border);
          border-radius:22px;
          background: linear-gradient(180deg, #ffffff 0%, #fff8f2 100%);
          padding:20px;
        }
        .hero-title{
          font-size:28px;
          font-weight:900;
        }
        .hero-sub{
          margin-top:8px;
          font-size:13px;
          color:var(--muted);
        }
        .control-grid{
          margin-top:14px;
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap:12px;
          align-items:end;
        }
        @media (max-width: 980px){
          .control-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px){
          .control-grid{ grid-template-columns: 1fr; }
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
        .table-wrap{
          margin-top:12px;
          overflow-x:auto;
        }
        .leader-card{
          border:1px solid var(--border);
          border-radius:16px;
          padding:14px;
          background:#fffaf5;
        }
        .leader-title{
          font-size:12px;
          color:var(--muted);
          font-weight:800;
        }
        .leader-name{
          margin-top:8px;
          font-size:16px;
          font-weight:900;
        }
        .leader-meta{
          margin-top:8px;
          font-size:12px;
          color:var(--muted);
          line-height:1.5;
        }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Advanced Reports</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">
              User: {email || "-"} | Role: <b>{role}</b>
            </div>
          </div>

          <div className="spacer" />

          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
        </div>
      </div>

      <div className="hero-panel">
        <div className="hero-title">Analitik Produk, Order, dan Refund</div>
        <div className="hero-sub">
          Gunakan filter periode, kategori, dan urutan ranking untuk membaca produk paling laris dengan lebih detail.
        </div>

        <div className="filter-row">
          <button className={`chip${rangePreset === "today" ? " active" : ""}`} onClick={() => applyRangePreset("today")}>
            Hari Ini
          </button>
          <button className={`chip${rangePreset === "yesterday" ? " active" : ""}`} onClick={() => applyRangePreset("yesterday")}>
            Kemarin
          </button>
          <button className={`chip${rangePreset === "7d" ? " active" : ""}`} onClick={() => applyRangePreset("7d")}>
            7 Hari
          </button>
          <button className={`chip${rangePreset === "30d" ? " active" : ""}`} onClick={() => applyRangePreset("30d")}>
            30 Hari
          </button>
          <button className={`chip${rangePreset === "month" ? " active" : ""}`} onClick={() => applyRangePreset("month")}>
            Bulan Ini
          </button>
          <button className={`chip${rangePreset === "custom" ? " active" : ""}`} onClick={() => setRangePreset("custom")}>
            Custom
          </button>
        </div>

        <div className="control-grid">
          <div>
            <div className="small">Dari Tanggal</div>
            <input
              className="input"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setRangePreset("custom");
                setDateFrom(e.target.value);
              }}
            />
          </div>

          <div>
            <div className="small">Sampai Tanggal</div>
            <input
              className="input"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setRangePreset("custom");
                setDateTo(e.target.value);
              }}
            />
          </div>

          <div>
            <div className="small">Kategori Produk</div>
            <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="small">Urutkan Produk</div>
            <select className="input" value={productSort} onChange={(e) => setProductSort(e.target.value as ProductSort)}>
              <option value="qty">Qty Terjual</option>
              <option value="revenue">Omzet</option>
              <option value="orders">Frekuensi Muncul</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 14, flexWrap: "wrap", gap: 10 }}>
          <div className="small">
            Periode aktif: <b>{formatRangeLabel(activeRange.from, activeRange.to)}</b>
          </div>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={exportExcel}>
            Export Excel Report Ini
          </button>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ color: "var(--danger)", fontWeight: 900 }}>{err}</div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Omzet Kotor</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            Rp {rupiah(reportStats.revenue)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Omzet Bersih</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            Rp {rupiah(reportStats.netRevenue)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Jumlah Transaksi</div>
          <div className="stat-value">{reportStats.count}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Rata-rata Order</div>
          <div className="stat-value">Rp {rupiah(reportStats.avgOrder)}</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="mini-card">
          <div className="mini-label">Pembayaran Cash</div>
          <div className="mini-value">Rp {rupiah(reportStats.cashRevenue)}</div>
        </div>
        <div className="mini-card">
          <div className="mini-label">Pembayaran QRIS</div>
          <div className="mini-value">Rp {rupiah(reportStats.qrisRevenue)}</div>
        </div>
        <div className="mini-card">
          <div className="mini-label">Total Refund</div>
          <div className="mini-value">Rp {rupiah(reportStats.refundTotal)}</div>
        </div>
        <div className="mini-card">
          <div className="mini-label">SKU Terjual</div>
          <div className="mini-value">{reportStats.soldProducts.length}</div>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="h1">Produk Paling Laris</div>
          <div className="small" style={{ marginTop: 6 }}>
            Ranking produk berdasarkan filter saat ini. Kategori: <b>{categoryFilter}</b>.
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Qty</th>
                  <th>Muncul di Order</th>
                  <th>Omzet</th>
                  <th>Kontribusi</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  const contribution = reportStats.revenue
                    ? Math.round((product.revenue / reportStats.revenue) * 100)
                    : 0;

                  return (
                    <tr key={`${product.category}-${product.name}`}>
                      <td style={{ fontWeight: 900 }}>{index + 1}</td>
                      <td style={{ fontWeight: 900 }}>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{product.qty}</td>
                      <td>{product.orders}</td>
                      <td style={{ fontWeight: 900, color: "var(--brand)" }}>Rp {rupiah(product.revenue)}</td>
                      <td>{contribution}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="small" style={{ marginTop: 12 }}>
              Belum ada data produk untuk filter ini.
            </div>
          )}
        </div>

        <div className="card">
          <div className="h1">Juara Tiap Kategori</div>
          <div className="small" style={{ marginTop: 6 }}>
            Ringkasan pemimpin penjualan di masing-masing kategori selama periode aktif.
          </div>

          <div className="leaders-grid" style={{ marginTop: 12 }}>
            {categoryLeaders.map((entry) => (
              <div key={entry.category} className="leader-card">
                <div className="leader-title">Kategori {entry.category}</div>
                <div className="leader-name">{entry.leader?.name}</div>
                <div className="leader-meta">
                  Terjual {entry.leader?.qty} item
                  <br />
                  Omzet Rp {rupiah(entry.leader?.revenue || 0)}
                  <br />
                  SKU aktif {entry.skuCount} • Total qty kategori {entry.totalQty}
                </div>
              </div>
            ))}
          </div>

          {categoryLeaders.length === 0 && (
            <div className="small" style={{ marginTop: 12 }}>
              Belum ada kategori yang bisa dianalisis pada periode ini.
            </div>
          )}
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="h1">Daftar Order</div>
          <div className="small" style={{ marginTop: 6 }}>
            Hanya order dengan status <b>PAID</b> pada periode aktif.
          </div>

          <div className="table-wrap">
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
                {reportStats.rangeOrders.map((o) => {
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
                            {(it.notes || "").trim() ? ` - ${it.notes}` : ""}
                          </div>
                        ))}
                      </td>
                      <td style={{ fontWeight: 900, color: "var(--brand)" }}>Rp {rupiah(o.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {reportStats.rangeOrders.length === 0 && (
            <div className="small" style={{ marginTop: 12 }}>
              Tidak ada transaksi pada periode ini.
            </div>
          )}
        </div>

        <div className="card">
          <div className="h1">Log Refund</div>
          <div className="small" style={{ marginTop: 6 }}>
            Menampilkan semua refund yang terjadi pada periode aktif.
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu Refund</th>
                  <th>Order No</th>
                  <th>Meja</th>
                  <th>Refund Oleh</th>
                  <th>Alasan</th>
                  <th>Total Refund</th>
                </tr>
              </thead>
              <tbody>
                {reportStats.rangeRefunds.map((o) => (
                  <tr key={o.id}>
                    <td>{formatDateTime(toDateSafe(o.refundedAt))}</td>
                    <td style={{ fontWeight: 900 }}>{o.orderNo || o.id}</td>
                    <td>{o.tableNo || "-"}</td>
                    <td>{o.refundedByEmail || "-"}</td>
                    <td>{o.reason || "-"}</td>
                    <td style={{ fontWeight: 900 }}>Rp {rupiah(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reportStats.rangeRefunds.length === 0 && (
            <div className="small" style={{ marginTop: 12 }}>
              Tidak ada refund pada periode ini.
            </div>
          )}
        </div>
      </div>
    </TerraPage>
  );
}
