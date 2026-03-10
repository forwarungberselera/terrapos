"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { receiptHTML } from "@/lib/receipt";
import {
  buildPlainReceipt,
  getPrintMode,
  sendToRawBT,
  setPrintMode,
} from "@/lib/rawbt";

type ReceiptSettings = {
  storeName: string;
  address: string;
  footer: string;
  cashierName: string;
};

export default function PrinterPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const roleLower = (role || "").toString().toLowerCase();
  const canEdit = roleLower === "owner" || roleLower === "admin";

  const [settings, setSettings] = useState<ReceiptSettings>({
    storeName: "TerraPOS",
    address: "",
    footer: "Terima kasih.",
    cashierName: "Kasir TerraPOS",
  });

  const [customText, setCustomText] = useState("Tes Printer TerraPOS\nTerima kasih 🙏");
  const [msg, setMsg] = useState<string | null>(null);
  const [printMode, setPrintModeState] = useState<"browser" | "rawbt">("browser");

  useEffect(() => {
    setPrintModeState(getPrintMode());
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d = snap.data() as any;
          setSettings({
            storeName: (d.storeName || "TerraPOS").toString(),
            address: (d.address || "").toString(),
            footer: (d.footer || "Terima kasih.").toString(),
            cashierName: (d.cashierName || "Kasir TerraPOS").toString(),
          });
        }
      } catch (e: any) {
        setMsg(e?.message ?? "Gagal load settings");
      }
    })();
  }, [tenantId]);

  const lastReceiptHtml = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("terrapos_last_receipt_html") || "";
  }, []);

  async function saveSettings() {
    if (!tenantId) return;
    try {
      setMsg(null);
      await setDoc(
        doc(db, `tenants/${tenantId}/settings/main`),
        {
          storeName: settings.storeName || "TerraPOS",
          address: settings.address || "",
          footer: settings.footer || "Terima kasih.",
          cashierName: settings.cashierName || "Kasir TerraPOS",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setMsg("✅ Settings tersimpan.");
    } catch (e: any) {
      setMsg(e?.message ?? "Gagal simpan settings");
    }
  }

  function printHtml(html: string) {
    const w = window.open("", "_blank", "width=420,height=800");
    if (!w) {
      alert("Pop-up print diblokir. Izinkan pop-up untuk localhost:3000 lalu coba lagi.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function testPrintBrowser() {
    const html = receiptHTML({
      title: "TEST PRINT",
      storeName: settings.storeName || "TerraPOS",
      address: settings.address || "",
      footer: settings.footer || "Terima kasih.",
      orderNo: `TEST-${Date.now()}`,
      dateText: new Date().toLocaleString("id-ID"),
      tableNo: "1",
      cashierEmail: settings.cashierName || email || "",
      paymentMethod: "CASH",
      subtotal: 25000,
      discount: 0,
      total: 25000,
      paidAmount: 30000,
      items: [
        { name: "Nasi Goreng", qty: 1, price: 15000 },
        { name: "Kopi Susu", qty: 1, price: 10000 },
      ],
    });

    localStorage.setItem("terrapos_last_receipt_html", html);
    printHtml(html);
  }

  function testPrintRawBT() {
    const text = buildPlainReceipt({
      title: "TEST PRINT",
      storeName: settings.storeName || "TerraPOS",
      address: settings.address || "",
      footer: settings.footer || "Terima kasih.",
      orderNo: `TEST-${Date.now()}`,
      dateText: new Date().toLocaleString("id-ID"),
      tableNo: "1",
      cashierEmail: settings.cashierName || email || "",
      paymentMethod: "CASH",
      subtotal: 25000,
      discount: 0,
      total: 25000,
      paidAmount: 30000,
      items: [
        { name: "Nasi Goreng", qty: 1, price: 15000 },
        { name: "Kopi Susu", qty: 1, price: 10000 },
      ],
    });

    sendToRawBT(text);
  }

  function printLastReceipt() {
    const html = localStorage.getItem("terrapos_last_receipt_html") || "";
    if (!html) {
      alert("Belum ada struk terakhir. Coba transaksi dulu atau klik Test Print.");
      return;
    }

    if (printMode === "browser") {
      printHtml(html);
      return;
    }

    const text = buildPlainReceipt({
      title: "STRUK",
      storeName: settings.storeName || "TerraPOS",
      address: settings.address || "",
      footer: settings.footer || "Terima kasih.",
      orderNo: `LAST-${Date.now()}`,
      dateText: new Date().toLocaleString("id-ID"),
      tableNo: "",
      cashierEmail: settings.cashierName || email || "",
      paymentMethod: "CASH",
      subtotal: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      items: [{ name: "Cetak ulang dari halaman printer", qty: 1, price: 0 }],
    });
    sendToRawBT(text);
  }

  function printCustomText() {
    const safe = (customText || "").trim();
    if (!safe) {
      alert("Teks kosong.");
      return;
    }

    if (printMode === "rawbt") {
      sendToRawBT(safe);
      return;
    }

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Custom Print</title>
  <style>
    @page { margin: 10mm; }
    body { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; color:#111; }
    .wrap { max-width: 320px; margin: 0 auto; white-space: pre-wrap; }
    .title{ font-weight:900; font-size:16px; text-align:center; margin-bottom:10px; }
    .muted{ opacity:.8; font-size:12px; text-align:center; margin-bottom:10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="title">${escapeHtml(settings.storeName || "TerraPOS")}</div>
    <div class="muted">${escapeHtml(new Date().toLocaleString("id-ID"))}</div>
    ${escapeHtml(safe)}
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>
    `;

    localStorage.setItem("terrapos_last_receipt_html", html);
    printHtml(html);
  }

  function changeMode(mode: "browser" | "rawbt") {
    setPrintModeState(mode);
    setPrintMode(mode);
    setMsg(mode === "rawbt" ? "✅ Mode print: RawBT" : "✅ Mode print: Browser");
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
        .grid{ margin-top:14px; display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
        @media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }
        textarea{ width:100%; min-height:160px; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Printer</div>
            <div className="small">Tes cetak & pengaturan struk.</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">User: {email || "-"} | Role: <b>{role || "-"}</b></div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        </div>
      </div>

      {msg && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900 }}>{msg}</div>
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Mode Cetak</div>
        <div className="small" style={{ marginTop: 6 }}>
          Browser = dialog print biasa. RawBT = kirim langsung ke RawBT.
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className={"btn " + (printMode === "browser" ? "btn-primary" : "")}
            onClick={() => changeMode("browser")}
          >
            Browser
          </button>
          <button
            className={"btn " + (printMode === "rawbt" ? "btn-primary" : "")}
            onClick={() => changeMode("rawbt")}
          >
            RawBT
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="h1">Pengaturan Struk</div>
          <div className="small" style={{ marginTop: 6 }}>Dipakai di semua struk.</div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Nama Toko</div>
            <input
              className="input"
              value={settings.storeName}
              onChange={(e) => setSettings((p) => ({ ...p, storeName: e.target.value }))}
              disabled={!canEdit}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Alamat</div>
            <input
              className="input"
              value={settings.address}
              onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))}
              disabled={!canEdit}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Nama Kasir Default</div>
            <input
              className="input"
              value={settings.cashierName}
              onChange={(e) => setSettings((p) => ({ ...p, cashierName: e.target.value }))}
              disabled={!canEdit}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Footer Struk</div>
            <input
              className="input"
              value={settings.footer}
              onChange={(e) => setSettings((p) => ({ ...p, footer: e.target.value }))}
              disabled={!canEdit}
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={saveSettings}
            disabled={!canEdit}
          >
            Simpan Settings
          </button>
        </div>

        <div className="card">
          <div className="h1">Tes Cetak</div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={() => (printMode === "rawbt" ? testPrintRawBT() : testPrintBrowser())}
          >
            Test Print
          </button>

          <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={printLastReceipt}>
            Cetak Ulang Struk Terakhir
          </button>

          <div style={{ marginTop: 14 }}>
            <div className="small">Cetak Teks Custom</div>
            <textarea
              className="input"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Tulis teks..."
            />
          </div>

          <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={printCustomText}>
            Print Teks Custom
          </button>

          <div className="small" style={{ marginTop: 12, opacity: 0.8 }}>
            Untuk RawBT, Android akan handoff langsung ke RawBT. Kalau RawBT sudah jadi handler/default, kamu tidak perlu buka app manual dulu.
          </div>
        </div>
      </div>
    </TerraPage>
  );
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br/>");
}