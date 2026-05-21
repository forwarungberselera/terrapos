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
  paymentMethod?: "CASH" | "QRIS" | null;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount?: number | null;
  items: ReceiptItem[];
  footer?: string;
  title?: string;
  isCopy?: boolean;
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

  const footerText = (d.footer ?? "Terima kasih.").trim() || "Terima kasih.";
  const title = (d.title ?? "STRUK").trim() || "STRUK";

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} ${escapeHtml(d.orderNo)}</title>
  <style>
    @page { margin: 8mm; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      color: #111;
      margin: 0;
      padding: 0;
    }
    .wrap { max-width: 320px; margin: 0 auto; padding: 8px 0; }
    .center { text-align: center; }
    .muted { opacity: .8; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    .line { border-top: 1px dashed #333; margin: 10px 0; }
    .total { font-size: 18px; font-weight: 900; }
    .badge { display: inline-block; padding: 4px 10px; border: 2px solid #111; border-radius: 999px; font-size: 12px; font-weight: 900; margin-top: 8px; letter-spacing: 0.5px; }
    .store-name {
      font-weight: 900;
      font-size: 22px;
      letter-spacing: -0.5px;
      line-height: 1.2;
      margin-bottom: 4px;
    }
    .store-address {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .info-row {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      <div class="store-name">${escapeHtml(d.storeName || "TerraPOS")}</div>
      ${d.address?.trim() ? `<div class="store-address">${escapeHtml(d.address.trim())}</div>` : ``}
      <div class="badge">${escapeHtml(title)}</div>
      ${d.isCopy ? `<div style="margin-top:6px;font-weight:900;font-size:14px;color:#666;">*** COPY ***</div>` : ``}
    </div>

    <div class="line"></div>

    <div class="center">
      <div class="info-row">${escapeHtml(d.dateText)}</div>
      <div class="info-row">Order: <b>${escapeHtml(d.orderNo)}</b></div>
      ${d.tableNo ? `<div class="info-row">Meja: <b>${escapeHtml(String(d.tableNo))}</b></div>` : ``}
      ${d.cashierEmail ? `<div class="info-row">Kasir: ${escapeHtml(String(d.cashierEmail))}</div>` : ``}
      ${d.paymentMethod ? `<div class="info-row">Metode: <b>${escapeHtml(d.paymentMethod)}</b></div>` : ``}
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

    <div class="center" style="padding:4px 0;">
      <div style="font-size:12px;opacity:0.8;">${escapeHtml(footerText)}</div>
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
