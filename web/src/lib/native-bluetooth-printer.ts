/**
 * Native Bluetooth Printer via Capacitor (capacitor-bluetooth-serial)
 * Ini untuk APK native, bukan Web Bluetooth
 * Konek langsung ke printer thermal ESC/POS via Bluetooth serial
 */

import { Capacitor } from "@capacitor/core";

// Dynamic import untuk plugin (hanya jalan di native)
let BluetoothSerial: any = null;

async function getPlugin() {
  if (BluetoothSerial) return BluetoothSerial;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import("capacitor-bluetooth-serial");
    BluetoothSerial = mod.BluetoothSerial;
    return BluetoothSerial;
  } catch {
    return null;
  }
}

// ESC/POS Commands
const ESC = "\x1b";
const GS = "\x1d";
const LF = "\x0a";

const CMD = {
  INIT: ESC + "@",
  ALIGN_CENTER: ESC + "a" + "\x01",
  ALIGN_LEFT: ESC + "a" + "\x00",
  BOLD_ON: ESC + "E" + "\x01",
  BOLD_OFF: ESC + "E" + "\x00",
  DOUBLE_WIDTH: GS + "!" + "\x10",
  NORMAL_SIZE: GS + "!" + "\x00",
  CUT: GS + "V" + "\x00",
  FEED: ESC + "d" + "\x04",
};

export type BluetoothDevice = {
  name: string;
  address: string;
  id: string;
};

let connectedAddress: string | null = null;
let connectedName: string | null = null;

/**
 * Cek apakah jalan di native platform
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Cek apakah printer terkonek
 */
export function isConnected(): boolean {
  return connectedAddress !== null;
}

/**
 * Nama printer terkonek
 */
export function getConnectedName(): string {
  return connectedName || "";
}

/**
 * List paired Bluetooth devices
 */
export async function listDevices(): Promise<BluetoothDevice[]> {
  const plugin = await getPlugin();
  if (!plugin) return [];

  try {
    const result = await plugin.list();
    return (result?.devices || []).map((d: any) => ({
      name: d.name || "Unknown",
      address: d.address || d.id || "",
      id: d.address || d.id || "",
    }));
  } catch (e: any) {
    throw new Error(e?.message || "Gagal list Bluetooth devices.");
  }
}

/**
 * Konek ke printer by address
 */
export async function connect(address: string, name?: string): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) throw new Error("Bluetooth plugin tidak tersedia.");

  try {
    await plugin.connect({ address });
    connectedAddress = address;
    connectedName = name || address;

    // Simpan ke localStorage untuk auto-reconnect
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("terrapos_bt_address", address);
      localStorage.setItem("terrapos_bt_name", name || address);
    }
  } catch (e: any) {
    connectedAddress = null;
    connectedName = null;
    throw new Error(e?.message || "Gagal konek ke printer.");
  }
}

/**
 * Disconnect
 */
export async function disconnect(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  try {
    await plugin.disconnect();
  } catch {}
  connectedAddress = null;
  connectedName = null;
}

/**
 * Auto-reconnect ke printer terakhir
 */
export async function autoReconnect(): Promise<boolean> {
  if (typeof localStorage === "undefined") return false;
  const address = localStorage.getItem("terrapos_bt_address");
  const name = localStorage.getItem("terrapos_bt_name");
  if (!address) return false;

  try {
    await connect(address, name || undefined);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kirim raw string ke printer
 */
async function sendRaw(data: string): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) throw new Error("Plugin tidak tersedia.");
  if (!connectedAddress) throw new Error("Printer belum terkonek.");

  try {
    await plugin.write({ value: data });
  } catch (e: any) {
    throw new Error(e?.message || "Gagal kirim ke printer.");
  }
}

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function padRight(text: string, len: number) {
  const t = String(text ?? "").slice(0, len);
  return t + " ".repeat(Math.max(0, len - t.length));
}

function padLeft(text: string, len: number) {
  const t = String(text ?? "").slice(0, len);
  return " ".repeat(Math.max(0, len - t.length)) + t;
}

function center(text: string, width = 32) {
  const t = String(text ?? "").slice(0, width);
  const total = Math.max(0, width - t.length);
  const left = Math.floor(total / 2);
  return " ".repeat(left) + t;
}

function line(width = 32) {
  return "-".repeat(width);
}

export type ReceiptData = {
  storeName: string;
  address?: string;
  footer?: string;
  title?: string;
  orderNo: string;
  dateText: string;
  tableNo?: string | null;
  cashierName?: string;
  paymentMethod?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount?: number | null;
  items: { name: string; qty: number; price: number; notes?: string }[];
};

/**
 * Print struk via Bluetooth native (ESC/POS)
 */
export async function printReceipt(data: ReceiptData): Promise<void> {
  let output = "";

  // Init
  output += CMD.INIT;

  // Header
  output += CMD.ALIGN_CENTER;
  output += CMD.BOLD_ON;
  output += CMD.DOUBLE_WIDTH;
  output += (data.storeName || "TerraPOS") + LF;
  output += CMD.NORMAL_SIZE;
  output += CMD.BOLD_OFF;

  if (data.address?.trim()) {
    output += data.address.trim() + LF;
  }
  output += (data.title || "STRUK") + LF;

  // Info
  output += CMD.ALIGN_LEFT;
  output += line() + LF;
  output += `Waktu : ${data.dateText}` + LF;
  output += `Order : ${data.orderNo}` + LF;
  if (data.tableNo) output += `Meja  : ${data.tableNo}` + LF;
  if (data.cashierName) output += `Kasir : ${data.cashierName}` + LF;
  if (data.paymentMethod) output += `Bayar : ${data.paymentMethod}` + LF;
  output += line() + LF;

  // Items
  for (const it of data.items || []) {
    const itemName = it.notes?.trim() ? `${it.name} (${it.notes})` : it.name;
    output += itemName + LF;
    const itemTotal = (it.price || 0) * (it.qty || 0);
    output += `${padRight(`${it.qty} x ${rupiah(it.price)}`, 20)}${padLeft(rupiah(itemTotal), 12)}` + LF;
  }

  // Totals
  output += line() + LF;
  output += `${padRight("Subtotal", 20)}${padLeft(rupiah(data.subtotal || 0), 12)}` + LF;

  if (data.discount > 0) {
    output += `${padRight("Diskon", 20)}${padLeft(rupiah(data.discount), 12)}` + LF;
  }

  output += CMD.BOLD_ON;
  output += `${padRight("TOTAL", 20)}${padLeft(rupiah(data.total || 0), 12)}` + LF;
  output += CMD.BOLD_OFF;

  if (data.paymentMethod === "CASH" && data.paidAmount) {
    output += `${padRight("Bayar", 20)}${padLeft(rupiah(data.paidAmount), 12)}` + LF;
    const change = Math.max(0, data.paidAmount - (data.total || 0));
    output += `${padRight("Kembalian", 20)}${padLeft(rupiah(change), 12)}` + LF;
  }

  // Footer
  output += line() + LF;
  output += CMD.ALIGN_CENTER;
  output += (data.footer || "Terima kasih.") + LF;

  // Feed & Cut
  output += CMD.FEED;
  output += CMD.CUT;

  await sendRaw(output);
}

/**
 * Print teks biasa
 */
export async function printText(text: string): Promise<void> {
  let output = "";
  output += CMD.INIT;
  output += CMD.ALIGN_LEFT;
  output += text + LF;
  output += CMD.FEED;
  output += CMD.CUT;
  await sendRaw(output);
}
