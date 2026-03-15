export type ReceiptItem = {
  name: string;
  qty: number;
  price: number;
  notes?: string;
};

export type ReceiptData = {
  storeName: string;
  address?: string;
  orderNo: string;
  dateText: string;
  tableNo?: string | null;
  cashierEmail?: string;
  paymentMethod: "CASH" | "QRIS";
  subtotal: number;
  discount: number;
  total: number;
  paidAmount?: number;
  items: ReceiptItem[];
  footer?: string;
  title?: string;
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function receiptHTML(d: ReceiptData) {
  const itemsHtml = d.items
    .map((it) => {
      const lineTotal = (it.price || 0) * (it.qty || 0);
      const notesHtml =
        (it.notes || "").trim()
          ? `<div style="opacity:.8;font-size:12px;">Catatan: ${escapeHtml(it.notes || "")}</div>`
          : "";

      return `
        <tr>
          <td style="padding:4px 0;">
            <div style="font-weight:700;">${escapeHtml(it.name)}</div>
            <div style="opacity:.8;font-size:12px;">${it.qty} x ${rupiah(it.price)}</div>
            ${notesHtml}
          </td>
          <td style="text-align:right;padding:4px 0;font-weight:700;">${rupiah(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  const change =
    d.paymentMethod === "CASH"
      ? Math.max(0, Number(d.paidAmount || 0) - Number(d.total || 0))
      : 0;

  const addressHtml = d.address?.trim()
    ? `<div class="muted">${escapeHtml(d.address.trim())}</div>`
    : ``;

  const footerText = (d.footer ?? "Terima kasih.").trim() || "Terima kasih.";
  const title = (d.title ?? "STRUK").trim() || "STRUK";

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} ${escapeHtml(d.orderNo)}</title>
  <style>
    @page { margin: 10mm; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; color:#111; }
    .wrap { max-width: 320px; margin: 0 auto; }
    .center { text-align:center; }
    .muted { opacity:.8; font-size:12px; }
    table { width:100%; border-collapse:collapse; }
    .line { border-top:1px dashed #333; margin:10px 0; }
    .total { font-size:16px; font-weight:900; }
    .badge { display:inline-block; padding:4px 8px; border:1px solid #333; border-radius:999px; font-size:12px; font-weight:900; margin-top:6px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      <div style="font-weight:900;font-size:18px;">${escapeHtml(d.storeName || "TerraPOS")}</div>
      ${addressHtml}
      <div class="badge">${escapeHtml(title)}</div>
      <div class="muted" style="margin-top:6px;">${escapeHtml(d.dateText)}</div>
      <div class="muted">Order: ${escapeHtml(d.orderNo)}</div>
      ${d.tableNo ? `<div class="muted">Meja: ${escapeHtml(String(d.tableNo))}</div>` : ``}
      ${d.cashierEmail ? `<div class="muted">Kasir: ${escapeHtml(String(d.cashierEmail))}</div>` : ``}
      <div class="muted">Metode: ${escapeHtml(d.paymentMethod)}</div>
    </div>

    <div class="line"></div>

    <table>
      ${itemsHtml}
    </table>

    <div class="line"></div>

    <table>
      <tr><td class="muted">Subtotal</td><td style="text-align:right;">${rupiah(d.subtotal)}</td></tr>
      <tr><td class="muted">Diskon</td><td style="text-align:right;">${rupiah(d.discount)}</td></tr>
      <tr><td style="font-weight:900;">Total</td><td style="text-align:right;" class="total">${rupiah(d.total)}</td></tr>
      ${
        d.paymentMethod === "CASH"
          ? `<tr><td class="muted">Bayar</td><td style="text-align:right;">${rupiah(Number(d.paidAmount || 0))}</td></tr>
             <tr><td class="muted">Kembalian</td><td style="text-align:right;">${rupiah(change)}</td></tr>`
          : ``
      }
    </table>

    <div class="line"></div>

    <div class="center muted">
      ${escapeHtml(footerText)}
    </div>
  </div>

  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>
  `;
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}