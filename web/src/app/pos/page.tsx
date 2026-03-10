"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { receiptHTML } from "@/lib/receipt";
import { buildPlainReceipt, getPrintMode, sendToRawBT } from "@/lib/rawbt";

type Product = { id: string; name: string; category: string; price: number; isActive?: boolean };
type CartItem = { id: string; name: string; category: string; price: number; qty: number };
type ReceiptSettings = { storeName: string; address: string; footer: string; cashierName: string };
type OrderStatus = "OPEN" | "PAID" | "CANCELLED";
type OrderMode = "PAY_NOW" | "PAY_LATER";

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function POSPage() {
  const r = useRouter();
  const sp = useSearchParams();

  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const isOwner = (role || "").toString().toLowerCase() === "owner";

  const [mode, setMode] = useState<OrderMode>("PAY_NOW");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Semua");
  const [tableNo, setTableNo] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    storeName: "TerraPOS",
    address: "",
    footer: "Terima kasih.",
    cashierName: "Kasir TerraPOS",
  });

  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = sp.get("table");
    if (t) setTableNo(t);
  }, [sp]);

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
          });
        }
      } catch {}
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/products`);
    const qy = query(ref, orderBy("category", "asc"), orderBy("name", "asc"));
    return onSnapshot(
      qy,
      (snap) => {
        const arr: Product[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || "",
            category: data.category || "Lainnya",
            price: Number(data.price || 0),
            isActive: data.isActive ?? true,
          };
        });
        setProducts(arr.filter((p) => p.isActive));
      },
      (e) => setErr(e.message)
    );
  }, [tenantId]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || "Lainnya"));
    return ["Semua", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat !== "Semua") list = list.filter((p) => (p.category || "Lainnya") === activeCat);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, search, activeCat]);

  const subtotal = useMemo(() => cart.reduce((a, i) => a + i.price * i.qty, 0), [cart]);
  const total = useMemo(() => Math.max(0, subtotal - Number(discount || 0)), [subtotal, discount]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id);
      if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: p.id, name: p.name, category: p.category, price: p.price, qty: 1 }];
    });
  }

  function inc(id: string) {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  }

  function dec(id: string) {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0)
    );
  }

  function resetCart() {
    setCart([]);
    setDiscount(0);
    setPayOpen(false);
    setPaidAmount(0);
    setPaymentMethod("CASH");
    setErr(null);
  }

  function buildReceiptHtml(orderNo: string, title: "STRUK" | "BILL") {
    const dateText = new Date().toLocaleString("id-ID");
    return receiptHTML({
      title,
      storeName: receiptSettings.storeName || "TerraPOS",
      address: receiptSettings.address || "",
      footer: receiptSettings.footer || "Terima kasih.",
      orderNo,
      dateText,
      tableNo: tableNo.trim() || null,
      cashierEmail: receiptSettings.cashierName || email || "",
      paymentMethod,
      subtotal,
      discount: Number(discount || 0),
      total,
      paidAmount: paymentMethod === "CASH" ? paidAmount : total,
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
    });
  }

  function buildReceiptText(orderNo: string, title: "STRUK" | "BILL") {
    return buildPlainReceipt({
      title,
      storeName: receiptSettings.storeName || "TerraPOS",
      address: receiptSettings.address || "",
      footer: receiptSettings.footer || "Terima kasih.",
      orderNo,
      dateText: new Date().toLocaleString("id-ID"),
      tableNo: tableNo.trim() || null,
      cashierEmail: receiptSettings.cashierName || email || "",
      paymentMethod,
      subtotal,
      discount: Number(discount || 0),
      total,
      paidAmount: paymentMethod === "CASH" ? paidAmount : total,
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
    });
  }

  function printBySelectedMode(html: string, text: string) {
    const mode = getPrintMode();

    if (mode === "rawbt") {
      sendToRawBT(text);
      return;
    }

    const printWin = window.open("", "_blank", "width=420,height=800");
    if (!printWin) {
      alert("Pop-up print diblokir. Izinkan pop-up lalu coba lagi.");
      return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }

  async function findOpenOrderIdForTable(tNo: string) {
    const ref = collection(db, `tenants/${tenantId}/orders`);
    const qy = query(
      ref,
      where("status", "==", "OPEN"),
      where("tableNo", "==", tNo),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const snap = await getDocs(qy);
    if (snap.empty) return null;
    return snap.docs[0].id;
  }

  async function savePayLater() {
    setErr(null);

    try {
      if (!tenantId) return;
      if (cart.length === 0) return;

      const tNo = tableNo.trim();
      if (!tNo) {
        setErr("Mode Bayar Nanti wajib isi Meja.");
        return;
      }

      const openId = await findOpenOrderIdForTable(tNo);

      if (!openId) {
        const orderNo = `OPEN-${Date.now()}`;
        await addDoc(collection(db, `tenants/${tenantId}/orders`), {
          orderNo,
          status: "OPEN" as OrderStatus,
          mode: "PAY_LATER" as OrderMode,
          tableNo: tNo,
          discount: Number(discount || 0),
          subtotal,
          total,
          items: cart,
          paymentMethod: null,
          paidAmount: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const refDoc = doc(db, `tenants/${tenantId}/orders/${openId}`);
        const snap = await getDoc(refDoc);
        const old = snap.exists() ? (snap.data() as any) : {};
        const oldItems: CartItem[] = Array.isArray(old.items) ? old.items : [];

        const map = new Map<string, CartItem>();
        for (const it of oldItems) map.set(it.id, { ...it });
        for (const it of cart) {
          const prev = map.get(it.id);
          if (!prev) map.set(it.id, { ...it });
          else map.set(it.id, { ...prev, qty: Number(prev.qty || 0) + Number(it.qty || 0) });
        }

        const merged = Array.from(map.values());
        const newSubtotal = merged.reduce((a, i) => a + i.price * i.qty, 0);
        const newDiscount = Number(old.discount || 0) + Number(discount || 0);
        const newTotal = Math.max(0, newSubtotal - newDiscount);

        await updateDoc(refDoc, {
          items: merged,
          subtotal: newSubtotal,
          discount: newDiscount,
          total: newTotal,
          updatedAt: serverTimestamp(),
        });
      }

      const billNo = `BILL-${Date.now()}`;
      const html = buildReceiptHtml(billNo, "BILL");
      localStorage.setItem("terrapos_last_receipt_html", html);

      const text = buildReceiptText(billNo, "BILL");
      printBySelectedMode(html, text);

      resetCart();
    } catch (e: any) {
      setErr(e?.message ?? "Gagal simpan order bayar nanti");
    }
  }

  async function checkoutPayNow() {
    setErr(null);

    try {
      if (!tenantId) return;
      if (cart.length === 0) return;

      if (paymentMethod === "CASH" && paidAmount < total) {
        setErr("Uang dibayar kurang.");
        return;
      }

      const orderNo = `TRX-${Date.now()}`;

      await addDoc(collection(db, `tenants/${tenantId}/orders`), {
        orderNo,
        status: "PAID" as OrderStatus,
        mode: "PAY_NOW" as OrderMode,
        tableNo: tableNo.trim() || null,
        paymentMethod,
        paidAmount: paymentMethod === "CASH" ? paidAmount : total,
        discount: Number(discount || 0),
        subtotal,
        total,
        items: cart,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paidAt: serverTimestamp(),
      });

      const html = buildReceiptHtml(orderNo, "STRUK");
      localStorage.setItem("terrapos_last_receipt_html", html);

      const text = buildReceiptText(orderNo, "STRUK");
      printBySelectedMode(html, text);

      resetCart();
    } catch (e: any) {
      setErr(e?.message ?? "Gagal checkout");
    }
  }

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <style>{`
        .pos-grid{ margin-top:14px; display:grid; grid-template-columns: 1fr 320px; gap:14px; align-items:start; }
        @media (max-width: 980px){ .pos-grid{ grid-template-columns: 1fr !important; } }
        .product-grid{ margin-top:12px; display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:12px; }
        .product-btn{ text-align:left; padding:14px; border-radius:12px; border:1px solid var(--border); background:#fff; cursor:pointer; }
        .product-btn:hover{ background: var(--brandSoft); border-color: #ffd7b5; }
        .product-name{ font-weight:900; font-size:16px; line-height:1.2; }
        .product-meta{ font-size:12px; color: var(--muted); margin-top:4px; }
        .product-price{ margin-top:10px; font-weight:900; color: var(--brand); font-size:16px; }
        .cart-item{ display:flex; justify-content:space-between; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
        .topnav{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .modebar{ display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">TerraPOS</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">
              User: {email || "-"} | Role: <b>{role || "-"}</b>
              {tableNo ? <> | Meja: <b>{tableNo}</b></> : null}
            </div>

            <div className="modebar">
              <button
                className={"btn " + (mode === "PAY_NOW" ? "btn-primary" : "")}
                onClick={() => {
                  setMode("PAY_NOW");
                  setErr(null);
                }}
              >
                Bayar Sekarang
              </button>

              <button
                className={"btn " + (mode === "PAY_LATER" ? "btn-primary" : "")}
                onClick={() => {
                  setMode("PAY_LATER");
                  setErr(null);
                }}
              >
                Bayar Nanti (Meja)
              </button>
            </div>
          </div>

          <div className="spacer" />

          <div className="topnav">
            <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
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
      </div>

      <div className="pos-grid">
        <div className="card">
          <div className="row">
            <input
              ref={searchRef}
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu..."
            />
            <input
              className="input"
              style={{ width: 170 }}
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
              placeholder="Meja (opsional)"
            />
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            {categories.map((c) => (
              <button
                key={c}
                className={"btn " + (activeCat === c ? "btn-primary" : "")}
                onClick={() => setActiveCat(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

          <div className="product-grid">
            {filtered.map((p) => (
              <button key={p.id} className="product-btn" onClick={() => addToCart(p)}>
                <div className="product-name">{p.name}</div>
                <div className="product-meta">{p.category}</div>
                <div className="product-price">Rp {rupiah(p.price)}</div>
                <div className="product-meta" style={{ marginTop: 6 }}>Klik untuk tambah</div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && <div className="small" style={{ marginTop: 12 }}>Tidak ada menu.</div>}
        </div>

        <div className="card">
          <div className="row">
            <div className="h1">Keranjang</div>
            <div className="spacer" />
            <button className="btn" onClick={resetCart}>Reset</button>
          </div>

          <div style={{ marginTop: 12 }}>
            {cart.length === 0 ? (
              <div className="small">Keranjang kosong.</div>
            ) : (
              cart.map((i) => (
                <div key={i.id} className="cart-item">
                  <div>
                    <div style={{ fontWeight: 900 }}>{i.name}</div>
                    <div className="small">{i.category} • Rp {rupiah(i.price)}</div>
                  </div>
                  <div className="row">
                    <button className="btn" onClick={() => dec(i.id)}>-</button>
                    <b style={{ minWidth: 24, textAlign: "center" }}>{i.qty}</b>
                    <button className="btn" onClick={() => inc(i.id)}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="small">Subtotal</span>
              <b>Rp {rupiah(subtotal)}</b>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
              <span className="small">Diskon</span>
              <input
                className="input"
                style={{ width: 140, textAlign: "right" }}
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value || 0))}
              />
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <b>Total</b>
              <b style={{ color: "var(--brand)" }}>Rp {rupiah(total)}</b>
            </div>

            {mode === "PAY_NOW" ? (
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 12 }}
                disabled={cart.length === 0}
                onClick={() => {
                  setPayOpen(true);
                  setPaidAmount(total);
                  setPaymentMethod("CASH");
                }}
              >
                Bayar Sekarang
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 12 }}
                disabled={cart.length === 0}
                onClick={savePayLater}
              >
                Simpan Order (Bayar Nanti)
              </button>
            )}
          </div>
        </div>
      </div>

      {payOpen && mode === "PAY_NOW" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
          <div className="card" style={{ width: 520, maxWidth: "100%" }}>
            <div className="row">
              <div className="h1">Pembayaran</div>
              <div className="spacer" />
              <button className="btn" onClick={() => setPayOpen(false)}>Tutup</button>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className={"btn " + (paymentMethod === "CASH" ? "btn-primary" : "")} onClick={() => setPaymentMethod("CASH")}>CASH</button>
              <button className={"btn " + (paymentMethod === "QRIS" ? "btn-primary" : "")} onClick={() => setPaymentMethod("QRIS")}>QRIS</button>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
              <span className="small">Total</span>
              <b>Rp {rupiah(total)}</b>
            </div>

            {paymentMethod === "CASH" && (
              <>
                <div style={{ marginTop: 10 }}>
                  <div className="small">Uang dibayar</div>
                  <input className="input" type="number" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value || 0))} />
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                  <span className="small">Kembalian</span>
                  <b>Rp {rupiah(Math.max(0, paidAmount - total))}</b>
                </div>
              </>
            )}

            {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

            <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={checkoutPayNow}>
              Selesaikan & Print Struk
            </button>
          </div>
        </div>
      )}
    </TerraPage>
  );
}