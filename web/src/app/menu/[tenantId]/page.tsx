"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection, onSnapshot, query, where, orderBy,
  addDoc, serverTimestamp, doc, getDoc, getDocs, updateDoc,
} from "firebase/firestore";
import { CustomerOrderItem } from "@/lib/tables";
import { canSubmitOrder } from "@/lib/rate-limit";


type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  isActive?: boolean;
};

type StoreInfo = {
  storeName: string;
  address: string;
};

function rupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

export default function CustomerMenuPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.tenantId as string;
  const tableNumber = searchParams.get("table") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: "", address: "" });
  const [cart, setCart] = useState<CustomerOrderItem[]>([]);
  const [activeCat, setActiveCat] = useState("Semua");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);


  // Load store info
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d = snap.data() as any;
          setStoreInfo({
            storeName: d.storeName || "Restoran",
            address: d.address || "",
          });
        }
      } catch {}
    })();
  }, [tenantId]);

  // Load products (realtime)
  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    const ref = collection(db, `tenants/${tenantId}/products`);
    const q = query(ref, orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Product[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || "",
        category: d.data().category || "Lainnya",
        price: Number(d.data().price || 0),
        isActive: d.data().isActive ?? true,
      }));
      setProducts(arr.filter((p) => p.isActive !== false));
      setLoading(false);
    }, (e) => {
      setError("Gagal memuat menu. Silakan refresh.");
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);


  // Categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ["Semua", ...Array.from(cats).sort()];
  }, [products]);

  // Filtered products
  const filtered = useMemo(() => {
    let result = products;
    if (activeCat !== "Semua") {
      result = result.filter((p) => p.category === activeCat);
    }
    const s = search.trim().toLowerCase();
    if (s) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)
      );
    }
    return result;
  }, [products, activeCat, search]);

  // Cart functions
  const addToCart = useCallback((p: Product) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === p.id && !i.notes);
      if (found) {
        return prev.map((i) =>
          i.productId === p.id && !i.notes ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }, []);

  const incItem = useCallback((idx: number) => {
    setCart((prev) => prev.map((i, j) => j === idx ? { ...i, qty: i.qty + 1 } : i));
  }, []);

  const decItem = useCallback((idx: number) => {
    setCart((prev) => prev.map((i, j) => j === idx ? { ...i, qty: i.qty - 1 } : i).filter((i) => i.qty > 0));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setCart((prev) => prev.filter((_, j) => j !== idx));
  }, []);


  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, i) => sum + i.qty, 0), [cart]);

  // Submit order
  const submitOrder = async () => {
    if (cart.length === 0) return;

    // Rate limit check
    const rl = canSubmitOrder();
    if (!rl.allowed) {
      setError(`Terlalu sering mengirim pesanan. Tunggu ${rl.waitSeconds} detik.`);
      return;
    }

    setSubmitting(true);
    try {
      // Create order in the same orders collection used by POS
      const orderNo = "QR-" + Date.now().toString(36).toUpperCase();
      const orderData = {
        orderNo,
        status: "OPEN",
        mode: "PAY_LATER",
        tableNo: tableNumber || null,
        source: "customer_qr",
        customerName: customerName.trim() || null,
        customerNote: customerNote.trim() || null,
        paymentMethod: null,
        paidAmount: null,
        subtotal: cartTotal,
        discount: 0,
        total: cartTotal,
        items: cart.map((c) => ({
          name: c.name,
          qty: c.qty,
          price: c.price,
          notes: c.notes || "",
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, `tenants/${tenantId}/orders`), orderData);

      // Auto-update table status to "occupied" if table exists
      if (tableNumber) {
        try {
          const tablesRef = collection(db, `tenants/${tenantId}/tables`);
          const tq = query(tablesRef, where("number", "==", tableNumber));
          const tSnap = await getDocs(tq);
          if (!tSnap.empty) {
            const tableDoc = tSnap.docs[0];
            await updateDoc(doc(db, `tenants/${tenantId}/tables`, tableDoc.id), {
              status: "occupied",
              updatedAt: serverTimestamp(),
            });
          }
        } catch {} // Silent fail - table update is non-critical
      }

      setOrderSuccess(orderNo);
      setCart([]);
      setCartOpen(false);
      setCustomerName("");
      setCustomerNote("");
    } catch (e: any) {
      setError("Gagal mengirim pesanan: " + (e?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };


  // Error state
  if (!tenantId) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h2>Link tidak valid</h2>
        <p>QR code ini tidak dapat digunakan.</p>
      </div>
    );
  }

  // Success state
  if (orderSuccess) {
    return (
      <div className="customer-page">
        <style>{customerStyles + customerStyles2 + customerStyles3 + customerStyles4}</style>
        <div className="success-container">
          <div className="success-icon">&#10003;</div>
          <h2 style={{ margin: "12px 0 8px", fontSize: 22, fontWeight: 800 }}>
            Pesanan Terkirim!
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: 8 }}>
            No. Pesanan: <b>{orderSuccess}</b>
          </p>
          {tableNumber && (
            <p style={{ color: "var(--muted)" }}>Meja: <b>{tableNumber}</b></p>
          )}
          <p style={{ color: "var(--muted)", marginTop: 12, fontSize: 13 }}>
            Pesanan Anda akan segera diproses. Mohon tunggu.
          </p>
          <a
            href={`/menu/${tenantId}/track?order=${encodeURIComponent(orderSuccess)}&table=${encodeURIComponent(tableNumber)}`}
            style={{
              display: "block",
              marginTop: 16,
              width: "100%",
              padding: "14px",
              background: "var(--brand, #d59567)",
              color: "white",
              borderRadius: 14,
              textAlign: "center",
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            📋 Lacak Pesanan
          </a>
          <button
            className="btn btn-primary"
            style={{ marginTop: 10, width: "100%", background: "var(--panel, #fff)", color: "var(--text, #111)", border: "1px solid var(--border)" }}
            onClick={() => setOrderSuccess(null)}
          >
            Pesan Lagi
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="customer-page">
      <style>{customerStyles + customerStyles2 + customerStyles3 + customerStyles4}</style>

      {/* Header */}
      <header className="cust-header">
        <div>
          <h1 className="cust-store-name">{storeInfo.storeName || "Menu"}</h1>
          {tableNumber && (
            <span className="cust-table-badge">Meja {tableNumber}</span>
          )}
        </div>
        {storeInfo.address && (
          <p className="cust-address">{storeInfo.address}</p>
        )}
      </header>

      {/* Search */}
      <div className="cust-search-wrap">
        <input
          className="cust-search"
          placeholder="Cari menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="cust-cats">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`cust-cat-btn ${activeCat === cat ? "active" : ""}`}
            onClick={() => setActiveCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>


      {/* Loading */}
      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Memuat menu...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && (
        <div className="cust-product-grid">
          {filtered.map((p) => {
            const inCart = cart.find((c) => c.productId === p.id);
            return (
              <div key={p.id} className="cust-product-card">
                <div className="cust-product-info">
                  <div className="cust-product-name">{p.name}</div>
                  <div className="cust-product-cat">{p.category}</div>
                  <div className="cust-product-price">{rupiah(p.price)}</div>
                </div>
                <div className="cust-product-action">
                  {inCart ? (
                    <span className="cust-in-cart">{inCart.qty}x</span>
                  ) : null}
                  <button
                    className="cust-add-btn"
                    onClick={() => addToCart(p)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", gridColumn: "1/-1" }}>
              Menu tidak ditemukan.
            </div>
          )}
        </div>
      )}


      {/* Floating Cart Button */}
      {cartCount > 0 && !cartOpen && (
        <button className="cust-cart-fab" onClick={() => setCartOpen(true)}>
          <span className="cust-cart-fab-icon">&#128722;</span>
          <span>{cartCount} item</span>
          <span className="cust-cart-fab-total">{rupiah(cartTotal)}</span>
        </button>
      )}

      {/* Cart Bottom Sheet */}
      {cartOpen && (
        <div className="cust-overlay" onClick={() => setCartOpen(false)}>
          <div className="cust-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cust-sheet-header">
              <h3>Pesanan Anda</h3>
              <button className="cust-sheet-close" onClick={() => setCartOpen(false)}>
                &#10005;
              </button>
            </div>

            <div className="cust-cart-items">
              {cart.map((item, idx) => (
                <div key={idx} className="cust-cart-item">
                  <div className="cust-cart-item-info">
                    <div className="cust-cart-item-name">{item.name}</div>
                    <div className="cust-cart-item-price">{rupiah(item.price)}</div>
                  </div>
                  <div className="cust-cart-item-controls">
                    <button onClick={() => decItem(idx)}>-</button>
                    <span>{item.qty}</span>
                    <button onClick={() => incItem(idx)}>+</button>
                    <button className="cust-remove-btn" onClick={() => removeItem(idx)}>
                      &#128465;
                    </button>
                  </div>
                </div>
              ))}
            </div>


            {/* Customer info */}
            <div className="cust-form-section">
              <input
                className="cust-input"
                placeholder="Nama Anda (opsional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <textarea
                className="cust-input cust-textarea"
                placeholder="Catatan tambahan (opsional)"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={2}
              />
            </div>

            {/* Total & Submit */}
            <div className="cust-cart-footer">
              <div className="cust-cart-total">
                <span>Total</span>
                <span className="cust-cart-total-amount">{rupiah(cartTotal)}</span>
              </div>
              <button
                className="cust-submit-btn"
                disabled={submitting || cart.length === 0}
                onClick={submitOrder}
              >
                {submitting ? "Mengirim..." : "Kirim Pesanan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const customerStyles = `
  .customer-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg, #f8f9fb);
    padding-bottom: 100px;
    font-family: var(--font-primary, system-ui, sans-serif);
  }
  .cust-header {
    background: var(--brand, #d59567);
    color: white;
    padding: 24px 16px 20px;
    text-align: center;
  }
  .cust-store-name {
    font-size: 22px;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.3px;
  }
  .cust-table-badge {
    display: inline-block;
    margin-top: 6px;
    padding: 4px 12px;
    background: rgba(255,255,255,0.25);
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
  }
  .cust-address {
    margin-top: 4px;
    font-size: 12px;
    opacity: 0.85;
  }
  .cust-search-wrap {
    padding: 12px 16px 0;
  }
  .cust-search {
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--border, #e5e7eb);
    background: var(--panel, #fff);
    font-size: 15px;
    outline: none;
  }
  .cust-search:focus {
    border-color: var(--brand, #d59567);
    box-shadow: 0 0 0 3px rgba(213,149,103,0.12);
  }
  .cust-cats {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .cust-cats::-webkit-scrollbar { display: none; }
  .cust-cat-btn {
    flex-shrink: 0;
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid var(--border, #e5e7eb);
    background: var(--panel, #fff);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cust-cat-btn.active {
    background: var(--brand, #d59567);
    color: white;
    border-color: var(--brand, #d59567);
  }
`;


const customerStyles2 = `
  .cust-product-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 8px 16px;
  }
  @media (min-width: 480px) {
    .cust-product-grid { grid-template-columns: 1fr 1fr; }
  }
  .cust-product-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--panel, #fff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 14px;
    transition: box-shadow 0.15s;
  }
  .cust-product-card:active {
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .cust-product-info { flex: 1; min-width: 0; }
  .cust-product-name {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cust-product-cat {
    font-size: 11px;
    color: var(--muted, #6b7280);
    margin-top: 2px;
  }
  .cust-product-price {
    font-size: 14px;
    font-weight: 800;
    color: var(--brand, #d59567);
    margin-top: 4px;
  }
  .cust-product-action {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 12px;
  }
  .cust-in-cart {
    font-size: 12px;
    font-weight: 700;
    color: var(--brand, #d59567);
    background: var(--brandSoft, #fdf5ef);
    padding: 2px 8px;
    border-radius: 10px;
  }
  .cust-add-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--brand, #d59567);
    color: white;
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s;
  }
  .cust-add-btn:active { transform: scale(0.9); }
`;


const customerStyles3 = `
  .cust-cart-fab {
    position: fixed;
    bottom: 20px;
    left: 16px;
    right: 16px;
    padding: 16px 20px;
    background: var(--brand, #d59567);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(213,149,103,0.4);
    z-index: 100;
    animation: slideUp 0.2s ease-out;
  }
  .cust-cart-fab-icon { font-size: 20px; }
  .cust-cart-fab-total { margin-left: auto; }
  .cust-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    animation: fadeIn 0.15s;
  }
  .cust-sheet {
    width: 100%;
    max-height: 85vh;
    background: var(--panel, #fff);
    border-radius: 20px 20px 0 0;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.25s ease-out;
    overflow: hidden;
  }
  .cust-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .cust-sheet-header h3 { font-size: 18px; font-weight: 800; margin: 0; }
  .cust-sheet-close {
    width: 32px; height: 32px;
    border: none; background: var(--bg, #f8f9fb);
    border-radius: 50%; font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .cust-cart-items {
    flex: 1;
    overflow-y: auto;
    max-height: 40vh;
    margin-bottom: 12px;
  }
  .cust-cart-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border, #e5e7eb);
  }
  .cust-cart-item-info { flex: 1; }
  .cust-cart-item-name { font-size: 14px; font-weight: 600; }
  .cust-cart-item-price { font-size: 12px; color: var(--muted); }
  .cust-cart-item-controls {
    display: flex; align-items: center; gap: 8px;
  }
  .cust-cart-item-controls button {
    width: 28px; height: 28px; border-radius: 50%;
    border: 1px solid var(--border); background: var(--panel);
    font-size: 16px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .cust-cart-item-controls span {
    font-size: 14px; font-weight: 700; min-width: 20px; text-align: center;
  }
  .cust-remove-btn {
    border-color: var(--danger, #ef4444) !important;
    color: var(--danger, #ef4444) !important;
    font-size: 13px !important;
  }
`;


const customerStyles4 = `
  .cust-form-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  .cust-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--border, #e5e7eb);
    font-size: 14px;
    outline: none;
    background: var(--input-bg, #f9fafb);
  }
  .cust-input:focus { border-color: var(--brand); }
  .cust-textarea { resize: none; }
  .cust-cart-footer { border-top: 1px solid var(--border); padding-top: 12px; }
  .cust-cart-total {
    display: flex;
    justify-content: space-between;
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .cust-cart-total-amount { color: var(--brand, #d59567); }
  .cust-submit-btn {
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 14px;
    background: var(--brand, #d59567);
    color: white;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .cust-submit-btn:active { transform: scale(0.97); }
  .cust-submit-btn:disabled {
    opacity: 0.6; cursor: not-allowed;
  }
  .success-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    padding: 24px;
    text-align: center;
  }
  .success-icon {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: #10b981;
    color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px;
  }
`;
