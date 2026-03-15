"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

type OrderItem = {
  name: string;
  price: number;
  qty: number;
};

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

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });
}

function last7Days() {
  const arr: Date[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    arr.push(d);
  }
  return arr;
}

export default function DashboardPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const roleLower = (role || "").toString().toLowerCase();
  const isOwner = roleLower === "owner";
  const canView = roleLower === "owner" || roleLower === "admin";

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [storeName, setStoreName] = useState("TerraPOS");
  const [address, setAddress] = useState("");
  const [footer, setFooter] = useState("Terima kasih.");
  const [cashierName, setCashierName] = useState("Kasir TerraPOS");
  const [refundPin, setRefundPin] = useState("123456");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [printMode, setPrintMode] = useState<"browser" | "rawbt">("browser");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("terrapos_print_mode");
      setPrintMode(mode === "rawbt" ? "rawbt" : "browser");
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const ref = collection(db, `tenants/${tenantId}/orders`);
    const qy = query(ref, orderBy("createdAt", "desc"));

    return onSnapshot(
      qy,
      (snap) => {
        const arr: Order[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            orderNo: data.orderNo || d.id,
            status: data.status || "OPEN",
            mode: data.mode || "PAY_LATER",
            paymentMethod: data.paymentMethod ?? null,
            tableNo: data.tableNo ?? null,
            total: Number(data.total || 0),
            discount: Number(data.discount || 0),
            subtotal: Number(data.subtotal || 0),
            items: Array.isArray(data.items) ? data.items : [],
            createdAt: data.createdAt,
            paidAt: data.paidAt,
          };
        });
        setOrders(arr);
      },
      (e) => setErr(e.message)
    );
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d = snap.data() as any;
          setStoreName((d.storeName || "TerraPOS").toString());
          setAddress((d.address || "").toString());
          setFooter((d.footer || "Terima kasih.").toString());
          setCashierName((d.cashierName || "Kasir TerraPOS").toString());
          setRefundPin((d.refundPin || "123456").toString());
        }
      } catch {}
    })();
  }, [tenantId]);

  const paidOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toUpperCase() === "PAID"),
    [orders]
  );

  const openOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toUpperCase() === "OPEN"),
    [orders]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const sod = startOfDay(now);
    const som = startOfMonth(now);

    let todayRevenue = 0;
    let todayCount = 0;
    let monthRevenue = 0;
    let monthCount = 0;
    let cashRevenue = 0;
    let qrisRevenue = 0;

    const topMap = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const o of paidOrders) {
      const d: Date | null = o.paidAt?.toDate?.() ?? o.createdAt?.toDate?.() ?? null;
      if (!d) continue;

      if (d >= sod) {
        todayRevenue += o.total;
        todayCount += 1;
      }

      if (d >= som) {
        monthRevenue += o.total;
        monthCount += 1;

        if (o.paymentMethod === "CASH") cashRevenue += o.total;
        if (o.paymentMethod === "QRIS") qrisRevenue += o.total;

        for (const it of o.items || []) {
          const key = (it.name || "Unknown").toString();
          const qty = Number(it.qty || 0);
          const revenue = Number(it.price || 0) * qty;
          const prev = topMap.get(key) || { name: key, qty: 0, revenue: 0 };
          topMap.set(key, {
            name: key,
            qty: prev.qty + qty,
            revenue: prev.revenue + revenue,
          });
        }
      }
    }

    const topProducts = Array.from(topMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const avgOrder = monthCount ? Math.round(monthRevenue / monthCount) : 0;

    return {
      todayRevenue,
      todayCount,
      monthRevenue,
      monthCount,
      avgOrder,
      cashRevenue,
      qrisRevenue,
      topProducts,
    };
  }, [paidOrders]);

  const dailyChart = useMemo(() => {
    const days = last7Days();

    const values = days.map((day) => {
      const next = new Date(day);
      next.setDate(day.getDate() + 1);

      let revenue = 0;

      for (const o of paidOrders) {
        const d: Date | null = o.paidAt?.toDate?.() ?? o.createdAt?.toDate?.() ?? null;
        if (!d) continue;
        if (d >= day && d < next) {
          revenue += o.total;
        }
      }

      return {
        label: formatDayLabel(day),
        revenue,
      };
    });

    const maxRevenue = Math.max(...values.map((v) => v.revenue), 1);

    return values.map((v) => ({
      ...v,
      pct: Math.max(6, Math.round((v.revenue / maxRevenue) * 100)),
    }));
  }, [paidOrders]);

  const paymentChart = useMemo(() => {
    const total = stats.cashRevenue + stats.qrisRevenue;
    const cashPct = total ? Math.round((stats.cashRevenue / total) * 100) : 0;
    const qrisPct = total ? Math.round((stats.qrisRevenue / total) * 100) : 0;
    return { total, cashPct, qrisPct };
  }, [stats.cashRevenue, stats.qrisRevenue]);

  async function saveReceiptSettings() {
    if (!tenantId) return;

    setSaving(true);
    setSaveMsg("");

    try {
      await setDoc(
        doc(db, `tenants/${tenantId}/settings/main`),
        {
          storeName: storeName.trim() || "TerraPOS",
          address: address.trim(),
          footer: footer.trim() || "Terima kasih.",
          cashierName: cashierName.trim() || "Kasir TerraPOS",
          refundPin: refundPin.trim() || "123456",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaveMsg("Tersimpan. Perubahan dipakai untuk struk dan refund berikutnya.");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e: any) {
      setSaveMsg("Gagal simpan: " + (e?.message || "unknown"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingRole) {
    return (
      <TerraPage maxWidth={1440}>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  if (!canView) {
    return (
      <TerraPage maxWidth={1440}>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Dashboard hanya untuk owner/admin.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>
            Kembali ke POS
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={1440}>
      <style>{`
        .premium-shell{
          display:grid;
          grid-template-columns: 260px 1fr;
          gap:16px;
          margin-top:14px;
        }
        @media (max-width: 1100px){
          .premium-shell{
            grid-template-columns: 1fr;
          }
        }
        .sidebar{
          border:1px solid var(--border);
          border-radius:20px;
          background:#ffffff;
          padding:18px;
          height: fit-content;
          position: sticky;
          top: 16px;
        }
        .brandbox{
          padding:14px;
          border-radius:18px;
          background: linear-gradient(180deg, #fff7f0 0%, #ffffff 100%);
          border:1px solid #ffe0c2;
        }
        .brandtitle{
          font-size:20px;
          font-weight:900;
          color:#111827;
        }
        .brandsub{
          margin-top:6px;
          font-size:12px;
          color:var(--muted);
        }
        .sidegroup{
          margin-top:16px;
          display:grid;
          gap:10px;
        }
        .sidebtn{
          width:100%;
          text-align:left;
          border:1px solid var(--border);
          background:#fff;
          padding:12px 14px;
          border-radius:14px;
          cursor:pointer;
          font-weight:800;
        }
        .sidebtn:hover{
          background:var(--brandSoft);
          border-color:#ffd7b5;
        }
        .maincol{
          display:grid;
          gap:16px;
        }
        .hero{
          border:1px solid var(--border);
          border-radius:22px;
          background: linear-gradient(180deg, #ffffff 0%, #fff9f4 100%);
          padding:22px;
        }
        .hero-top{
          display:flex;
          justify-content:space-between;
          gap:16px;
          align-items:flex-start;
          flex-wrap:wrap;
        }
        .hero-title{
          font-size:28px;
          font-weight:900;
          line-height:1.1;
        }
        .hero-sub{
          margin-top:8px;
          color:var(--muted);
          font-size:13px;
        }
        .hero-badges{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .badge{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:9px 12px;
          border-radius:999px;
          border:1px solid var(--border);
          background:#fff;
          font-size:12px;
          font-weight:800;
        }
        .stats-grid{
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap:14px;
        }
        @media (max-width: 1080px){
          .stats-grid{
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px){
          .stats-grid{
            grid-template-columns: 1fr;
          }
        }
        .stat-card{
          border:1px solid var(--border);
          border-radius:18px;
          padding:18px;
          background:#fff;
          box-shadow: 0 4px 14px rgba(17,24,39,0.04);
        }
        .stat-label{
          font-size:12px;
          color:var(--muted);
          font-weight:700;
        }
        .stat-value{
          margin-top:10px;
          font-size:28px;
          font-weight:900;
          line-height:1.1;
          color:#111827;
        }
        .stat-note{
          margin-top:8px;
          font-size:12px;
          color:var(--muted);
        }
        .content-grid{
          display:grid;
          grid-template-columns: 1.15fr .85fr;
          gap:16px;
        }
        @media (max-width: 1180px){
          .content-grid{
            grid-template-columns: 1fr;
          }
        }
        .panel{
          border:1px solid var(--border);
          border-radius:20px;
          background:#fff;
          padding:18px;
          box-shadow: 0 4px 14px rgba(17,24,39,0.04);
        }
        .panel-title{
          font-size:18px;
          font-weight:900;
        }
        .panel-sub{
          margin-top:6px;
          font-size:12px;
          color:var(--muted);
        }
        .quick-grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap:12px;
          margin-top:14px;
        }
        @media (max-width: 980px){
          .quick-grid{
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px){
          .quick-grid{
            grid-template-columns: 1fr;
          }
        }
        .quickbtn{
          text-align:left;
          padding:14px;
          border-radius:16px;
          border:1px solid var(--border);
          background:#fff;
          cursor:pointer;
        }
        .quickbtn:hover{
          background:var(--brandSoft);
          border-color:#ffd7b5;
        }
        .quicktitle{
          font-weight:900;
          font-size:15px;
        }
        .quickdesc{
          margin-top:6px;
          font-size:12px;
          color:var(--muted);
          line-height:1.45;
        }
        .two-col{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:16px;
        }
        @media (max-width: 780px){
          .two-col{
            grid-template-columns: 1fr;
          }
        }
        table{
          width:100%;
          border-collapse:collapse;
        }
        th, td{
          padding:11px 8px;
          border-bottom:1px solid var(--border);
          text-align:left;
        }
        th{
          font-size:12px;
          color:var(--muted);
          font-weight:800;
        }
        .receipt-preview{
          margin-top:14px;
          border:1px dashed var(--border);
          border-radius:16px;
          padding:14px;
          background:#fffdfa;
          font-family: ui-monospace, Menlo, Consolas, monospace;
          white-space: pre-wrap;
          line-height:1.5;
          font-size:13px;
        }
        .mini-stack{
          display:grid;
          gap:12px;
        }
        .mini-box{
          border:1px solid var(--border);
          border-radius:16px;
          padding:14px;
          background:#fff;
        }
        .mini-label{
          font-size:12px;
          color:var(--muted);
          font-weight:700;
        }
        .mini-value{
          margin-top:8px;
          font-size:20px;
          font-weight:900;
        }
        .chart-wrap{
          margin-top:14px;
          display:grid;
          gap:12px;
        }
        .bars{
          display:flex;
          align-items:end;
          gap:10px;
          min-height:220px;
          padding:12px;
          border:1px solid var(--border);
          border-radius:16px;
          background:#fffdfa;
        }
        .bar-col{
          flex:1;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:end;
          gap:8px;
          min-width:0;
        }
        .bar{
          width:100%;
          max-width:54px;
          border-radius:14px 14px 8px 8px;
          background: linear-gradient(180deg, #ff9a3d 0%, #ff7a00 100%);
          box-shadow: inset 0 -10px 18px rgba(255,255,255,0.15);
        }
        .bar-value{
          font-size:11px;
          color:var(--muted);
          text-align:center;
          line-height:1.2;
        }
        .bar-label{
          font-size:11px;
          font-weight:800;
          color:#111827;
        }
        .payment-box{
          margin-top:14px;
          display:grid;
          gap:12px;
        }
        .progress{
          width:100%;
          height:16px;
          border-radius:999px;
          background:#f3f4f6;
          overflow:hidden;
          border:1px solid var(--border);
        }
        .progress-inner{
          height:100%;
          background: linear-gradient(90deg, #ff9a3d 0%, #ff7a00 100%);
        }
        .legend{
          display:flex;
          justify-content:space-between;
          gap:12px;
          font-size:12px;
          color:var(--muted);
        }
      `}</style>

      <div className="premium-shell">
        <aside className="sidebar">
          <div className="brandbox">
            <div className="brandtitle">TerraPOS Admin</div>
            <div className="brandsub">
              Panel kontrol penjualan, operasional outlet, printer, dan konfigurasi struk.
            </div>
          </div>

          <div className="sidegroup">
            <button className="sidebtn" onClick={() => r.push("/pos")}>POS</button>
            <button className="sidebtn" onClick={() => r.push("/orders")}>Orders</button>
            <button className="sidebtn" onClick={() => r.push("/reports")}>Reports</button>
            <button className="sidebtn" onClick={() => r.push("/products")}>Products</button>
            <button className="sidebtn" onClick={() => r.push("/members")}>Members</button>
            <button className="sidebtn" onClick={() => r.push("/staff")}>Staff</button>
            <button className="sidebtn" onClick={() => r.push("/printer")}>Printer</button>
            <button className="sidebtn" onClick={() => r.push("/qr")}>QR Meja</button>
            <button className="sidebtn" onClick={() => r.push("/setup")}>Ganti Tenant</button>
            <button className="sidebtn" onClick={() => signOut(auth).then(() => r.push("/login"))}>
              Logout
            </button>
          </div>
        </aside>

        <main className="maincol">
          <section className="hero">
            <div className="hero-top">
              <div>
                <div className="hero-title">Dashboard Premium</div>
                <div className="hero-sub">
                  Tenant <b>{tenantId}</b> • User <b>{email || "-"}</b> • Role <b>{role || "-"}</b>
                </div>
              </div>

              <div className="hero-badges">
                <span className="badge">Print: {printMode === "rawbt" ? "RawBT" : "Browser"}</span>
                <span className="badge">OPEN: {openOrders.length}</span>
                <span className="badge">PAID: {paidOrders.length}</span>
              </div>
            </div>
          </section>

          {err && (
            <div className="panel">
              <div style={{ color: "var(--danger)", fontWeight: 900 }}>{err}</div>
            </div>
          )}

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Omzet Hari Ini</div>
              <div className="stat-value" style={{ color: "var(--brand)" }}>
                Rp {rupiah(stats.todayRevenue)}
              </div>
              <div className="stat-note">Transaksi hari ini: {stats.todayCount}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Omzet Bulan Ini</div>
              <div className="stat-value" style={{ color: "var(--brand)" }}>
                Rp {rupiah(stats.monthRevenue)}
              </div>
              <div className="stat-note">Transaksi bulan ini: {stats.monthCount}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Rata-rata Order</div>
              <div className="stat-value">Rp {rupiah(stats.avgOrder)}</div>
              <div className="stat-note">Nilai rata-rata transaksi bulan ini</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Order Belum Dibayar</div>
              <div className="stat-value">{openOrders.length}</div>
              <div className="stat-note">Total order OPEN / bayar nanti</div>
            </div>
          </section>

          <section className="content-grid">
            <div style={{ display: "grid", gap: 16 }}>
              <div className="panel">
                <div className="panel-title">Quick Actions</div>
                <div className="panel-sub">Shortcut untuk kerja admin yang lebih cepat.</div>

                <div className="quick-grid">
                  <button className="quickbtn" onClick={() => r.push("/orders")}>
                    <div className="quicktitle">Orders</div>
                    <div className="quickdesc">Pantau order OPEN dan PAID.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/products")}>
                    <div className="quicktitle">Products</div>
                    <div className="quickdesc">Kelola menu, harga, dan kategori.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/members")}>
                    <div className="quicktitle">Members</div>
                    <div className="quickdesc">Kelola pelanggan dan loyalty.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/staff")}>
                    <div className="quicktitle">Staff</div>
                    <div className="quickdesc">Kelola role dan user outlet.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/printer")}>
                    <div className="quicktitle">Printer</div>
                    <div className="quickdesc">Tes print dan mode RawBT.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/reports")}>
                    <div className="quicktitle">Reports</div>
                    <div className="quickdesc">Export Excel dan rekap penjualan.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/qr")}>
                    <div className="quicktitle">QR Meja</div>
                    <div className="quickdesc">Generate QR untuk meja resto.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/setup")}>
                    <div className="quicktitle">Ganti Tenant</div>
                    <div className="quickdesc">Pindah outlet / tenant aktif.</div>
                  </button>
                  <button className="quickbtn" onClick={() => r.push("/pos")}>
                    <div className="quicktitle">Buka POS</div>
                    <div className="quickdesc">Masuk ke mode kasir.</div>
                  </button>
                </div>
              </div>

              <div className="two-col">
                <div className="panel">
                  <div className="panel-title">Grafik Omzet 7 Hari</div>
                  <div className="panel-sub">Visual penjualan harian 7 hari terakhir.</div>

                  <div className="chart-wrap">
                    <div className="bars">
                      {dailyChart.map((d) => (
                        <div className="bar-col" key={d.label}>
                          <div className="bar-value">Rp {rupiah(d.revenue)}</div>
                          <div className="bar" style={{ height: `${d.pct}%` }} />
                          <div className="bar-label">{d.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-title">Distribusi Pembayaran</div>
                  <div className="panel-sub">Cash vs QRIS bulan ini.</div>

                  <div className="payment-box">
                    <div>
                      <div className="legend">
                        <span>Cash</span>
                        <b>{paymentChart.cashPct}%</b>
                      </div>
                      <div className="progress" style={{ marginTop: 6 }}>
                        <div className="progress-inner" style={{ width: `${paymentChart.cashPct}%` }} />
                      </div>
                      <div className="small" style={{ marginTop: 6 }}>Rp {rupiah(stats.cashRevenue)}</div>
                    </div>

                    <div>
                      <div className="legend">
                        <span>QRIS</span>
                        <b>{paymentChart.qrisPct}%</b>
                      </div>
                      <div className="progress" style={{ marginTop: 6 }}>
                        <div className="progress-inner" style={{ width: `${paymentChart.qrisPct}%` }} />
                      </div>
                      <div className="small" style={{ marginTop: 6 }}>Rp {rupiah(stats.qrisRevenue)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">Top Produk Bulan Ini</div>
                <div className="panel-sub">Produk terlaris berdasarkan omzet bulan berjalan.</div>

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
                      {stats.topProducts.map((t) => (
                        <tr key={t.name}>
                          <td style={{ fontWeight: 900 }}>{t.name}</td>
                          <td>{t.qty}</td>
                          <td style={{ fontWeight: 900, color: "var(--brand)" }}>
                            Rp {rupiah(t.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {stats.topProducts.length === 0 && (
                  <div className="small" style={{ marginTop: 12 }}>
                    Belum ada data penjualan bulan ini.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div className="panel">
                <div className="panel-title">Kustomisasi Struk & Refund</div>
                <div className="panel-sub">Ubah informasi toko, kasir default, dan PIN refund.</div>

                <div style={{ marginTop: 14 }}>
                  <div className="small">Nama Toko</div>
                  <input
                    className="input"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="small">Alamat</div>
                  <input
                    className="input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="small">Nama Kasir Default</div>
                  <input
                    className="input"
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="small">Footer Struk</div>
                  <input
                    className="input"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    disabled={!isOwner}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="small">PIN Refund</div>
                  <input
                    className="input"
                    type="password"
                    value={refundPin}
                    onChange={(e) => setRefundPin(e.target.value)}
                    disabled={!isOwner}
                    placeholder="Contoh: 123456"
                  />
                </div>

                {saveMsg && <div style={{ marginTop: 12, fontWeight: 900 }}>{saveMsg}</div>}

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 12 }}
                  onClick={saveReceiptSettings}
                  disabled={!isOwner || saving}
                >
                  {saving ? "Menyimpan..." : "Simpan Kustomisasi"}
                </button>

                {!isOwner && (
                  <div className="small" style={{ marginTop: 8 }}>
                    Hanya owner yang bisa mengubah pengaturan ini.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-title">Preview Struk</div>
                <div className="panel-sub">Preview cepat tampilan struk.</div>

                <div className="receipt-preview">
{`${storeName || "TerraPOS"}
${address || ""}
------------------------------
STRUK
Order : TRX-123456
Meja  : 3
Kasir : ${cashierName || "Kasir TerraPOS"}
------------------------------
Kopi Susu
1 x 10000            10000
Nasi Goreng
1 x 15000            15000
------------------------------
Subtotal             25000
Diskon                   0
TOTAL                25000
------------------------------
${footer || "Terima kasih."}`}
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">Ringkasan Outlet</div>
                <div className="panel-sub">Status singkat tenant aktif.</div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div className="mini-box">
                    <div className="mini-label">Tenant Aktif</div>
                    <div className="mini-value" style={{ fontSize: 16 }}>{tenantId}</div>
                  </div>

                  <div className="mini-box">
                    <div className="mini-label">User Aktif</div>
                    <div className="mini-value" style={{ fontSize: 16 }}>{email || "-"}</div>
                  </div>

                  <div className="mini-box">
                    <div className="mini-label">Mode Print</div>
                    <div className="mini-value">{printMode === "rawbt" ? "RawBT" : "Browser"}</div>
                  </div>

                  <div className="mini-box">
                    <div className="mini-label">PIN Refund</div>
                    <div className="mini-value">{refundPin ? "Aktif" : "Belum diatur"}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </TerraPage>
  );
}