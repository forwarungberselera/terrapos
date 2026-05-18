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
import {
  isBluetoothAvailable,
  isPrinterConnected,
  getConnectedPrinterName,
  connectPrinter,
  disconnectPrinter,
  printReceipt as btPrintReceipt,
  printText as btPrintText,
} from "@/lib/bluetooth-printer";

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

  const [customText, setCustomText] = useState("Tes Printer TerraPOS\nTerima kasih");
  const [msg, setMsg] = useState<string | null>(null);
  const [printMode, setPrintModeState] = useState<"browser" | "rawbt" | "bluetooth">("browser");

  // Bluetooth state
  const [btAvailable, setBtAvailable] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [btPrinterName, setBtPrinterName] = useState("");
  const [btLoading, setBtLoading] = useState(false);

  useEffect(() => {
    setPrintModeState(getPrintMode());
    setBtAvailable(isBluetoothAvailable());
    setBtConnected(isPrinterConnected());
    setBtPrinterName(getConnectedPrinterName());
  }, []);

  // Poll bluetooth status
  useEffect(() => {
    const interval = setInterval(() => {
      setBtConnected(isPrinterConnected());
      setBtPrinterName(getConnectedPrinterName());
    }, 2000);
    return () => clearInterval(interval);
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
      setMsg("Settings tersimpan.");
    } catch (e: any) {
      setMsg(e?.message ?? "Gagal simpan settings");
    }
  }

  function printHtml(html: string) {
    const w = window.open("", "_blank", "width=420,height=800");
    if (!w) {
      alert("Pop-up print diblokir. Izinkan pop-up lalu coba lagi.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async function handleConnectBluetooth() {
    setBtLoading(true);
    setMsg(null);
    try {
      const name = await connectPrinter();
      setBtConnected(true);
      setBtPrinterName(name);
      setMsg(`Printer "${name}" terhubung.`);
    } catch (e: any) {
      setMsg(e?.message || "Gagal konek printer.");
    } finally {
      setBtLoading(false);
    }
  }

  function handleDisconnectBluetooth() {
    disconnectPrinter();
    setBtConnected(false);
    setBtPrinterName("");
    setMsg("Printer disconnected.");
  }

  async function testPrint() {
    setMsg(null);

    const testData = {
      title: "TEST PRINT",
      storeName: settings.storeName || "TerraPOS",
      address: settings.address || "",
      footer: settings.footer || "Terima kasih.",
      orderNo: `TEST-${Date.now().toString().slice(-6)}`,
      dateText: new Date().toLocaleString("id-ID"),
      tableNo: "1",
      cashierEmail: settings.cashierName || email || "",
      paymentMethod: "CASH" as const,
      subtotal: 25000,
      discount: 0,
      total: 25000,
      paidAmount: 30000,
      items: [
        { name: "Nasi Goreng", qty: 1, price: 15000 },
        { name: "Kopi Susu", qty: 1, price: 10000 },
      ],
    };

    if (printMode === "bluetooth") {
      if (!btConnected) {
        setMsg("Printer belum terkonek. Klik 'Konek Printer' dulu.");
        return;
      }
      try {
        await btPrintReceipt({
          ...testData,
          cashierName: testData.cashierEmail,
        });
        setMsg("Test print bluetooth berhasil.");
      } catch (e: any) {
        setMsg(e?.message || "Gagal print bluetooth.");
      }
      return;
    }

    if (printMode === "rawbt") {
      const text = buildPlainReceipt(testData);
      sendToRawBT(text);
      return;
    }

    // Browser
    const html = receiptHTML(testData);
    localStorage.setItem("terrapos_last_receipt_html", html);
    printHtml(html);
  }

  async function printCustom() {
    const safe = (customText || "").trim();
    if (!safe) {
      alert("Teks kosong.");
      return;
    }

    if (printMode === "bluetooth") {
      if (!btConnected) {
        setMsg("Printer belum terkonek. Klik 'Konek Printer' dulu.");
        return;
      }
      try {
        await btPrintText(safe);
        setMsg("Print teks berhasil.");
      } catch (e: any) {
        setMsg(e?.message || "Gagal print.");
      }
      return;
    }

    if (printMode === "rawbt") {
      sendToRawBT(safe);
      return;
    }

    // Browser
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Print</title>
<style>@page{margin:10mm}body{font-family:monospace;color:#111}.wrap{max-width:320px;margin:0 auto;white-space:pre-wrap}</style>
</head><body><div class="wrap">${escapeHtml(safe)}</div><script>window.onload=()=>window.print()</script></body></html>`;
    localStorage.setItem("terrapos_last_receipt_html", html);
    printHtml(html);
  }

  function changeMode(mode: "browser" | "rawbt" | "bluetooth") {
    setPrintModeState(mode);
    setPrintMode(mode);
    const labels = { browser: "Browser", rawbt: "RawBT", bluetooth: "Bluetooth" };
    setMsg(`Mode print: ${labels[mode]}`);
  }

  if (loading || loadingRole) {
    return <TerraPage><div className="card">Loading...</div></TerraPage>;
  }

  return (
    <TerraPage>
      <style>{`
        .grid{ margin-top:14px; display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
        @media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }
        textarea{ width:100%; min-height:120px; }
        .bt-status{ margin-top:12px; padding:12px; border-radius:12px; border:1px solid var(--border); background:#fffaf5; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Printer</div>
            <div className="small">Tes cetak & pengaturan struk.</div>
            <div className="small">Tenant: {tenantId}</div>
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

      {/* MODE CETAK */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Mode Cetak</div>
        <div className="small" style={{ marginTop: 6 }}>
          Browser = dialog print. RawBT = via app RawBT. Bluetooth = langsung ke printer thermal.
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
          <button
            className={"btn " + (printMode === "bluetooth" ? "btn-primary" : "")}
            onClick={() => changeMode("bluetooth")}
            disabled={!btAvailable}
          >
            Bluetooth
          </button>
        </div>

        {!btAvailable && (
          <div className="small" style={{ marginTop: 8, color: "var(--danger)" }}>
            Web Bluetooth tidak tersedia. Gunakan Chrome di Android atau desktop.
          </div>
        )}

        {/* BLUETOOTH PANEL */}
        {printMode === "bluetooth" && (
          <div className="bt-status">
            <div className="row">
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>
                  {btConnected ? `Terhubung: ${btPrinterName}` : "Belum terhubung"}
                </div>
                <div className="small">
                  {btConnected
                    ? "Printer siap menerima perintah cetak."
                    : "Klik tombol di bawah untuk konek ke printer thermal Bluetooth."}
                </div>
              </div>
              <div className="spacer" />
              <div style={{ width: 12, height: 12, borderRadius: 999, background: btConnected ? "#22c55e" : "#ef4444" }} />
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              {!btConnected ? (
                <button className="btn btn-primary" onClick={handleConnectBluetooth} disabled={btLoading}>
                  {btLoading ? "Menghubungkan..." : "Konek Printer"}
                </button>
              ) : (
                <button className="btn btn-danger" onClick={handleDisconnectBluetooth}>
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid">
        {/* SETTINGS */}
        <div className="card">
          <div className="h1">Pengaturan Struk</div>
          <div className="small" style={{ marginTop: 6 }}>Dipakai di semua struk.</div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Nama Toko</div>
            <input className="input" value={settings.storeName} onChange={(e) => setSettings((p) => ({ ...p, storeName: e.target.value }))} disabled={!canEdit} />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Alamat</div>
            <input className="input" value={settings.address} onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))} disabled={!canEdit} />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Nama Kasir Default</div>
            <input className="input" value={settings.cashierName} onChange={(e) => setSettings((p) => ({ ...p, cashierName: e.target.value }))} disabled={!canEdit} />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Footer Struk</div>
            <input className="input" value={settings.footer} onChange={(e) => setSettings((p) => ({ ...p, footer: e.target.value }))} disabled={!canEdit} />
          </div>

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={saveSettings} disabled={!canEdit}>
            Simpan Settings
          </button>
        </div>

        {/* TEST PRINT */}
        <div className="card">
          <div className="h1">Tes Cetak</div>

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={testPrint}>
            Test Print Struk
          </button>

          <div style={{ marginTop: 14 }}>
            <div className="small">Cetak Teks Custom</div>
            <textarea className="input" value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Tulis teks..." />
          </div>

          <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={printCustom}>
            Print Teks Custom
          </button>

          <div className="small" style={{ marginTop: 14, lineHeight: 1.6 }}>
            <b>Tips:</b><br/>
            • <b>Bluetooth</b> — langsung ke printer, tanpa app tambahan. Paling stabil.<br/>
            • <b>RawBT</b> — perlu install app RawBT di Android.<br/>
            • <b>Browser</b> — pakai dialog print bawaan browser.
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
