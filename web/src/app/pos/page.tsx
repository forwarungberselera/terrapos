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
import { isShiftPermissionError, normalizeShift, ShiftRecord } from "@/lib/shifts";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { usePrinting } from "@/components/PrintingOverlay";
import { logAudit } from "@/lib/audit";
import { LevelBadge } from "@/components/LevelBadge";

type Product = { id: string; name: string; category: string; price: number; isActive?: boolean };
type CartItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  qty: number;
  notes?: string;
};
type ReceiptSettings = { storeName: string; address: string; footer: string; cashierName: string; logoBase64?: string; qrText?: string; showLogo?: boolean; showQR?: boolean };
type OrderStatus = "OPEN" | "PAID" | "CANCELLED";
type OrderMode = "PAY_NOW" | "PAY_LATER";

type ActivePromo = {
  id: string;
  name: string;
  type: "percent" | "nominal";
  value: number;
  minSubtotal: number;
  startTime: string;
  endTime: string;
  days: number[];
  code: string;
};

const paymentMethodButtonStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 68,
  justifyContent: "center",
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: 0.4,
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function POSPage() {
  const r = useRouter();
  const sp = useSearchParams();
  const editOrderId = (sp.get("editOrderId") || "").trim();

  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();
  const toast = useToast();
  const { showPrinting, hidePrinting } = usePrinting();

  const isOwner = ["owner", "developer"].includes((role || "").toString().toLowerCase());
  const canUse = ["owner", "admin", "developer"].includes((role || "").toString().toLowerCase());
  const isDev = (role || "").toString().toLowerCase() === "developer";

  const [mode, setMode] = useState<OrderMode>("PAY_NOW");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Semua");
  const [tableNo, setTableNo] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"nominal" | "persen">("nominal");
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const [shiftPromptOpen, setShiftPromptOpen] = useState(false);
  const [shiftAccessBlocked, setShiftAccessBlocked] = useState(false);

  const [showTableWarning, setShowTableWarning] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ orderNo: string; change: number; html: string; text: string; btData: any } | null>(null);
  const [billSuccessDialog, setBillSuccessDialog] = useState<{ orderNo: string; html: string; text: string; btData: any; wasEditing: boolean } | null>(null);

  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderNo, setEditingOrderNo] = useState<string | null>(null);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    storeName: "TerraPOS",
    address: "",
    footer: "Terima kasih.",
    cashierName: "Kasir TerraPOS",
  });
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [promos, setPromos] = useState<ActivePromo[]>([]);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [redeemedCode, setRedeemedCode] = useState("");

  const searchRef = useRef<HTMLInputElement | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  useEffect(() => {
    const t = sp.get("table");
    if (t) setTableNo(t);
  }, [sp]);

  useEffect(() => {
    if (!tenantId || !editOrderId) {
      if (!editOrderId) {
        setEditingOrderId(null);
        setEditingOrderNo(null);
      }
      return;
    }
    if (editingOrderId === editOrderId) return;

    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/orders/${editOrderId}`));
        if (!snap.exists()) {
          if (!cancelled) setErr("Open bill tidak ditemukan.");
          return;
        }

        const data = snap.data() as any;
        if ((data.status || "OPEN") !== "OPEN") {
          if (!cancelled) setErr("Order ini sudah tidak OPEN.");
          return;
        }

        if (cancelled) return;

        setMode("PAY_LATER");
        setTableNo((data.tableNo || "").toString());
        setDiscount(Number(data.discount || 0));
        setCart(
          Array.isArray(data.items)
            ? data.items.map((item: any) => ({
                id: (item.id || item.name || "").toString(),
                name: (item.name || "").toString(),
                category: (item.category || "Lainnya").toString(),
                price: Number(item.price || 0),
                qty: Number(item.qty || 0),
                notes: (item.notes || "").toString(),
              }))
            : []
        );
        setPaymentMethod("CASH");
        setPaidAmount(0);
        setNoteOpenId(null);
        setNoteDraft("");
        setEditingOrderId(editOrderId);
        setEditingOrderNo((data.orderNo || editOrderId).toString());
        setErr(null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Gagal memuat open bill.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId, editOrderId, editingOrderId]);

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
            logoBase64: d.receiptLogoBase64 || "",
            qrText: d.receiptQrText || "",
            showLogo: d.receiptShowLogo ?? false,
            showQR: d.receiptShowQR ?? false,
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

  useEffect(() => {
    if (!tenantId) return;
    const qy = query(collection(db, `tenants/${tenantId}/shifts`), orderBy("openedAt", "desc"), limit(5));
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
    if (!loading && !loadingRole && canUse) {
      setShiftPromptOpen(!activeShift && !shiftAccessBlocked);
    }
  }, [activeShift, canUse, loading, loadingRole, shiftAccessBlocked]);

  // Fetch active promos
  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/promos`);
    const qy = query(ref, where("isActive", "==", true), orderBy("createdAt", "desc"), limit(20));
    return onSnapshot(qy, (snap) => {
      const arr: ActivePromo[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || "",
            type: data.type || "percent",
            value: Number(data.value || 0),
            minSubtotal: Number(data.minSubtotal || 0),
            startTime: data.startTime || "00:00",
            endTime: data.endTime || "23:59",
            days: Array.isArray(data.days) ? data.days : [0, 1, 2, 3, 4, 5, 6],
            code: data.code || "",
            isActive: data.isActive ?? true,
          };
        })
        .filter((p: any) => p.isActive);
      setPromos(arr);
    });
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

  // Auto-apply promo: cari promo terbaik yang berlaku saat ini
  const appliedPromo = useMemo(() => {
    if (promos.length === 0 || subtotal === 0) return null;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const eligible = promos.filter((p) => {
      if (!p.days.includes(currentDay)) return false;
      if (currentTime < p.startTime || currentTime > p.endTime) return false;
      if (p.minSubtotal > 0 && subtotal < p.minSubtotal) return false;
      // Promo dengan kode hanya berlaku jika kode di-redeem
      if (p.code && p.code !== redeemedCode) return false;
      // Promo tanpa kode = auto-apply
      return true;
    });

    if (eligible.length === 0) return null;

    // Pilih promo dengan diskon terbesar
    let best: ActivePromo | null = null;
    let bestAmount = 0;
    for (const p of eligible) {
      const amt = p.type === "percent" ? Math.round((subtotal * p.value) / 100) : p.value;
      if (amt > bestAmount) {
        bestAmount = amt;
        best = p;
      }
    }
    return best;
  }, [promos, subtotal, redeemedCode]);

  const promoDiscountAmount = useMemo(() => {
    if (!appliedPromo) return 0;
    return appliedPromo.type === "percent"
      ? Math.round((subtotal * appliedPromo.value) / 100)
      : appliedPromo.value;
  }, [appliedPromo, subtotal]);

  const discountAmount = useMemo(() => {
    if (discountType === "persen") {
      return Math.round((subtotal * Number(discount || 0)) / 100);
    }
    return Number(discount || 0);
  }, [subtotal, discount, discountType]);
  const totalDiscount = useMemo(() => discountAmount + promoDiscountAmount, [discountAmount, promoDiscountAmount]);
  const total = useMemo(() => Math.max(0, subtotal - totalDiscount), [subtotal, totalDiscount]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id && !(i.notes || "").trim());
      if (found) {
        return prev.map((i) => (i.id === p.id && !(i.notes || "").trim() ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: p.id, name: p.name, category: p.category, price: p.price, qty: 1, notes: "" }];
    });
  }

  function inc(index: number) {
    setCart((prev) => prev.map((i, idx) => (idx === index ? { ...i, qty: i.qty + 1 } : i)));
  }

  function dec(index: number) {
    setCart((prev) =>
      prev.map((i, idx) => (idx === index ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0)
    );
  }

  function openNoteEditor(index: number) {
    setNoteOpenId(String(index));
    setNoteDraft(cart[index]?.notes || "");
  }

  function saveNote(index: number) {
    setCart((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, notes: noteDraft.trim() } : item
      )
    );
    setNoteOpenId(null);
    setNoteDraft("");
  }

  function clearNote(index: number) {
    setCart((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, notes: "" } : item
      )
    );
    setNoteOpenId(null);
    setNoteDraft("");
  }

  function resetCart() {
    setCart([]);
    setDiscount(0);
    setDiscountType("nominal");
    setPayOpen(false);
    setPaidAmount(0);
    setPaymentMethod("CASH");
    setErr(null);
    setNoteOpenId(null);
    setNoteDraft("");
    setEditingOrderId(null);
    setEditingOrderNo(null);
    setPromoCodeInput("");
    setRedeemedCode("");
  }

  function buildReceiptHtml(orderNo: string, title: "STRUK" | "BILL") {
    const dateText = new Date().toLocaleString("id-ID");
    const receiptPaymentMethod = title === "STRUK" ? paymentMethod : null;
    return receiptHTML({
      title,
      storeName: receiptSettings.storeName || "TerraPOS",
      address: receiptSettings.address || "",
      footer: receiptSettings.footer || "Terima kasih.",
      orderNo,
      dateText,
      tableNo: tableNo.trim() || null,
      cashierEmail: receiptSettings.cashierName || email || "",
      paymentMethod: receiptPaymentMethod,
      subtotal,
      discount: totalDiscount,
      total,
      paidAmount: receiptPaymentMethod === "CASH" ? paidAmount : null,
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price, notes: c.notes || "" })),
      logoBase64: receiptSettings.logoBase64 || "",
      qrText: receiptSettings.qrText || "",
      showLogo: receiptSettings.showLogo ?? false,
      showQR: receiptSettings.showQR ?? false,
    });
  }

  function buildReceiptText(orderNo: string, title: "STRUK" | "BILL") {
    const receiptPaymentMethod = title === "STRUK" ? paymentMethod : null;
    return buildPlainReceipt({
      title,
      storeName: receiptSettings.storeName || "TerraPOS",
      address: receiptSettings.address || "",
      footer: receiptSettings.footer || "Terima kasih.",
      orderNo,
      dateText: new Date().toLocaleString("id-ID"),
      tableNo: tableNo.trim() || null,
      cashierEmail: receiptSettings.cashierName || email || "",
      paymentMethod: receiptPaymentMethod,
      subtotal,
      discount: totalDiscount,
      total,
      paidAmount: receiptPaymentMethod === "CASH" ? paidAmount : null,
      items: cart.map((c) => ({
        name: c.notes?.trim() ? `${c.name} (${c.notes})` : c.name,
        qty: c.qty,
        price: c.price,
      })),
      qrText: receiptSettings.qrText || "",
      showQR: receiptSettings.showQR ?? false,
    });
  }

  async function printBySelectedMode(html: string, text: string, receiptDataForBT?: { title?: string; orderNo?: string; payMethod?: string | null; paid?: number | null }) {
    const mode = getPrintMode();

    if (mode === "bluetooth") {
      try {
        showPrinting("Mencetak via Bluetooth...");
        const btData = {
          storeName: receiptSettings.storeName || "TerraPOS",
          address: receiptSettings.address || "",
          footer: receiptSettings.footer || "Terima kasih.",
          title: receiptDataForBT?.title || "STRUK",
          orderNo: receiptDataForBT?.orderNo || "",
          dateText: new Date().toLocaleString("id-ID"),
          tableNo: tableNo.trim() || null,
          cashierName: receiptSettings.cashierName || email || "",
          paymentMethod: receiptDataForBT?.payMethod ?? paymentMethod,
          subtotal,
          discount: totalDiscount,
          total,
          paidAmount: receiptDataForBT?.paid ?? (paymentMethod === "CASH" ? paidAmount : null),
          items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price, notes: c.notes || "" })),
          qrText: receiptSettings.qrText || "",
          showQR: receiptSettings.showQR ?? false,
        };
        const NativePrinter = await import("@/lib/native-printer");
        if (NativePrinter.isNative()) {
          const status = await NativePrinter.isConnected();
          if (!status.connected) { await NativePrinter.autoReconnect(); }
          await NativePrinter.printReceipt(btData);
          toast.success("Struk berhasil dicetak!");
        } else {
          const WebBT = await import("@/lib/bluetooth-printer");
          if (!WebBT.isPrinterConnected()) { toast.error("Printer belum terkonek. Buka halaman Printer dulu."); hidePrinting(); return; }
          await WebBT.printReceipt(btData);
          toast.success("Struk berhasil dicetak!");
        }
      } catch (e: any) { toast.error("Gagal print: " + (e?.message || "")); } finally { hidePrinting(); }
      return;
    }

    // RawBT mode (default fallback)
    sendToRawBT(text);
    toast.success("Dikirim ke RawBT.");
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
        setShowTableWarning(true);
        return;
      }

      await doSavePayLater();
    } catch (e: any) {
      setErr(e?.message ?? "Gagal simpan order bayar nanti");
    }
  }

  async function doSavePayLater() {
    try {
      if (!tenantId) return;

      const tNo = tableNo.trim();

      let receiptOrderNo = editingOrderNo || "";

      if (editingOrderId) {
        await updateDoc(doc(db, `tenants/${tenantId}/orders/${editingOrderId}`), {
          tableNo: tNo,
          items: cart,
          subtotal,
          discount: totalDiscount,
          total,
          updatedAt: serverTimestamp(),
        });
      } else {
        const openId = await findOpenOrderIdForTable(tNo);

        if (!openId) {
          const orderNo = `OPEN-${Date.now()}`;
          receiptOrderNo = orderNo;
          await addDoc(collection(db, `tenants/${tenantId}/orders`), {
            orderNo,
            status: "OPEN" as OrderStatus,
            mode: "PAY_LATER" as OrderMode,
            tableNo: tNo,
            discount: totalDiscount,
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

          receiptOrderNo = (old.orderNo || openId).toString();

          const merged = [...oldItems, ...cart];
          const newSubtotal = merged.reduce((a, i) => a + i.price * i.qty, 0);
          const newDiscount = Number(old.discount || 0) + totalDiscount;
          const newTotal = Math.max(0, newSubtotal - newDiscount);

          await updateDoc(refDoc, {
            items: merged,
            subtotal: newSubtotal,
            discount: newDiscount,
            total: newTotal,
            updatedAt: serverTimestamp(),
          });
        }
      }

      const billNo = receiptOrderNo || `BILL-${Date.now()}`;
      const html = buildReceiptHtml(billNo, "BILL");
      localStorage.setItem("terrapos_last_receipt_html", html);

      const text = buildReceiptText(billNo, "BILL");

      setBillSuccessDialog({
        orderNo: billNo,
        html,
        text,
        btData: { title: "BILL", orderNo: billNo, payMethod: null, paid: null },
        wasEditing: !!editingOrderId,
      });
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

      if (!activeShift && !shiftAccessBlocked) {
        setErr("Buka shift dulu sebelum transaksi bayar sekarang.");
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
        discount: totalDiscount,
        subtotal,
        total,
        items: cart,
        shiftId: activeShift?.id || null,
        shiftOpenedByEmail: activeShift?.openedByEmail || email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paidAt: serverTimestamp(),
      });

      const html = buildReceiptHtml(orderNo, "STRUK");
      localStorage.setItem("terrapos_last_receipt_html", html);

      const text = buildReceiptText(orderNo, "STRUK");

      const change = paymentMethod === "CASH" ? Math.max(0, paidAmount - total) : 0;

      const btData = {
        title: "STRUK",
        orderNo,
        payMethod: paymentMethod,
        paid: paymentMethod === "CASH" ? paidAmount : total,
      };

      logAudit(tenantId!, {
        action: "ORDER_PAID",
        userEmail: email || "",
        description: `Order ${orderNo} dibayar ${paymentMethod} (Rp ${total.toLocaleString("id-ID")})`,
        metadata: { orderNo, paymentMethod, total, itemCount: cart.length },
      });

      setSuccessDialog({ orderNo, change, html, text, btData });
      setPayOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal checkout");
    }
  }

  function handleSuccessPrint() {
    if (!successDialog) return;
    void printBySelectedMode(successDialog.html, successDialog.text, successDialog.btData);
    setSuccessDialog(null);
    resetCart();
  }

  function handleSuccessSkip() {
    setSuccessDialog(null);
    resetCart();
  }

  function handleBillPrint() {
    if (!billSuccessDialog) return;
    const wasEditing = billSuccessDialog.wasEditing;
    void printBySelectedMode(billSuccessDialog.html, billSuccessDialog.text, billSuccessDialog.btData);
    setBillSuccessDialog(null);
    resetCart();
    if (wasEditing) r.push("/orders");
  }

  function handleBillSkip() {
    if (!billSuccessDialog) return;
    const wasEditing = billSuccessDialog.wasEditing;
    setBillSuccessDialog(null);
    resetCart();
    if (wasEditing) r.push("/orders");
  }

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <SkeletonStyles />
        <PageSkeleton cards={3} />
      </TerraPage>
    );
  }

  if (!canUse) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">POS hanya untuk owner/admin.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/dashboard")}>
            Kembali
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <style>{`
        .pos-grid{
          display:grid;
          grid-template-columns: 1fr 360px;
          gap:14px;
          align-items:start;
          max-width:100%;
          overflow:hidden;
        }
        @media (max-width: 1080px){ .pos-grid{ grid-template-columns: 1fr 320px; } }
        @media (max-width: 980px){
          .pos-grid{ grid-template-columns: 1fr !important; padding-bottom:80px; }
          .pos-grid > .card{ min-width:0; overflow:hidden; }
        }
        .product-grid{
          margin-top:12px;
          display:grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap:10px;
          overflow:hidden;
        }
        @media (max-width: 640px){
          .product-grid{ grid-template-columns: repeat(2, 1fr); gap:6px; }
          .product-btn{ padding:10px; }
          .product-name{ font-size:12px; }
          .product-meta{ font-size:10px; margin-top:2px; }
          .product-price{ margin-top:4px; font-size:12px; }
        }
        .product-btn{
          text-align:left;
          padding:14px;
          border-radius: var(--radius);
          border:1px solid var(--border);
          background: var(--panel);
          cursor:pointer;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
          touch-action: manipulation;
          overflow:hidden;
          word-break:break-word;
        }
        .product-btn:hover{
          background: var(--brandSoft);
          border-color: var(--brand2);
          box-shadow: var(--shadow);
        }
        .product-btn:active{
          transform: scale(0.97);
        }
        .product-name{ font-weight:800; font-size:14px; line-height:1.3; color: var(--text); }
        .product-meta{ font-size:11px; color: var(--muted); margin-top:3px; }
        .product-price{ margin-top:8px; font-weight:900; color: var(--brand); font-size:15px; font-family: var(--font-mono); }
        .cart-item{
          padding:12px 0;
          border-bottom:1px solid var(--border);
          transition: background 0.15s ease;
        }
        .cart-item:last-child{ border-bottom:none; }
        .topnav{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          align-items:center;
        }
        @media (max-width: 768px){
          .topnav{ gap:6px; }
          .topnav .btn{ padding:8px 10px; font-size:12px; }
        }
        .modebar{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:10px;
        }
        .note-box{
          margin-top:8px;
          padding:12px;
          border:1px dashed var(--border);
          border-radius: var(--radius-sm);
          background: var(--brandSoft);
        }
        .pos-categories{
          display:flex;
          gap:8px;
          margin-top:10px;
          overflow-x:auto;
          padding-bottom:4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .pos-categories::-webkit-scrollbar{ display:none; }
        .pos-categories .btn{ flex-shrink:0; }
        .cart-summary{
          margin-top:14px;
          padding-top:14px;
          border-top:1px solid var(--border);
          display:grid;
          gap:8px;
        }
        .cart-total-row{
          display:flex;
          justify-content:space-between;
          align-items:center;
        }
        .cart-total-value{
          font-size:20px;
          font-weight:900;
          color:var(--brand);
          font-family: var(--font-mono);
        }
        @media (max-width: 980px){
          .pos-cart-mobile{
            position:sticky;
            bottom:0;
            z-index:10;
          }
          .pos-cart-desktop{ display:none !important; }
        }
        @media (min-width: 981px){
          .pos-mobile-bar{ display:none !important; }
          .pos-mobile-sheet{ display:none !important; }
        }
        .pos-mobile-bar{
          position:fixed;bottom:16px;left:16px;right:16px;z-index:40;
          padding:14px 18px;
          background:var(--brand,#d59567);
          color:#fff;
          display:flex;align-items:center;gap:12px;
          cursor:pointer;
          border-radius:16px;
          box-shadow:0 4px 24px rgba(0,0,0,0.2);
          transition:transform 0.2s ease;
          touch-action:manipulation;
        }
        .pos-mobile-bar:active{transform:scale(0.98);}
        .pos-mobile-bar-badge{
          width:28px;height:28px;border-radius:50%;
          background:rgba(255,255,255,0.25);
          display:grid;place-items:center;
          font-weight:900;font-size:14px;
        }
        .pos-mobile-bar-text{flex:1;font-weight:700;font-size:14px;}
        .pos-mobile-bar-total{font-weight:900;font-size:16px;font-family:var(--font-mono);}
        .pos-mobile-sheet-overlay{
          position:fixed;inset:0;z-index:45;
          background:rgba(0,0,0,0.5);
          animation:fadeIn 0.2s ease;
        }
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
        .pos-mobile-sheet{
          position:fixed;bottom:0;left:0;right:0;z-index:46;
          background:var(--panel);
          border-radius:20px 20px 0 0;
          max-height:85vh;
          overflow-y:auto;
          padding:20px 16px 32px;
          animation:slideUp 0.25s ease;
          box-shadow:0 -8px 30px rgba(0,0,0,0.2);
        }
        .pos-mobile-sheet-handle{
          width:40px;height:4px;border-radius:2px;
          background:var(--border);margin:0 auto 16px;
        }
        .pos-mobile-sheet .cart-item{
          padding:12px 0;border-bottom:1px solid var(--border);
        }
        .pos-mobile-sheet .cart-item:last-child{border-bottom:none;}
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-primary)", lineHeight: 1 }}>terra <span style={{ color: "var(--brand)" }}>POS</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 6 }}>
              <LevelBadge size="small" />
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, background: "var(--input-bg)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                {email || "-"}
              </span>
              {tableNo ? (
                <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, background: "var(--input-bg)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                  Meja: {tableNo}
                </span>
              ) : null}
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              Shift: <b>{shiftAccessBlocked ? "Belum aktif di rules" : activeShift ? `OPEN - ${activeShift.openedByEmail || "-"}` : "Belum dibuka"}</b>
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

            {editingOrderId && (
              <div className="small" style={{ marginTop: 10, fontWeight: 800, color: "var(--brand)" }}>
                Sedang edit open bill: <b>{editingOrderNo || editingOrderId}</b>
              </div>
            )}
          </div>

          <div className="spacer" />

          <div className="topnav">
            <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
            <button className="btn hide-mobile" onClick={() => r.push("/shifts")}>Shift</button>
            {isOwner && (
              <button className="btn btn-primary" onClick={() => r.push("/dashboard")}>
                Dashboard
              </button>
            )}
            {isDev && (
              <button className="btn" onClick={() => r.push("/dev")} style={{ background: "var(--input-bg)", fontWeight: 700 }}>
                Dev
              </button>
            )}
            <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="pos-grid">
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <input
              ref={searchRef}
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu..."
            />
            <input
              className="input"
              style={{ width: 120, flexShrink: 0 }}
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
              placeholder="No. Meja"
            />
          </div>

          <div className="pos-categories">
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
              </button>
            ))}
          </div>

          {filtered.length === 0 && <div className="small" style={{ marginTop: 12 }}>Tidak ada menu.</div>}
        </div>

        <div className="card pos-cart-desktop">
          <div className="row">
            <div className="h1">Keranjang</div>
            <div className="spacer" />
            <button className="btn" onClick={resetCart}>Reset</button>
          </div>

          <div style={{ marginTop: 12 }}>
            {cart.length === 0 ? (
              <div className="small">Keranjang kosong.</div>
            ) : (
              cart.map((i, index) => (
                <div key={`${i.id}-${index}`} className="cart-item">
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900 }}>{i.name}</div>
                      <div className="small">{i.category} • Rp {rupiah(i.price)}</div>
                      {(i.notes || "").trim() ? (
                        <div className="small" style={{ marginTop: 6 }}>
                          Catatan: <b>{i.notes}</b>
                        </div>
                      ) : null}
                    </div>

                    <div className="row">
                      <button className="btn" onClick={() => dec(index)}>-</button>
                      <b style={{ minWidth: 24, textAlign: "center" }}>{i.qty}</b>
                      <button className="btn" onClick={() => inc(index)}>+</button>
                    </div>
                  </div>

                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn" onClick={() => openNoteEditor(index)}>
                      {(i.notes || "").trim() ? "Edit Catatan" : "Tambah Catatan"}
                    </button>
                  </div>

                  {noteOpenId === String(index) && (
                    <div className="note-box">
                      <div className="small">Catatan untuk {i.name}</div>
                      <textarea
                        className="input"
                        style={{ marginTop: 8, minHeight: 80 }}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Contoh: tanpa gula, pedas sedang, es sedikit"
                      />
                      <div className="row" style={{ marginTop: 8 }}>
                        <button className="btn btn-primary" onClick={() => saveNote(index)}>
                          Simpan Catatan
                        </button>
                        <button className="btn" onClick={() => clearNote(index)}>
                          Hapus Catatan
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setNoteOpenId(null);
                            setNoteDraft("");
                          }}
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                  )}
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
              <div className="row" style={{ gap: 6 }}>
                <button
                  className={"btn " + (discountType === "nominal" ? "btn-primary" : "")}
                  style={{ padding: "4px 8px", fontSize: 11 }}
                  onClick={() => setDiscountType("nominal")}
                >
                  Rp
                </button>
                <button
                  className={"btn " + (discountType === "persen" ? "btn-primary" : "")}
                  style={{ padding: "4px 8px", fontSize: 11 }}
                  onClick={() => setDiscountType("persen")}
                >
                  %
                </button>
                <input
                  className="input"
                  style={{ width: 90, textAlign: "right" }}
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value || 0))}
                />
              </div>
            </div>
            {discountType === "persen" && discount > 0 && (
              <div className="small" style={{ textAlign: "right", marginTop: 4 }}>
                = Rp {rupiah(discountAmount)}
              </div>
            )}

            {appliedPromo && promoDiscountAmount > 0 && (
              <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--brandSoft)", border: "1px solid var(--brand2)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>
                    Promo: {appliedPromo.name} {appliedPromo.code && `(${appliedPromo.code})`}
                  </span>
                  <b style={{ fontSize: 13, color: "var(--brand)" }}>- Rp {rupiah(promoDiscountAmount)}</b>
                </div>
                <div className="small" style={{ marginTop: 2 }}>
                  {appliedPromo.type === "percent" ? `${appliedPromo.value}% off` : `Rp ${rupiah(appliedPromo.value)} off`} &bull; {appliedPromo.code ? "kode promo" : "otomatis"}
                </div>
                {appliedPromo.code && (
                  <button className="btn" style={{ marginTop: 6, padding: "4px 8px", fontSize: 11 }} onClick={() => { setRedeemedCode(""); setPromoCodeInput(""); }}>
                    Hapus Kode
                  </button>
                )}
              </div>
            )}

            {!redeemedCode && (
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <input
                  className="input"
                  style={{ flex: 1, textTransform: "uppercase" }}
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="Kode promo..."
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: "10px 14px", fontSize: 12 }}
                  onClick={() => {
                    const code = promoCodeInput.trim().toUpperCase();
                    if (!code) return;
                    const found = promos.find((p) => p.code === code);
                    if (!found) { toast.error("Kode promo tidak ditemukan"); return; }
                    setRedeemedCode(code);
                    toast.success(`Kode "${code}" berhasil dipakai!`);
                  }}
                >
                  Pakai
                </button>
              </div>
            )}

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
                  setPaidAmount(0);
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

      {/* MOBILE STICKY CART BAR */}
      {cart.length > 0 && !mobileCartOpen && !payOpen && !successDialog && !billSuccessDialog && (
        <div className="pos-mobile-bar" onClick={() => setMobileCartOpen(true)}>
          <div className="pos-mobile-bar-badge">{cart.reduce((a, i) => a + i.qty, 0)}</div>
          <div className="pos-mobile-bar-text">Lihat Keranjang</div>
          <div className="pos-mobile-bar-total">Rp {rupiah(total)}</div>
        </div>
      )}

      {/* MOBILE CART BOTTOM SHEET */}
      {mobileCartOpen && (
        <>
          <div className="pos-mobile-sheet-overlay" onClick={() => setMobileCartOpen(false)} />
          <div className="pos-mobile-sheet">
            <div className="pos-mobile-sheet-handle" />
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="h1">Keranjang</div>
              <div className="spacer" />
              <button className="btn" onClick={resetCart}>Reset</button>
              <button className="btn" onClick={() => setMobileCartOpen(false)} style={{ marginLeft: 6 }}>Tutup</button>
            </div>

            {cart.length === 0 ? (
              <div className="small">Keranjang kosong.</div>
            ) : (
              cart.map((i, index) => (
                <div key={`m-${i.id}-${index}`} className="cart-item">
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 14 }}>{i.name}</div>
                      <div className="small">{i.category} • Rp {rupiah(i.price)}</div>
                      {(i.notes || "").trim() && (
                        <div className="small" style={{ marginTop: 4 }}>Catatan: <b>{i.notes}</b></div>
                      )}
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn" style={{ padding: "6px 10px" }} onClick={() => dec(index)}>-</button>
                      <b style={{ minWidth: 24, textAlign: "center" }}>{i.qty}</b>
                      <button className="btn" style={{ padding: "6px 10px" }} onClick={() => inc(index)}>+</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => openNoteEditor(index)}>
                      {(i.notes || "").trim() ? "Edit Catatan" : "+ Catatan"}
                    </button>
                  </div>
                  {noteOpenId === String(index) && (
                    <div className="note-box">
                      <textarea
                        className="input"
                        style={{ minHeight: 60 }}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Catatan pesanan..."
                      />
                      <div className="row" style={{ marginTop: 8, gap: 6 }}>
                        <button className="btn btn-primary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => saveNote(index)}>Simpan</button>
                        <button className="btn" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => clearNote(index)}>Hapus</button>
                        <button className="btn" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => { setNoteOpenId(null); setNoteDraft(""); }}>Batal</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {cart.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="small">Subtotal</span>
                  <b>Rp {rupiah(subtotal)}</b>
                </div>

                <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                  <span className="small">Diskon</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className={"btn " + (discountType === "nominal" ? "btn-primary" : "")} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setDiscountType("nominal")}>Rp</button>
                    <button className={"btn " + (discountType === "persen" ? "btn-primary" : "")} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setDiscountType("persen")}>%</button>
                    <input className="input" style={{ width: 80, textAlign: "right" }} type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value || 0))} />
                  </div>
                </div>

                {appliedPromo && promoDiscountAmount > 0 && (
                  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--brandSoft)", border: "1px solid var(--brand2)" }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>Promo: {appliedPromo.name}</span>
                      <b style={{ fontSize: 13, color: "var(--brand)" }}>- Rp {rupiah(promoDiscountAmount)}</b>
                    </div>
                  </div>
                )}

                {!redeemedCode && (
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    <input className="input" style={{ flex: 1, textTransform: "uppercase" }} value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())} placeholder="Kode promo..." />
                    <button className="btn btn-primary" style={{ padding: "10px 14px", fontSize: 12 }} onClick={() => { const code = promoCodeInput.trim().toUpperCase(); if (!code) return; const found = promos.find((p) => p.code === code); if (!found) { toast.error("Kode promo tidak ditemukan"); return; } setRedeemedCode(code); toast.success(`Kode "${code}" berhasil dipakai!`); }}>Pakai</button>
                  </div>
                )}

                <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                  <b>Total</b>
                  <b style={{ color: "var(--brand)", fontSize: 18, fontFamily: "var(--font-mono)" }}>Rp {rupiah(total)}</b>
                </div>

                {mode === "PAY_NOW" ? (
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14, padding: "14px 0", fontSize: 15, fontWeight: 800 }} disabled={cart.length === 0} onClick={() => { setMobileCartOpen(false); setPayOpen(true); setPaidAmount(0); setPaymentMethod("CASH"); }}>
                    Bayar Sekarang
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14, padding: "14px 0", fontSize: 15, fontWeight: 800 }} disabled={cart.length === 0} onClick={() => { setMobileCartOpen(false); savePayLater(); }}>
                    Simpan Order (Bayar Nanti)
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {payOpen && mode === "PAY_NOW" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
          <div className="card" style={{ width: 520, maxWidth: "100%" }}>
            <div className="row">
              <div className="h1">Pembayaran</div>
              <div className="spacer" />
              <button className="btn" onClick={() => setPayOpen(false)}>Tutup</button>
            </div>

            <div className="row" style={{ marginTop: 12, gap: 12 }}>
              <button
                className={"btn " + (paymentMethod === "CASH" ? "btn-primary" : "")}
                style={paymentMethodButtonStyle}
                onClick={() => setPaymentMethod("CASH")}
              >
                CASH
              </button>
              <button
                className={"btn " + (paymentMethod === "QRIS" ? "btn-primary" : "")}
                style={paymentMethodButtonStyle}
                onClick={() => setPaymentMethod("QRIS")}
              >
                QRIS
              </button>
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {[1000, 2000, 5000, 10000, 20000, 50000, 100000].map((nom) => (
                    <button
                      key={nom}
                      className="btn"
                      style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", letterSpacing: -0.3 }}
                      onClick={() => setPaidAmount((prev) => prev + nom)}
                    >
                      +{rupiah(nom)}
                    </button>
                  ))}
                  <button
                    className="btn"
                    style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500 }}
                    onClick={() => setPaidAmount(total)}
                  >
                    Uang Pas
                  </button>
                  <button
                    className="btn"
                    style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500, color: "var(--danger)" }}
                    onClick={() => setPaidAmount(0)}
                  >
                    Reset
                  </button>
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

      {showTableWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 80,
          }}
        >
          <div className="card" style={{ width: 420, maxWidth: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>&#9888;&#65039;</div>
            <div className="h1">No. Meja Belum Diisi</div>
            <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
              Mode Bayar Nanti wajib mengisi No. Meja atau nama pelanggan agar order bisa diidentifikasi.
            </div>

            <div className="row" style={{ marginTop: 16, justifyContent: "center", gap: 10 }}>
              <button className="btn btn-primary" onClick={() => { setShowTableWarning(false); }}>
                OK, Isi Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {shiftPromptOpen && !activeShift && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 70,
          }}
        >
          <div className="card" style={{ width: 520, maxWidth: "100%" }}>
            <div className="h1">Shift Belum Dibuka</div>
            <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
              Sebelum kasir mulai transaksi, shift harus dibuka dulu agar semua pembayaran tercatat ke sesi kasir yang aktif.
            </div>

            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--brandSoft)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Buka shift dulu di halaman <b>Shift</b>, lalu kembali ke POS untuk lanjut transaksi.
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => r.push("/shifts")}>
                Buka Halaman Shift
              </button>
              <button className="btn" onClick={() => r.push("/dashboard")}>
                Ke Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {successDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 90,
          }}
        >
          <div className="card" style={{ width: 440, maxWidth: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 4 }}>&#10003;</div>
            <div className="h1" style={{ color: "var(--brand)" }}>Transaksi Berhasil</div>
            <div className="small" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Pembayaran telah tercatat. Order <b>{successDialog.orderNo}</b> selesai.
            </div>

            {successDialog.change > 0 && (
              <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 12, background: "var(--brandSoft)", border: "1px solid var(--brand2)" }}>
                <div className="small" style={{ fontWeight: 700 }}>Kembalian</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "var(--brand)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                  Rp {rupiah(successDialog.change)}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
              Cetak struk untuk pelanggan?
            </div>

            <div className="row" style={{ marginTop: 12, justifyContent: "center", gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ padding: "12px 24px", fontSize: 14, fontWeight: 800 }}
                onClick={handleSuccessPrint}
              >
                Cetak Struk
              </button>
              <button
                className="btn"
                style={{ padding: "12px 24px", fontSize: 14 }}
                onClick={handleSuccessSkip}
              >
                Lewati
              </button>
            </div>
          </div>
        </div>
      )}

      {billSuccessDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 16, zIndex: 90 }}>
          <div className="card" style={{ width: 440, maxWidth: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 4 }}>&#10003;</div>
            <div className="h1" style={{ color: "var(--brand)" }}>Order Tersimpan</div>
            <div className="small" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Order <b>{billSuccessDialog.orderNo}</b> berhasil disimpan sebagai open bill.
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
              Cetak bill untuk pelanggan?
            </div>
            <div className="row" style={{ marginTop: 12, justifyContent: "center", gap: 10 }}>
              <button className="btn btn-primary" style={{ padding: "12px 24px", fontSize: 14, fontWeight: 800 }} onClick={handleBillPrint}>
                Cetak Bill
              </button>
              <button className="btn" style={{ padding: "12px 24px", fontSize: 14 }} onClick={handleBillSkip}>
                Lewati
              </button>
            </div>
          </div>
        </div>
      )}
    </TerraPage>
  );
}
