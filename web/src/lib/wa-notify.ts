/**
 * ============================================================
 * TerraPOS - WhatsApp Order Notification
 * ============================================================
 * 
 * Sends WhatsApp notification to owner/staff when new QR order arrives.
 * Uses wa.me API (no backend needed, opens WA with pre-filled message).
 * 
 * For automated sending (without user interaction), use:
 * - WhatsApp Business API (paid)
 * - Or a webhook service like Fonnte/Wablas (affordable for UMKM)
 * 
 * Config stored in: tenants/{tenantId}/settings/main
 *   - waNotifyNumber: string (format: 628xxx)
 *   - waNotifyEnabled: boolean
 * ============================================================
 */

export type WAOrderData = {
  orderNo: string;
  tableNo: string | null;
  customerName: string | null;
  items: { name: string; qty: number; price: number }[];
  total: number;
  source: string;
};

/**
 * Format order data into WhatsApp message text
 */
export function formatWAOrderMessage(data: WAOrderData, storeName: string): string {
  const lines: string[] = [];
  
  lines.push(`🔔 *PESANAN BARU!*`);
  lines.push(`📋 ${data.orderNo}`);
  lines.push(``);
  
  if (data.tableNo) lines.push(`🪑 Meja: *${data.tableNo}*`);
  if (data.customerName) lines.push(`👤 Customer: *${data.customerName}*`);
  if (data.source === "customer_qr") lines.push(`📱 Sumber: QR Scan`);
  lines.push(``);
  
  lines.push(`--- ITEM ---`);
  data.items.forEach((item) => {
    lines.push(`• ${item.name} x${item.qty} = Rp ${item.price * item.qty}`);
  });
  lines.push(``);
  
  lines.push(`💰 *TOTAL: Rp ${new Intl.NumberFormat("id-ID").format(data.total)}*`);
  lines.push(``);
  lines.push(`— ${storeName}`);
  
  return lines.join("\n");
}

/**
 * Generate WhatsApp API URL (wa.me link)
 */
export function generateWALink(phoneNumber: string, message: string): string {
  // Normalize phone number
  let phone = phoneNumber.replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.slice(1);
  if (!phone.startsWith("62")) phone = "62" + phone;
  
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

/**
 * Send WA notification (opens new tab/window with pre-filled WA message)
 * For fully automated sending, integrate with Fonnte/Wablas API
 */
export function sendWANotification(phoneNumber: string, message: string): void {
  const url = generateWALink(phoneNumber, message);
  window.open(url, "_blank");
}

/**
 * Auto-send via webhook (supports multiple providers)
 * - Open-WA: self-hosted, gratis (open-wa.org)
 * - Fonnte: berbayar (fonnte.id)
 * - Wablas: berbayar (wablas.com)
 */
export async function sendWAWebhook(
  phoneNumber: string,
  message: string,
  apiUrl?: string,
  apiToken?: string,
  mode?: string
): Promise<boolean> {
  if (!apiUrl || !apiToken) return false;
  
  let phone = phoneNumber.replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.slice(1);
  if (!phone.startsWith("62")) phone = "62" + phone;
  
  try {
    let headers: any = { "Content-Type": "application/json" };
    let body: string;

    if (mode === "openwa") {
      // Open-WA format: chatId = "628xxx@c.us"
      headers["X-API-Key"] = apiToken;
      body = JSON.stringify({ chatId: `${phone}@c.us`, text: message });
    } else if (mode === "wablas") {
      // Wablas format
      headers["Authorization"] = apiToken;
      body = JSON.stringify({ phone, message });
    } else {
      // Fonnte format (default)
      headers["Authorization"] = apiToken;
      body = JSON.stringify({ target: phone, message });
    }

    const res = await fetch(apiUrl, { method: "POST", headers, body });
    return res.ok;
  } catch {
    return false;
  }
}
