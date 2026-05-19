"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { receiptHTML } from "@/lib/receipt";
import { buildPlainReceipt, getPrintMode, sendToRawBT, setPrintMode } from "@/lib/rawbt";
import * as NativePrinter from "@/lib/native-printer";
import * as WebBluetooth from "@/lib/bluetooth-printer";
import { useToast } from "@/components/Toast";
import { usePrinting } from "@/components/PrintingOverlay";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";

type ReceiptSettings = { storeName: string; address: string; footer: string; cashierName: string };
type PairedDevice = { name: string; address: string };

export default function PrinterPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();
  const toast = useToast();
  const { showPrinting, hidePrinting } = usePrinting();
  const canEdit = ["owner", "admin", "developer"].includes((role || "").toString().toLowerCase());

  const [settings, setSettings] = useState<ReceiptSettings>({ storeName: "TerraPOS", address: "", footer: "Terima kasih.", cashierName: "Kasir TerraPOS" });
  const [customText, setCustomText] = useState("Tes Printer TerraPOS\nTerima kasih");
  const [msg, setMsg] = useState<string | null>(null);
  const [printMode, setPrintModeState] = useState<"browser" | "rawbt" | "bluetooth">("browser");

  // Bluetooth state
  const [isNative, setIsNative] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [btPrinterName, setBtPrinterName] = useState("");
  const [btLoading, setBtLoading] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [showDevices, setShowDevices] = useState(false);

  useEffect(() => {
    setPrintModeState(getPrintMode());
    setIsNative(NativePrinter.isNative());
  }, []);

  // Auto-reconnect & check status
  useEffect(() => {
    if (!isNative) return;
    NativePrinter.autoReconnect().then((ok) => {
      if (ok) {
        NativePrinter.isConnected().then((s) => {
          setBtConnected(s.connected);
          setBtPrinterName(s.name);
        });
      }
    });
  }, [isNative]);

  // Poll status
  useEffect(() => {
    if (!isNative) return;
    const interval = setInterval(() => {
      NativePrinter.isConnected().then((s) => {
        setBtConnected(s.connected);
        setBtPrinterName(s.name);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isNative]);

  // Web Bluetooth fallback polling
  useEffect(() => {
    if (isNative || printMode !== "bluetooth") return;
    const interval = setInterval(() => {
      setBtConnected(WebBluetooth.isPrinterConnected());
      setBtPrinterName(WebBluetooth.getConnectedPrinterName());
    }, 2000);
    return () => clearInterval(interval);
  }, [isNative, printMode]);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d = snap.data() as any;
          setSettings({ storeName: (d.storeName || "TerraPOS").toString(), address: (d.address || "").toString(), footer: (d.footer || "Terima kasih.").toString(), cashierName: (d.cashierName || "Kasir TerraPOS").toString() });
        }
      } catch (e: any) { setMsg(e?.message ?? "Gagal load settings"); }
    })();
  }, [tenantId]);

  async function saveSettings() {
    if (!tenantId) return;
    try {
      setMsg(null);
      await setDoc(doc(db, `tenants/${tenantId}/settings/main`), { storeName: settings.storeName || "TerraPOS", address: settings.address || "", footer: settings.footer || "Terima kasih.", cashierName: settings.cashierName || "Kasir TerraPOS", updatedAt: new Date().toISOString() }, { merge: true });
      setMsg("Settings tersimpan.");
    } catch (e: any) { setMsg(e?.message ?? "Gagal simpan"); }
  }

  async function handleListDevices() {
    setBtLoading(true);
    setMsg(null);
    try {
      if (isNative) {
        const devices = await NativePrinter.listDevices();
        setPairedDevices(devices);
        setShowDevices(true);
        if (devices.length === 0) setMsg("Tidak ada printer paired. Pair dulu di Settings Bluetooth HP.");
      } else {
        // Web Bluetooth - langsung muncul dialog pilih
        const name = await WebBluetooth.connectPrinter();
        setBtConnected(true);
        setBtPrinterName(name);
        setMsg(`Printer "${name}" terhubung.`);
      }
    } catch (e: any) {
      setMsg(e?.message || "Gagal.");
    } finally { setBtLoading(false); }
  }

  async function handleConnectDevice(device: PairedDevice) {
    setBtLoading(true);
    setMsg(null);
    try {
      const result = await NativePrinter.connect(device.address);
      setBtConnected(true);
      setBtPrinterName(result.name || device.name);
      setShowDevices(false);
      setMsg(`Terhubung ke "${result.name || device.name}"`);
    } catch (e: any) {
      setMsg(e?.message || "Gagal konek.");
    } finally { setBtLoading(false); }
  }

  async function handleDisconnect() {
    try {
      if (isNative) await NativePrinter.disconnect();
      else WebBluetooth.disconnectPrinter();
      setBtConnected(false);
      setBtPrinterName("");
      setMsg("Printer disconnected.");
    } catch {}
  }

  async function testPrint() {
    setMsg(null);
    const testData = {
      title: "TEST PRINT", storeName: settings.storeName || "TerraPOS", address: settings.address || "", footer: settings.footer || "Terima kasih.",
      orderNo: `TEST-${Date.now().toString().slice(-6)}`, dateText: new Date().toLocaleString("id-ID"), tableNo: "1",
      cashierName: settings.cashierName || email || "", cashierEmail: settings.cashierName || email || "",
      paymentMethod: "CASH" as const, subtotal: 25000, discount: 0, total: 25000, paidAmount: 30000,
      items: [{ name: "Nasi Goreng", qty: 1, price: 15000 }, { name: "Kopi Susu", qty: 1, price: 10000 }],
    };

    try {
      if (printMode === "bluetooth") {
        if (!btConnected) { setMsg("Printer belum terkonek."); return; }
        showPrinting("Test print via Bluetooth...");
        if (isNative) await NativePrinter.printReceipt(testData);
        else await WebBluetooth.printReceipt(testData);
        hidePrinting();
        setMsg("Test print berhasil!");
        toast.success("Test print berhasil!");
      } else if (printMode === "rawbt") {
        sendToRawBT(buildPlainReceipt(testData));
        toast.success("Dikirim ke RawBT.");
      } else {
        const html = receiptHTML(testData);
        localStorage.setItem("terrapos_last_receipt_html", html);
        const w = window.open("", "_blank", "width=420,height=800");
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
      }
    } catch (e: any) { hidePrinting(); setMsg(e?.message || "Gagal print."); toast.error(e?.message || "Gagal print."); }
  }

  async function printCustom() {
    const safe = (customText || "").trim();
    if (!safe) { toast.warning("Teks kosong."); return; }
    setMsg(null);
    try {
      if (printMode === "bluetooth") {
        if (!btConnected) { setMsg("Printer belum terkonek."); return; }
        showPrinting("Mencetak via Bluetooth...");
        if (isNative) await NativePrinter.printText(safe);
        else await WebBluetooth.printText(safe);
        hidePrinting();
        setMsg("Print berhasil!");
        toast.success("Print berhasil!");
      } else if (printMode === "rawbt") {
        sendToRawBT(safe);
        toast.success("Dikirim ke RawBT.");
      } else {
        const html = `<!doctype html><html><head><meta charset="utf-8"/><style>@page{margin:10mm}body{font-family:monospace;white-space:pre-wrap;max-width:320px;margin:0 auto}</style></head><body>${escapeHtml(safe)}<script>window.onload=()=>window.print()</script></body></html>`;
        const w = window.open("", "_blank", "width=420,height=800");
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
      }
    } catch (e: any) { hidePrinting(); setMsg(e?.message || "Gagal print."); toast.error(e?.message || "Gagal print."); }
  }

  function changeMode(mode: "browser" | "rawbt" | "bluetooth") {
    setPrintModeState(mode);
    setPrintMode(mode);
    setMsg(`Mode: ${mode === "bluetooth" ? "Bluetooth" : mode === "rawbt" ? "RawBT" : "Browser"}`);
  }

  if (loading || loadingRole) return <TerraPage><SkeletonStyles /><PageSkeleton cards={3} /></TerraPage>;

  return (
    <TerraPage>
      <style>{`
        .grid{ margin-top:14px; display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
        @media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }
        textarea{ width:100%; min-height:120px; }
        .bt-panel{ margin-top:12px; padding:14px; border-radius:14px; border:1px solid var(--border); background:#fffaf5; }
        .device-list{ margin-top:10px; display:grid; gap:8px; }
        .device-item{ display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:#fff; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Printer</div>
            <div className="small">Bluetooth printer & pengaturan struk</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        </div>
      </div>

      {msg && <div className="card" style={{ marginTop: 14 }}><div style={{ fontWeight: 900 }}>{msg}</div></div>}

      {/* MODE */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Mode Cetak</div>
        <div className="small" style={{ marginTop: 4 }}>
          {isNative ? "APK mode — Bluetooth Classic (SPP) tersedia." : "Browser mode — pakai Web Bluetooth atau RawBT."}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className={"btn " + (printMode === "bluetooth" ? "btn-primary" : "")} onClick={() => changeMode("bluetooth")}>Bluetooth</button>
          <button className={"btn " + (printMode === "rawbt" ? "btn-primary" : "")} onClick={() => changeMode("rawbt")}>RawBT</button>
          <button className={"btn " + (printMode === "browser" ? "btn-primary" : "")} onClick={() => changeMode("browser")}>Browser</button>
        </div>

        {/* BLUETOOTH PANEL */}
        {printMode === "bluetooth" && (
          <div className="bt-panel">
            <div className="row">
              <div>
                <div style={{ fontWeight: 900 }}>{btConnected ? `Terhubung: ${btPrinterName}` : "Belum terhubung"}</div>
                <div className="small">{btConnected ? "Siap cetak." : isNative ? "Pilih printer dari daftar paired devices." : "Klik konek untuk pilih printer."}</div>
              </div>
              <div className="spacer" />
              <div style={{ width: 14, height: 14, borderRadius: 999, background: btConnected ? "#22c55e" : "#ef4444" }} />
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              {!btConnected ? (
                <button className="btn btn-primary" onClick={handleListDevices} disabled={btLoading}>
                  {btLoading ? "Loading..." : isNative ? "Pilih Printer" : "Konek Printer"}
                </button>
              ) : (
                <button className="btn btn-danger" onClick={handleDisconnect}>Disconnect</button>
              )}
            </div>

            {/* PAIRED DEVICES LIST (Native only) */}
            {showDevices && pairedDevices.length > 0 && (
              <div className="device-list">
                <div className="small" style={{ fontWeight: 800 }}>Pilih printer:</div>
                {pairedDevices.map((d) => (
                  <div key={d.address} className="device-item">
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{d.name}</div>
                      <div className="small">{d.address}</div>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleConnectDevice(d)} disabled={btLoading}>
                      Konek
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid">
        {/* SETTINGS */}
        <div className="card">
          <div className="h1">Pengaturan Struk</div>
          <div style={{ marginTop: 12 }}>
            <div className="small">Nama Toko</div>
            <input className="input" value={settings.storeName} onChange={(e) => setSettings((p) => ({ ...p, storeName: e.target.value }))} disabled={!canEdit} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="small">Alamat</div>
            <input className="input" value={settings.address} onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))} disabled={!canEdit} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="small">Nama Kasir</div>
            <input className="input" value={settings.cashierName} onChange={(e) => setSettings((p) => ({ ...p, cashierName: e.target.value }))} disabled={!canEdit} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="small">Footer</div>
            <input className="input" value={settings.footer} onChange={(e) => setSettings((p) => ({ ...p, footer: e.target.value }))} disabled={!canEdit} />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={saveSettings} disabled={!canEdit}>Simpan Settings</button>
        </div>

        {/* TEST */}
        <div className="card">
          <div className="h1">Tes Cetak</div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={testPrint}>Test Print Struk</button>
          <div style={{ marginTop: 14 }}>
            <div className="small">Teks Custom</div>
            <textarea className="input" value={customText} onChange={(e) => setCustomText(e.target.value)} />
          </div>
          <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={printCustom}>Print Teks Custom</button>
          <div className="small" style={{ marginTop: 14, lineHeight: 1.6 }}>
            <b>Bluetooth (APK)</b> — Bluetooth Classic, paling stabil. Seperti Majoo/LunaPos.<br/>
            <b>Bluetooth (Browser)</b> — Web Bluetooth BLE. Hanya Chrome.<br/>
            <b>RawBT</b> — Perlu app RawBT.<br/>
            <b>Browser</b> — Dialog print biasa.
          </div>
        </div>
      </div>
    </TerraPage>
  );
}

function escapeHtml(s: string) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;").replaceAll("\n", "<br/>");
}
