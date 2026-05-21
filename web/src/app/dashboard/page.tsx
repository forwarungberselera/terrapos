"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { useLevel } from "@/hooks/useLevel";
import { auth, db, functions } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { isShiftPermissionError, normalizeShift, ShiftRecord } from "@/lib/shifts";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

type OrderItem = {
  name: string;
  price: number;
  qty: number;
  category?: string;
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

type TopPeriodFilter = "today" | "7d" | "month";

export default function DashboardPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();
  const { canAccess } = useLevel();

  const roleLower = (role || "").toString().toLowerCase();
  const isOwner = roleLower === "owner" || roleLower === "developer";
  const canView = roleLower === "owner" || roleLower === "admin" || roleLower === "developer";

  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<{ id: string; total: number; refundedAt?: any }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [shiftAccessBlocked, setShiftAccessBlocked] = useState(false);

  const [storeName, setStoreName] = useState("TerraPOS");
  const [address, setAddress] = useState("");
  const [footer, setFooter] = useState("Terima kasih.");
  const [cashierName, setCashierName] = useState("Kasir TerraPOS");
  const [saving, setSaving] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [refundPinInput, setRefundPinInput] = useState("");
  const [confirmRefundPinInput, setConfirmRefundPinInput] = useState("");
  const [topPeriodFilter, setTopPeriodFilter] = useState<TopPeriodFilter>("month");
  const [topCategoryFilter, setTopCategoryFilter] = useState("Semua");

  const [printMode, setPrintMode] = useState<"browser" | "rawbt" | "bluetooth">("browser");

  const [sideOpen, setSideOpen] = useState<Record<string, boolean>>({
    operasional: true,
    management: true,
    laporan: false,
    settings: false,
  });

  function toggleSide(key: string) {
    setSideOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("terrapos_print_mode");
      if (mode === "rawbt") setPrintMode("rawbt");
      else if (mode === "bluetooth") setPrintMode("bluetooth");
      else setPrintMode("browser");
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const ref = collection(db, `tenants/${tenantId}/orders`);
    const qy = query(ref, orderBy("createdAt", "desc"), limit(500));

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

    const refundsRef = collection(db, `tenants/${tenantId}/refunds`);
    const refundsQuery = query(refundsRef, orderBy("refundedAt", "desc"), limit(200));

    return onSnapshot(
      refundsQuery,
      (snap) => {
        const arr = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            total: Number(data.total || 0),
            refundedAt: data.refundedAt,
          };
        });
        setRefunds(arr);
      },
      (e) => {
        // Silently ignore permission errors for refunds (staff may not have access)
        if (e.code !== "permission-denied") {
          console.warn("Refunds subscribe error:", e.message);
        }
      }
    );
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const qy = query(collection(db, `tenants/${tenantId}/shifts`), orderBy("openedAt", "desc"), limit(20));
    return onSnapshot(
      qy,
      (snap) => {
        setShiftAccessBlocked(false);
        const items = snap.docs.map((item) => normalizeShift(item.id, item.data()));
        setActiveShift(items.find((item) => item.status === "OPEN") || null);
      },
      (e) => {
        if (isShiftPermissionError(e)) {
          setShiftAccessBlocked(true);
          setActiveShift(null);
          return;
        }
        setErr(e.message);
      }
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

      }
    }

    const avgOrder = monthCount ? Math.round(monthRevenue / monthCount) : 0;

    return {
      todayRevenue,
      todayCount,
      monthRevenue,
      monthCount,
      avgOrder,
      cashRevenue,
      qrisRevenue,
    };
  }, [paidOrders]);

  const refundStats = useMemo(() => {
    const now = new Date();
    const sod = startOfDay(now);
    const som = startOfMonth(now);

    let refundToday = 0;
    let refundMonth = 0;

    for (const ref of refunds) {
      const d: Date | null = ref.refundedAt?.toDate?.() ?? null;
      if (!d) continue;

      if (d >= sod) {
        refundToday += ref.total;
      }
      if (d >= som) {
        refundMonth += ref.total;
      }
    }

    return {
      refundToday,
      refundMonth,
      netRevenueToday: stats.todayRevenue - refundToday,
      netRevenueMonth: stats.monthRevenue - refundMonth,
    };
  }, [refunds, stats.todayRevenue, stats.monthRevenue]);

  const topSellingStats = useMemo(() => {
    const now = new Date();
    const rangeStart =
      topPeriodFilter === "today"
        ? startOfDay(now)
        : topPeriodFilter === "7d"
          ? startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
          : startOfMonth(now);

    const topMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>();

    for (const o of paidOrders) {
      const d: Date | null = o.paidAt?.toDate?.() ?? o.createdAt?.toDate?.() ?? null;
      if (!d || d < rangeStart) continue;

      for (const it of o.items || []) {
        const key = (it.name || "Unknown").toString();
        const category = (it.category || "Lainnya").toString();
        const qty = Number(it.qty || 0);
        const revenue = Number(it.price || 0) * qty;
        const prev = topMap.get(key) || { name: key, category, qty: 0, revenue: 0 };

        topMap.set(key, {
          name: key,
          category: prev.category || category,
          qty: prev.qty + qty,
          revenue: prev.revenue + revenue,
        });
      }
    }

    const topProducts = Array.from(topMap.values()).sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      return b.revenue - a.revenue;
    });

    return {
      label:
        topPeriodFilter === "today"
          ? "hari ini"
          : topPeriodFilter === "7d"
            ? "7 hari terakhir"
            : "bulan ini",
      topProducts,
    };
  }, [paidOrders, topPeriodFilter]);

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

  const topProductCategories = useMemo(() => {
    return [
      "Semua",
      ...Array.from(
        new Set(topSellingStats.topProducts.map((product) => (product.category || "Lainnya").toString()))
      ).sort((a, b) => a.localeCompare(b, "id-ID")),
    ];
  }, [topSellingStats.topProducts]);

  const filteredTopProducts = useMemo(() => {
    const filtered =
      topCategoryFilter === "Semua"
        ? topSellingStats.topProducts
        : topSellingStats.topProducts.filter((product) => product.category === topCategoryFilter);

    return filtered.slice(0, 12);
  }, [topSellingStats.topProducts, topCategoryFilter]);

  const topProductsByCategory = useMemo(() => {
    return topProductCategories
      .filter((category) => category !== "Semua")
      .map((category) => {
        const leader = topSellingStats.topProducts.find((product) => product.category === category);
        return {
          category,
          leader,
        };
      })
      .filter((entry) => entry.leader);
  }, [topSellingStats.topProducts, topProductCategories]);

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
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaveMsg("Tersimpan. Perubahan dipakai untuk struk berikutnya.");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e: any) {
      setSaveMsg("Gagal simpan: " + (e?.message || "unknown"));
    } finally {
      setSaving(false);
    }
  }

  async function saveRefundPin() {
    if (!tenantId) return;

    const nextPin = refundPinInput.trim();
    const confirmPin = confirmRefundPinInput.trim();

    if (!nextPin) {
      setSaveMsg("PIN refund baru wajib diisi.");
      return;
    }

    if (nextPin.length < 6) {
      setSaveMsg("PIN refund minimal 6 digit.");
      return;
    }

    if (nextPin !== confirmPin) {
      setSaveMsg("Konfirmasi PIN refund tidak cocok.");
      return;
    }

    setSavingPin(true);
    setSaveMsg("");

    try {
      const updateRefundPinFn = httpsCallable<
        { tenantId: string; refundPin: string },
        { ok: boolean }
      >(functions, "updateRefundPin");

      await updateRefundPinFn({
        tenantId,
        refundPin: nextPin,
      });

      setRefundPinInput("");
      setConfirmRefundPinInput("");
      setSaveMsg("PIN refund berhasil diperbarui secara aman di server.");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e: any) {
      setSaveMsg("Gagal simpan PIN refund: " + (e?.message || "unknown"));
    } finally {
      setSavingPin(false);
    }
  }

  if (loading || loadingRole) {
    return (
      <TerraPage maxWidth={1440}>
        <SkeletonStyles />
        <PageSkeleton cards={4} />
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
          grid-template-columns: 240px 1fr;
          gap:16px;
        }
        @media (max-width: 1100px){
          .premium-shell{
            grid-template-columns: 1fr;
          }
        }
        .sidebar{
          border:1px solid var(--border);
          border-radius: var(--radius-lg);
          background:var(--panel);
          padding:16px;
          position: sticky;
          top: 16px;
          box-shadow: var(--shadow-card);
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .sidebar::-webkit-scrollbar{ width:4px; }
        .sidebar::-webkit-scrollbar-track{ background:transparent; }
        .sidebar::-webkit-scrollbar-thumb{ background:var(--border); border-radius:999px; }
        .sidebar::-webkit-scrollbar-thumb:hover{ background:var(--muted); }
        @media (max-width: 1100px){
          .sidebar{
            position:static;
            max-height:none;
            overflow:visible;
          }
          .sidebar .brandbox{ margin-bottom:8px; }
          .sidebar .sidegroup{ display:grid; gap:8px; }
          .sidebar .sidebtn{ width:100%; }
        }
        .brandbox{
          padding:14px;
          border-radius: var(--radius);
          background: var(--brandSoft);
          border:1px solid var(--brand2);
        }
        .brandtitle{
          font-size:18px;
          font-weight:900;
          color:var(--text);
        }
        .brandsub{
          margin-top:6px;
          font-size:11px;
          color:var(--muted);
        }
        .sidegroup{
          margin-top:14px;
          display:grid;
          gap:8px;
        }
        .sidebtn{
          width:100%;
          text-align:left;
          border:1px solid var(--border);
          background:var(--panel);
          color:var(--text);
          padding:11px 14px;
          border-radius: var(--radius-sm);
          cursor:pointer;
          font-weight:700;
          font-size:13px;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          touch-action:manipulation;
        }
        .sidebtn:hover{
          background:var(--brandSoft);
          border-color:var(--brand2);
        }
        .sidebtn:active{ transform:scale(0.97); }
        .sidelabel{
          font-size:10px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:0.5px;
          color:var(--muted);
          padding:10px 0 4px;
          border-top:1px solid var(--border);
          margin-top:6px;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:space-between;
          user-select:none;
          transition: color 0.15s ease;
        }
        .sidelabel:first-of-type{
          border-top:none;
          margin-top:0;
        }
        .sidelabel:hover{ color:var(--text); }
        .sidelabel .chevron{
          font-size:12px;
          transition: transform 0.2s ease;
          color:var(--muted);
        }
        .sidelabel .chevron.closed{
          transform: rotate(-90deg);
        }
        .sidecategory{
          display:grid;
          gap:6px;
          overflow:hidden;
          transition: grid-template-rows 0.25s ease, opacity 0.2s ease;
          grid-template-rows: 1fr;
          opacity:1;
        }
        .sidecategory.collapsed{
          grid-template-rows: 0fr;
          opacity:0;
        }
        .sidecategory-inner{
          min-height:0;
          overflow:hidden;
          display:grid;
          gap:6px;
        }
        .maincol{
          display:grid;
          gap:14px;
        }
        .hero{
          border:1px solid var(--border);
          border-radius: var(--radius-lg);
          background:var(--panel);
          padding:20px;
          box-shadow: var(--shadow-card);
        }
        .hero-top{
          display:flex;
          justify-content:space-between;
          gap:14px;
          align-items:flex-start;
          flex-wrap:wrap;
        }
        .hero-title{
          font-size:24px;
          font-weight:900;
          line-height:1.1;
          color:var(--text);
        }
        @media (max-width: 640px){ .hero-title{ font-size:20px; } }
        .hero-sub{
          margin-top:6px;
          color:var(--muted);
          font-size:12px;
        }
        .hero-badges{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }
        .hero-badges .badge{
          padding:7px 10px;
          border-radius:999px;
          border:1px solid var(--border);
          background:var(--panel);
          font-size:11px;
          font-weight:800;
          color:var(--text);
        }
        .stats-grid{
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap:12px;
        }
        @media (max-width: 1080px){
          .stats-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px){
          .stats-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; }
        }
        @media (max-width: 380px){
          .stats-grid{ grid-template-columns: 1fr; }
        }
        .stat-card{
          border:1px solid var(--border);
          border-radius: var(--radius);
          padding:16px;
          background:var(--panel);
          box-shadow: var(--shadow-card);
          transition: box-shadow 0.2s ease;
        }
        .stat-card:hover{ box-shadow: var(--shadow); }
        .stat-label{
          font-size:11px;
          color:var(--muted);
          font-weight:700;
          text-transform:uppercase;
          letter-spacing:0.3px;
        }
        .stat-value{
          margin-top:8px;
          font-size:24px;
          font-weight:900;
          line-height:1.1;
          color:var(--text);
          font-family:var(--font-mono);
        }
        @media (max-width: 640px){ .stat-value{ font-size:18px; } }
        .stat-note{
          margin-top:6px;
          font-size:11px;
          color:var(--muted);
        }
        .content-grid{
          display:grid;
          grid-template-columns: 1.15fr .85fr;
          gap:14px;
        }
        @media (max-width: 1180px){
          .content-grid{ grid-template-columns: 1fr; }
        }
        .panel{
          border:1px solid var(--border);
          border-radius: var(--radius-lg);
          background:var(--panel);
          padding:18px;
          box-shadow: var(--shadow-card);
        }
        @media (max-width: 640px){ .panel{ padding:14px; border-radius:var(--radius); } }
        .panel-title{
          font-size:16px;
          font-weight:900;
          color:var(--text);
        }
        .panel-sub{
          margin-top:4px;
          font-size:11px;
          color:var(--muted);
        }
        .quick-grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap:10px;
          margin-top:12px;
        }
        @media (max-width: 980px){ .quick-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px){ .quick-grid{ grid-template-columns: 1fr; gap:8px; } }
        .quickbtn{
          text-align:left;
          padding:12px;
          border-radius: var(--radius);
          border:1px solid var(--border);
          background:var(--panel);
          cursor:pointer;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          touch-action:manipulation;
        }
        .quickbtn:hover{ background:var(--brandSoft); border-color:var(--brand2); }
        .quickbtn:active{ transform:scale(0.97); }
        .quicktitle{ font-weight:800; font-size:14px; color:var(--text); }
        .quickdesc{ margin-top:4px; font-size:11px; color:var(--muted); line-height:1.4; }
        .two-col{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:14px;
        }
        @media (max-width: 780px){ .two-col{ grid-template-columns: 1fr; } }
        table{ width:100%; border-collapse:collapse; }
        th, td{ padding:10px 8px; border-bottom:1px solid var(--border); text-align:left; font-size:13px; }
        th{ font-size:11px; color:var(--muted); font-weight:800; text-transform:uppercase; }
        td{ color:var(--text); }
        .receipt-preview{
          margin-top:12px;
          border:1px dashed var(--border);
          border-radius: var(--radius);
          padding:12px;
          background:var(--input-bg);
          font-family: var(--font-mono);
          white-space: pre-wrap;
          line-height:1.5;
          font-size:12px;
          color:var(--text);
        }
        .mini-stack{ display:grid; gap:10px; }
        .mini-box{
          border:1px solid var(--border);
          border-radius: var(--radius);
          padding:12px;
          background:var(--panel);
        }
        .mini-label{ font-size:11px; color:var(--muted); font-weight:700; }
        .mini-value{ margin-top:6px; font-size:18px; font-weight:900; color:var(--text); }
        .chart-wrap{ margin-top:12px; display:grid; gap:10px; }
        .bars{
          display:flex;
          align-items:end;
          gap:8px;
          min-height:180px;
          padding:12px;
          border:1px solid var(--border);
          border-radius: var(--radius);
          background:var(--input-bg);
        }
        @media (max-width: 640px){ .bars{ min-height:140px; gap:6px; padding:8px; } }
        .bar-col{
          flex:1;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:end;
          gap:6px;
          min-width:0;
        }
        .bar{
          width:100%;
          max-width:48px;
          border-radius:10px 10px 6px 6px;
          background: linear-gradient(180deg, var(--brand2) 0%, var(--brand) 100%);
        }
        .bar-value{ font-size:10px; color:var(--muted); text-align:center; line-height:1.2; font-family:var(--font-mono); }
        .bar-label{ font-size:10px; font-weight:800; color:var(--text); }
        .payment-box{ margin-top:12px; display:grid; gap:10px; }
        .progress{
          width:100%;
          height:12px;
          border-radius:999px;
          background:var(--input-bg);
          overflow:hidden;
          border:1px solid var(--border);
        }
        .progress-inner{
          height:100%;
          background: linear-gradient(90deg, var(--brand2) 0%, var(--brand) 100%);
          border-radius:999px;
          transition: width 0.4s ease;
        }
        .legend{ display:flex; justify-content:space-between; gap:10px; font-size:12px; color:var(--muted); }
        .filter-row{
          margin-top:12px;
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }
        @media (max-width: 640px){
          .filter-row{ overflow-x:auto; flex-wrap:nowrap; padding-bottom:4px; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
          .filter-row::-webkit-scrollbar{ display:none; }
        }
        .filter-stack{ margin-top:12px; display:grid; gap:8px; }
        .category-chip{
          border:1px solid var(--border);
          background:var(--panel);
          color:var(--text);
          border-radius:999px;
          padding:7px 12px;
          font-size:12px;
          font-weight:700;
          cursor:pointer;
          flex-shrink:0;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .category-chip:hover{ background:var(--brandSoft); }
        .category-chip.active{
          background:var(--brand);
          color:#fff;
          border-color:var(--brand);
        }
        .category-leaders{
          margin-top:12px;
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap:10px;
        }
        @media (max-width: 780px){ .category-leaders{ grid-template-columns: 1fr; } }
        .leader-card{
          border:1px solid var(--border);
          border-radius: var(--radius);
          padding:12px;
          background:var(--brandSoft);
        }
        .leader-category{ font-size:11px; color:var(--muted); font-weight:800; }
        .leader-name{ margin-top:6px; font-size:14px; font-weight:900; color:var(--text); }
        .leader-meta{ margin-top:4px; font-size:11px; color:var(--muted); }
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
            <button className="sidebtn" onClick={() => r.push("/pos")}>Buka POS</button>

            <div className="sidelabel" onClick={() => toggleSide("operasional")}>
              <span>Operasional</span>
              <span className={`chevron ${!sideOpen.operasional ? "closed" : ""}`}>&#9662;</span>
            </div>
            <div className={`sidecategory ${!sideOpen.operasional ? "collapsed" : ""}`}>
              <div className="sidecategory-inner">
                <button className="sidebtn" onClick={() => r.push("/orders")}>Orders</button>
                <button className="sidebtn" onClick={() => r.push("/shifts")}>Shift</button>
                {canAccess("qr") && <button className="sidebtn" onClick={() => r.push("/qr")}>QR Meja</button>}
              </div>
            </div>

            <div className="sidelabel" onClick={() => toggleSide("management")}>
              <span>Management</span>
              <span className={`chevron ${!sideOpen.management ? "closed" : ""}`}>&#9662;</span>
            </div>
            <div className={`sidecategory ${!sideOpen.management ? "collapsed" : ""}`}>
              <div className="sidecategory-inner">
                <button className="sidebtn" onClick={() => r.push("/products")}>Products</button>
                {canAccess("staff") && <button className="sidebtn" onClick={() => r.push("/staff")}>Staff</button>}
                {canAccess("promos") && <button className="sidebtn" onClick={() => r.push("/promos")}>Promo</button>}
                {canAccess("members") && <button className="sidebtn" onClick={() => r.push("/members")}>Members</button>}
              </div>
            </div>

            <div className="sidelabel" onClick={() => toggleSide("laporan")}>
              <span>Laporan</span>
              <span className={`chevron ${!sideOpen.laporan ? "closed" : ""}`}>&#9662;</span>
            </div>
            <div className={`sidecategory ${!sideOpen.laporan ? "collapsed" : ""}`}>
              <div className="sidecategory-inner">
                <button className="sidebtn" onClick={() => r.push("/reports")}>Reports</button>
                {canAccess("audit") && <button className="sidebtn" onClick={() => r.push("/audit")}>Audit Log</button>}
              </div>
            </div>

            <div className="sidelabel" onClick={() => toggleSide("settings")}>
              <span>Settings</span>
              <span className={`chevron ${!sideOpen.settings ? "closed" : ""}`}>&#9662;</span>
            </div>
            <div className={`sidecategory ${!sideOpen.settings ? "collapsed" : ""}`}>
              <div className="sidecategory-inner">
                <button className="sidebtn" onClick={() => r.push("/settings/receipt")}>Pengaturan Struk</button>
                <button className="sidebtn" onClick={() => r.push("/printer")}>Printer</button>
                <button className="sidebtn" onClick={() => r.push("/refund-pin")}>PIN Refund</button>
                <button className="sidebtn" onClick={() => r.push("/setup")}>Ganti Tenant</button>
                <button className="sidebtn" onClick={() => signOut(auth).then(() => r.push("/login"))}>
                  Logout
                </button>
              </div>
            </div>
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
                <span className="badge">Print: {printMode === "bluetooth" ? "Bluetooth" : printMode === "rawbt" ? "RawBT" : "Browser"}</span>
                <span className="badge">OPEN: {openOrders.length}</span>
                <span className="badge">PAID: {paidOrders.length}</span>
                <span className="badge">Shift: {shiftAccessBlocked ? "Belum Aktif" : activeShift ? "OPEN" : "Belum Buka"}</span>
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
              <div className="stat-label">Net Revenue Hari Ini</div>
              <div className="stat-value" style={{ color: refundStats.netRevenueToday >= 0 ? "var(--brand)" : "var(--danger)" }}>
                Rp {rupiah(refundStats.netRevenueToday)}
              </div>
              <div className="stat-note">Omzet − Refund hari ini</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Net Revenue Bulan Ini</div>
              <div className="stat-value" style={{ color: refundStats.netRevenueMonth >= 0 ? "var(--brand)" : "var(--danger)" }}>
                Rp {rupiah(refundStats.netRevenueMonth)}
              </div>
              <div className="stat-note">Omzet − Refund bulan ini</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Refund Hari Ini</div>
              <div className="stat-value" style={{ color: "var(--danger)" }}>
                Rp {rupiah(refundStats.refundToday)}
              </div>
              <div className="stat-note">Total refund hari ini</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Refund Bulan Ini</div>
              <div className="stat-value" style={{ color: "var(--danger)" }}>
                Rp {rupiah(refundStats.refundMonth)}
              </div>
              <div className="stat-note">Total refund bulan berjalan</div>
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
                <div className="panel-title">Produk Paling Laris Bulan Ini</div>
                <div className="panel-sub">Lihat produk terlaris berdasarkan qty terjual, lalu saring sesuai periode dan kategori.</div>

                <div className="filter-stack">
                  <div className="filter-row">
                    <button
                      className={`category-chip${topPeriodFilter === "today" ? " active" : ""}`}
                      onClick={() => setTopPeriodFilter("today")}
                    >
                      Hari Ini
                    </button>
                    <button
                      className={`category-chip${topPeriodFilter === "7d" ? " active" : ""}`}
                      onClick={() => setTopPeriodFilter("7d")}
                    >
                      7 Hari
                    </button>
                    <button
                      className={`category-chip${topPeriodFilter === "month" ? " active" : ""}`}
                      onClick={() => setTopPeriodFilter("month")}
                    >
                      Bulan Ini
                    </button>
                  </div>

                  <div className="small">
                    Menampilkan data produk paling laris untuk <b>{topSellingStats.label}</b>.
                  </div>

                  <div className="filter-row">
                    {topProductCategories.map((category) => (
                      <button
                        key={category}
                        className={`category-chip${topCategoryFilter === category ? " active" : ""}`}
                        onClick={() => setTopCategoryFilter(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {topProductsByCategory.length > 0 && (
                  <div className="category-leaders">
                    {topProductsByCategory.map(({ category, leader }) => (
                      <div key={category} className="leader-card">
                        <div className="leader-category">Kategori {category}</div>
                        <div className="leader-name">{leader?.name}</div>
                        <div className="leader-meta">
                          Terjual {leader?.qty} item • Omzet Rp {rupiah(leader?.revenue || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 10, overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Produk</th>
                        <th>Kategori</th>
                        <th>Qty</th>
                        <th>Omzet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTopProducts.map((t, index) => (
                        <tr key={t.name}>
                          <td style={{ fontWeight: 900 }}>{index + 1}</td>
                          <td style={{ fontWeight: 900 }}>{t.name}</td>
                          <td>{t.category}</td>
                          <td>{t.qty}</td>
                          <td style={{ fontWeight: 900, color: "var(--brand)" }}>
                            Rp {rupiah(t.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredTopProducts.length === 0 && (
                  <div className="small" style={{ marginTop: 12 }}>
                    Belum ada data penjualan untuk kategori ini di bulan berjalan.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div className="panel">
                <div className="panel-title">Kustomisasi Struk & Refund</div>
                <div className="panel-sub">Ubah informasi toko, kasir default, dan kelola PIN refund secara server-side.</div>

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
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </TerraPage>
  );
}
