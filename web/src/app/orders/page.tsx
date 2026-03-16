"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { receiptHTML } from "@/lib/receipt";
import { buildPlainReceipt, getPrintMode, sendToRawBT } from "@/lib/rawbt";

type Order = {
  id: string;
  orderNo: string;
  status: "OPEN" | "PAID" | "CANCELLED";
  mode?: "PAY_NOW" | "PAY_LATER";
  tableNo?: string | null;
  paymentMethod?: "CASH" | "QRIS" | null;
  paidAmount?: number | null;
  subtotal: number;
  discount: number;
  total: number;
  items: { name: string; qty: number; price: number; notes?: string }[];
  createdAt?: any;
  updatedAt?: any;
  paidAt?: any;
};

type RefundLog = {
  id: string;
  orderNo: string;
  tableNo?: string | null;
  total: number;
  paymentMethod?: string | null;
  refundedByEmail?: string;
  refundedAt?: any;
  items: { name: string; qty: number; price: number; notes?: string }[];
};

type ReceiptSettings = {
  storeName: string;
  address: string;
  footer: string;
  cashierName: string;
  refundPin: string;
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
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

function formatDateFull(d: Date | null) {
  if (!d) return "-";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeOnly(d: Date | null) {
  if (!d) return "-";
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function dayKey(d: Date | null) {
  if (!d) return "tanpa-tanggal";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function OrdersPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const isOwner = (role || "").toString().toLowerCase() === "owner";
  const canUse = ["owner", "admin"].includes((role || "").toString().toLowerCase());

  const [orders, setOrders] = useState<Order[]>([]);
  const [refundLogs, setRefundLogs] = useState<RefundLog[]>([]);
  const [tab, setTab] = useState<"OPEN" | "PAID" | "REFUND">("OPEN");
  const [err, setErr] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [paidAmount, setPaidAmount] = useState<number>(0);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundPinInput, setRefundPinInput] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    storeName: "TerraPOS",
    address: "",
    footer: "Terima kasih.",
    cashierName: "Kasir TerraPOS",
    refundPin: "123456",
  });

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d = snap.data() as any;
          setReceiptSettings({
            storeName: (d.storeName || "TerraPOS").toString(),
            address: (d.address || "").toString(),
            footer: (d.footer || "Terima kasih.").toString(),
            cashierName: (d.cashierName || "Kasir TerraPOS").toString(),
            refundPin: (d.refundPin || "123456").toString(),
          });
        }
      } catch {}
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/orders`);
    const qy = query(ref, orderBy("createdAt", "desc"));
    return onSnapshot(
      qy,
      (snap) => {
        const arr = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            orderNo: x.orderNo || d.id,
            status: x.status || "OPEN",
            mode: x.mode || "PAY_LATER",
            tableNo: x.tableNo ?? null,
            paymentMethod: x.paymentMethod ?? null,
            paidAmount: x.paidAmount ?? null,
            subtotal: Number(x.subtotal || 0),
            discount: Number(x.discount || 0),
            total: Number(x.total || 0),
            items: Array.isArray(x.items) ? x.items : [],
            createdAt: x.createdAt,
            updatedAt: x.updatedAt,
            paidAt: x.paidAt,
          } as Order;
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
        const arr = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            orderNo: x.orderNo || d.id,
            tableNo: x.tableNo ?? null,
            total: Number(x.total || 0),
            paymentMethod: x.paymentMethod ?? null,
            refundedByEmail: x.refundedByEmail || "",
            refundedAt: x.refundedAt,
            items: Array.isArray(x.items) ? x.items : [],
          } as RefundLog;
        });
        setRefundLogs(arr);
      },
      (e) => setErr(e.message)
    );
  }, [tenantId]);

  const list = useMemo(() => {
    if (tab === "REFUND") return [];
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        items: (Order & { displayDate: Date | null })[];
      }
    >();

    for (const o of list) {
      const displayDate =
        tab === "PAID"
          ? toDateSafe(o.paidAt) || toDateSafe(o.updatedAt) || toDateSafe(o.createdAt)
          : toDateSafe(o.createdAt) || toDateSafe(o.updatedAt);

      const key = dayKey(displayDate);
      const label = formatDateFull(displayDate);

      if (!map.has(key)) {
        map.set(key, { label, items: [] });
      }

      map.get(key)!.items.push({ ...o, displayDate });
    }

    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, value]) => ({
        key,
        label: value.label,
        items: value.items.sort((a, b) => {
          const da = a.displayDate ? a.displayDate.getTime() : 0;
          const db = b.displayDate ? b.displayDate.getTime() : 0;
          return db - da;
        }),
      }));
  }, [list, tab]);

  const refundGrouped = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        items: (RefundLog & { displayDate: Date | null })[];
      }
    >();

    for (const o of refundLogs) {
      const displayDate = toDateSafe(o.refundedAt);
      const key = dayKey(displayDate);
      const label = formatDateFull(displayDate);

      if (!map.has(key)) {
        map.set(key, { label, items: [] });
      }

      map.get(key)!.items.push({ ...o, displayDate });
    }

    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, value]) => ({
        key,
        label: value.label,
        items: value.items.sort((a, b) => {
          const da = a.displayDate ? a.displayDate.getTime() : 0;
          const db = b.displayDate ? b.displayDate.getTime() : 0;
          return db - da;
        }),
      }));
  }, [refundLogs]);

  function openPay(o: Order) {
    setPayOrder(o);
    setPaymentMethod("CASH");
    setPaidAmount(o.total);
    setPayOpen(true);
    setErr(null);
  }

  function openRefund(o: Order) {
    setRefundOrder(o);
    setRefundPinInput("");
    setRefundReason("");
    setRefundOpen(true);
    setErr(null);
  }

  function buildReceiptHtml(o: Order, payMethod: "CASH" | "QRIS", paid: number) {
    const dateText = new Date().toLocaleString("id-ID");
    return receiptHTML({
      title: "STRUK",
      storeName: receiptSettings.storeName || "TerraPOS",
      address: receiptSettings.address || "",
      footer: receiptSettings.footer || "Terima kasih.",
      orderNo: o.orderNo,
      dateText,
      tableNo: o.tableNo || null,
      cashierEmail: receiptSettings.cashierName || email || "",
      paymentMethod: payMethod,
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      paidAmount: payMethod === "CASH" ? paid : o.total,
      items: o.items.map((it) => ({ name: it.name, qty: it.qty, price: it.price, notes: it.notes || "" })),
    });
  }

  function buildReceiptText(o: Order, payMethod: "CASH" | "QRIS", paid: number) {
    return buildPlainReceipt({
      title: "STRUK",
      storeName: receiptSettings.storeName || "TerraPOS",
      address: receiptSettings.address || "",
      footer: receiptSettings.footer || "Terima kasih.",
      orderNo: o.orderNo,
      dateText: new Date().toLocaleString("id-ID"),
      tableNo: o.tableNo || null,
      cashierEmail: receiptSettings.cashierName || email || "",
      paymentMethod: payMethod,
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      paidAmount: payMethod === "CASH" ? paid : o.total,
      items: (o.items || []).map((it) => ({
        name: it.notes?.trim() ? `${it.name} (${it.notes})` : it.name,
        qty: it.qty,
        price: it.price,
      })),
    });
  }

  function printBySelectedMode(html: string, text: string) {
    const mode = getPrintMode();

    if (mode === "rawbt") {
      sendToRawBT(text);
      return;
    }

    const w = window.open("", "_blank", "width=420,height=800");
    if (!w) {
      alert("Pop-up print diblokir. Izinkan pop-up untuk localhost:3000.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async function payAndPrint() {
    try {
      if (!tenantId || !payOrder) return;

      if (paymentMethod === "CASH" && paidAmount < payOrder.total) {
        setErr("Uang dibayar kurang.");
        return;
      }

      await updateDoc(doc(db, `tenants/${tenantId}/orders/${payOrder.id}`), {
        status: "PAID",
        paymentMethod,
        paidAmount: paymentMethod === "CASH" ? paidAmount : payOrder.total,
        updatedAt: serverTimestamp(),
        paidAt: serverTimestamp(),
      });

      const html = buildReceiptHtml(payOrder, paymentMethod, paidAmount);
      const text = buildReceiptText(payOrder, paymentMethod, paidAmount);

      localStorage.setItem("terrapos_last_receipt_html", html);
      printBySelectedMode(html, text);

      setPayOpen(false);
      setPayOrder(null);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal bayar");
    }
  }

  async function confirmRefund() {
    try {
      if (!tenantId || !refundOrder) return;

      const savedPin = (receiptSettings.refundPin || "123456").trim();
      const inputPin = (refundPinInput || "").trim();

      if (!inputPin) {
        setErr("PIN refund wajib diisi.");
        return;
      }

      if (savedPin !== inputPin) {
        setErr("PIN refund salah.");
        return;
      }

      setRefundLoading(true);

      await addDoc(collection(db, `tenants/${tenantId}/refunds`), {
        orderId: refundOrder.id,
        orderNo: refundOrder.orderNo,
        statusBeforeRefund: refundOrder.status,
        mode: refundOrder.mode || null,
        tableNo: refundOrder.tableNo || null,
        paymentMethod: refundOrder.paymentMethod || null,
        paidAmount: refundOrder.paidAmount ?? null,
        subtotal: refundOrder.subtotal,
        discount: refundOrder.discount,
        total: refundOrder.total,
        items: refundOrder.items || [],
        originalCreatedAt: refundOrder.createdAt || null,
        originalPaidAt: refundOrder.paidAt || null,
        refundedAt: serverTimestamp(),
        refundedByEmail: email || "",
        refundedByRole: role || "",
        reason: (refundReason || "").trim(),
      });

      await deleteDoc(doc(db, `tenants/${tenantId}/orders/${refundOrder.id}`));

      setRefundOpen(false);
      setRefundOrder(null);
      setRefundPinInput("");
      setRefundReason("");
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal refund");
    } finally {
      setRefundLoading(false);
    }
  }

  function reprintOrder(o: Order) {
    const payMethod = (o.paymentMethod || "CASH") as "CASH" | "QRIS";
    const paid = Number(o.paidAmount || o.total);

    const html = buildReceiptHtml(o, payMethod, paid);
    const text = buildReceiptText(o, payMethod, paid);

    localStorage.setItem("terrapos_last_receipt_html", html);
    printBySelectedMode(html, text);
  }

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  if (!canUse) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman orders hanya untuk owner/admin.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/dashboard")}>
            Kembali
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={1100}>
      <style>{`
        .topnav{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .row2{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .pill{ border:1px solid var(--border); padding:6px 10px; border-radius:999px; font-weight:800; font-size:12px; background:#fff; }
        .day-group{ margin-top:14px; display:grid; gap:12px; }
        .day-header{
          position:sticky;
          top:8px;
          z-index:2;
          border:1px solid var(--border);
          background:#fff7f0;
          color:#111827;
          border-radius:14px;
          padding:12px 14px;
          font-weight:900;
        }
        .order-card{
          border:1px solid var(--border);
          border-radius:18px;
          padding:16px;
          background:#fff;
        }
        .meta{
          display:grid;
          gap:4px;
          margin-top:6px;
        }
        .items-full{
          margin-top:12px;
          display:grid;
          gap:8px;
        }
        .item-row{
          display:flex;
          justify-content:space-between;
          gap:12px;
          font-size:13px;
          padding:8px 10px;
          border:1px solid var(--border);
          border-radius:12px;
          background:#fffaf5;
        }
        .item-left{
          display:grid;
          gap:3px;
        }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Orders</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">
              User: {email || "-"} | Role: <b>{role || "-"}</b>
            </div>
          </div>

          <div className="spacer" />

          <div className="topnav">
            <button className="btn" onClick={() => r.push("/pos")}>POS</button>
            <button className="btn" onClick={() => r.push("/printer")}>Printer</button>
            {isOwner && (
              <button className="btn btn-primary" onClick={() => r.push("/dashboard")}>
                Dashboard
              </button>
            )}
            <button className="btn" onClick={() => r.push("/setup")}>Ganti Tenant</button>
            <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>
              Logout
            </button>
          </div>
        </div>

        <div className="row2" style={{ marginTop: 12 }}>
          <button className={"btn " + (tab === "OPEN" ? "btn-primary" : "")} onClick={() => setTab("OPEN")}>
            OPEN
          </button>
          <button className={"btn " + (tab === "PAID" ? "btn-primary" : "")} onClick={() => setTab("PAID")}>
            PAID
          </button>
          <button className={"btn " + (tab === "REFUND" ? "btn-primary" : "")} onClick={() => setTab("REFUND")}>
            REFUND LOG
          </button>
          {err && <span style={{ color: "var(--danger)", fontWeight: 900 }}>{err}</span>}
        </div>
      </div>

      {tab !== "REFUND" ? (
        grouped.length === 0 ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="small">Tidak ada data.</div>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.key} className="day-group">
              <div className="day-header">{group.label}</div>

              {group.items.map((o) => {
                const shownDate =
                  tab === "PAID"
                    ? toDateSafe(o.paidAt) || toDateSafe(o.updatedAt) || toDateSafe(o.createdAt)
                    : toDateSafe(o.createdAt) || toDateSafe(o.updatedAt);

                return (
                  <div key={o.id} className="order-card">
                    <div className="row">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 17 }}>{o.orderNo}</div>

                        <div className="meta">
                          <div className="small">
                            Status: <b>{o.status}</b> • Mode: <b>{o.mode || "-"}</b> • Meja: <b>{o.tableNo || "-"}</b>
                          </div>

                          <div className="small">
                            Tanggal: <b>{formatDateTime(shownDate)}</b>
                          </div>

                          {tab === "PAID" && (
                            <div className="small">
                              Metode: <b>{o.paymentMethod || "-"}</b>
                            </div>
                          )}

                          <div className="small">
                            Jam: <b>{formatTimeOnly(shownDate)}</b>
                          </div>
                        </div>

                        <div className="items-full">
                          {(o.items || []).map((it, idx) => (
                            <div className="item-row" key={idx}>
                              <div className="item-left">
                                <div style={{ fontWeight: 800 }}>
                                  {it.name} x{it.qty}
                                </div>
                                {(it.notes || "").trim() ? (
                                  <div className="small">Catatan: {it.notes}</div>
                                ) : null}
                              </div>

                              <div style={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                                Rp {rupiah((it.price || 0) * (it.qty || 0))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", minWidth: 160 }}>
                        <div className="pill">Rp {rupiah(o.total)}</div>

                        {o.status === "OPEN" ? (
                          <button
                            className="btn btn-primary"
                            style={{ marginTop: 10, width: "100%" }}
                            onClick={() => openPay(o)}
                          >
                            Bayar & Print
                          </button>
                        ) : (
                          <>
                            <button
                              className="btn"
                              style={{ marginTop: 10, width: "100%" }}
                              onClick={() => reprintOrder(o)}
                            >
                              Cetak Ulang
                            </button>

                            <button
                              className="btn btn-danger"
                              style={{ marginTop: 10, width: "100%" }}
                              onClick={() => openRefund(o)}
                            >
                              Refund
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )
      ) : refundGrouped.length === 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="small">Belum ada log refund.</div>
        </div>
      ) : (
        refundGrouped.map((group) => (
          <div key={group.key} className="day-group">
            <div className="day-header">{group.label}</div>

            {group.items.map((o) => (
              <div key={o.id} className="order-card">
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 17 }}>{o.orderNo}</div>

                    <div className="meta">
                      <div className="small">
                        Waktu Refund: <b>{formatDateTime(toDateSafe(o.refundedAt))}</b>
                      </div>
                      <div className="small">
                        Meja: <b>{o.tableNo || "-"}</b> • Metode: <b>{o.paymentMethod || "-"}</b>
                      </div>
                      <div className="small">
                        Direfund oleh: <b>{o.refundedByEmail || "-"}</b>
                      </div>
                    </div>

                    <div className="items-full">
                      {(o.items || []).map((it, idx) => (
                        <div className="item-row" key={idx}>
                          <div className="item-left">
                            <div style={{ fontWeight: 800 }}>
                              {it.name} x{it.qty}
                            </div>
                            {(it.notes || "").trim() ? (
                              <div className="small">Catatan: {it.notes}</div>
                            ) : null}
                          </div>

                          <div style={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                            Rp {rupiah((it.price || 0) * (it.qty || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", minWidth: 160 }}>
                    <div className="pill">Rp {rupiah(o.total)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {payOpen && payOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: 520, maxWidth: "100%" }}>
            <div className="row">
              <div className="h1">Bayar Order</div>
              <div className="spacer" />
              <button className="btn" onClick={() => setPayOpen(false)}>Tutup</button>
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              Order: <b>{payOrder.orderNo}</b> • Meja: <b>{payOrder.tableNo || "-"}</b>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className={"btn " + (paymentMethod === "CASH" ? "btn-primary" : "")} onClick={() => setPaymentMethod("CASH")}>
                CASH
              </button>
              <button className={"btn " + (paymentMethod === "QRIS" ? "btn-primary" : "")} onClick={() => setPaymentMethod("QRIS")}>
                QRIS
              </button>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
              <span className="small">Total</span>
              <b>Rp {rupiah(payOrder.total)}</b>
            </div>

            {paymentMethod === "CASH" && (
              <>
                <div style={{ marginTop: 10 }}>
                  <div className="small">Uang dibayar</div>
                  <input
                    className="input"
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value || 0))}
                  />
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                  <span className="small">Kembalian</span>
                  <b>Rp {rupiah(Math.max(0, paidAmount - payOrder.total))}</b>
                </div>
              </>
            )}

            {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

            <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={payAndPrint}>
              Bayar & Print Struk
            </button>
          </div>
        </div>
      )}

      {refundOpen && refundOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div className="card" style={{ width: 520, maxWidth: "100%" }}>
            <div className="row">
              <div className="h1">Refund Order</div>
              <div className="spacer" />
              <button
                className="btn"
                onClick={() => {
                  setRefundOpen(false);
                  setRefundOrder(null);
                  setRefundPinInput("");
                  setRefundReason("");
                }}
              >
                Tutup
              </button>
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              Order: <b>{refundOrder.orderNo}</b> • Total: <b>Rp {rupiah(refundOrder.total)}</b>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="small">Masukkan PIN Refund</div>
              <input
                className="input"
                type="password"
                value={refundPinInput}
                onChange={(e) => setRefundPinInput(e.target.value)}
                placeholder="PIN refund"
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="small">Alasan Refund (opsional)</div>
              <textarea
                className="input"
                style={{ minHeight: 80 }}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Contoh: salah input, dibatalkan customer"
              />
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              Jika refund berhasil, order dihapus dari penjualan utama tetapi tetap masuk ke <b>refund log</b>.
            </div>

            {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

            <button
              className="btn btn-danger"
              style={{ width: "100%", marginTop: 12 }}
              onClick={confirmRefund}
              disabled={refundLoading}
            >
              {refundLoading ? "Memproses Refund..." : "Konfirmasi Refund"}
            </button>
          </div>
        </div>
      )}
    </TerraPage>
  );
}