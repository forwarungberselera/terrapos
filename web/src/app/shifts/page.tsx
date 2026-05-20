"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { calculateShiftTotals, isShiftPermissionError, normalizeShift, ShiftRecord, toDateSafe } from "@/lib/shifts";
import { getPrintMode, sendToRawBT } from "@/lib/rawbt";
import { useToast } from "@/components/Toast";
import { usePrinting } from "@/components/PrintingOverlay";
import { logAudit } from "@/lib/audit";

type Order = {
  id: string;
  status?: string;
  total?: number;
  paymentMethod?: "CASH" | "QRIS" | null;
  shiftId?: string | null;
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function formatDateTime(d: Date | null) {
  if (!d) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ShiftsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();
  const toast = useToast();
  const { showPrinting, hidePrinting } = usePrinting();

  const canUse = ["owner", "admin", "developer"].includes((role || "").toString().toLowerCase());

  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [shiftAccessBlocked, setShiftAccessBlocked] = useState(false);

  const [openingCash, setOpeningCash] = useState("0");
  const [openingNote, setOpeningNote] = useState("");
  const [closingCashActual, setClosingCashActual] = useState("0");
  const [closingNote, setClosingNote] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    const qy = query(collection(db, `tenants/${tenantId}/shifts`), orderBy("openedAt", "desc"), limit(20));
    return onSnapshot(
      qy,
      (snap) => {
        setShiftAccessBlocked(false);
        setShifts(snap.docs.map((item) => normalizeShift(item.id, item.data())));
      },
      (e) => {
        if (isShiftPermissionError(e)) {
          setShiftAccessBlocked(true);
          setErr(null);
          return;
        }
        setErr(e.message);
      }
    );
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const qy = query(collection(db, `tenants/${tenantId}/orders`), orderBy("createdAt", "desc"), limit(300));
    return onSnapshot(
      qy,
      (snap) => {
        setOrders(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              status: data.status || "OPEN",
              total: Number(data.total || 0),
              paymentMethod: data.paymentMethod ?? null,
              shiftId: data.shiftId ?? null,
            };
          })
        );
      },
      (e) => setErr(e.message)
    );
  }, [tenantId]);

  const activeShift = useMemo(() => {
    return shifts.find((shift) => shift.status === "OPEN") || null;
  }, [shifts]);

  const activeSummary = useMemo(() => {
    if (!activeShift) return null;
    const totals = calculateShiftTotals(orders, activeShift.id);
    return {
      ...totals,
      expectedCash: Number(activeShift.openingCash || 0) + totals.cashSales,
    };
  }, [activeShift, orders]);

  async function openShift() {
    try {
      if (!tenantId) return;
      if (activeShift) {
        setMsg("Masih ada shift yang OPEN. Tutup dulu shift aktif sebelum buka shift baru.");
        return;
      }

      setSaving(true);
      setMsg("");

      await addDoc(collection(db, `tenants/${tenantId}/shifts`), {
        status: "OPEN",
        openedByUid: auth.currentUser?.uid || "",
        openedByEmail: email || "",
        openingCash: Number(openingCash || 0),
        noteOpen: openingNote.trim(),
        cashSales: 0,
        qrisSales: 0,
        totalSales: 0,
        orderCount: 0,
        openedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setOpeningCash("0");
      setOpeningNote("");
      setMsg("Shift berhasil dibuka.");

      logAudit(tenantId, {
        action: "SHIFT_OPEN",
        userEmail: email || "",
        description: `Buka shift baru (kas awal: Rp ${Number(openingCash || 0).toLocaleString("id-ID")})`,
        metadata: { openingCash: Number(openingCash || 0) },
      });
    } catch (e: any) {
      setMsg(e?.message || "Gagal buka shift.");
    } finally {
      setSaving(false);
    }
  }

  async function closeShift() {
    try {
      if (!tenantId || !activeShift || !activeSummary) return;

      setSaving(true);
      setMsg("");

      const actual = Number(closingCashActual || 0);
      const expected = activeSummary.expectedCash;

      await updateDoc(doc(db, `tenants/${tenantId}/shifts/${activeShift.id}`), {
        status: "CLOSED",
        closedByUid: auth.currentUser?.uid || "",
        closedByEmail: email || "",
        closingCashExpected: expected,
        closingCashActual: actual,
        variance: actual - expected,
        cashSales: activeSummary.cashSales,
        qrisSales: activeSummary.qrisSales,
        totalSales: activeSummary.totalSales,
        orderCount: activeSummary.orderCount,
        noteClose: closingNote.trim(),
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setClosingCashActual("0");
      setClosingNote("");
      setMsg("Shift berhasil ditutup.");

      logAudit(tenantId, {
        action: "SHIFT_CLOSE",
        userEmail: email || "",
        description: `Tutup shift (omzet: Rp ${activeSummary.totalSales.toLocaleString("id-ID")}, ${activeSummary.orderCount} transaksi)`,
        metadata: {
          shiftId: activeShift.id,
          totalSales: activeSummary.totalSales,
          orderCount: activeSummary.orderCount,
          variance: actual - expected,
        },
      });

      // Auto-print laporan tutup shift
      printShiftReport({
        openedByEmail: activeShift.openedByEmail || "-",
        openedAt: toDateSafe(activeShift.openedAt),
        closedAt: new Date(),
        openingCash: Number(activeShift.openingCash || 0),
        cashSales: activeSummary.cashSales,
        qrisSales: activeSummary.qrisSales,
        totalSales: activeSummary.totalSales,
        orderCount: activeSummary.orderCount,
        expectedCash: expected,
        actualCash: actual,
        variance: actual - expected,
        closingNote: closingNote.trim(),
      });
    } catch (e: any) {
      setMsg(e?.message || "Gagal tutup shift.");
    } finally {
      setSaving(false);
    }
  }

  function printShiftReport(data: {
    openedByEmail: string;
    openedAt: Date | null;
    closedAt: Date | null;
    openingCash: number;
    cashSales: number;
    qrisSales: number;
    totalSales: number;
    orderCount: number;
    expectedCash: number;
    actualCash: number;
    variance: number;
    closingNote: string;
  }) {
    const lines: string[] = [];
    lines.push("================================");
    lines.push("     LAPORAN TUTUP SHIFT");
    lines.push("================================");
    lines.push("");
    lines.push(`Kasir    : ${data.openedByEmail}`);
    lines.push(`Buka     : ${data.openedAt ? data.openedAt.toLocaleString("id-ID") : "-"}`);
    lines.push(`Tutup    : ${data.closedAt ? data.closedAt.toLocaleString("id-ID") : "-"}`);
    lines.push("--------------------------------");
    lines.push(`Kas Awal       : Rp ${rupiah(data.openingCash)}`);
    lines.push(`Cash Sales     : Rp ${rupiah(data.cashSales)}`);
    lines.push(`QRIS Sales     : Rp ${rupiah(data.qrisSales)}`);
    lines.push(`Total Sales    : Rp ${rupiah(data.totalSales)}`);
    lines.push(`Jumlah Order   : ${data.orderCount}`);
    lines.push("--------------------------------");
    lines.push(`Expected Kas   : Rp ${rupiah(data.expectedCash)}`);
    lines.push(`Kas Aktual     : Rp ${rupiah(data.actualCash)}`);
    lines.push(`Selisih        : Rp ${rupiah(data.variance)}`);
    if (data.closingNote) {
      lines.push("--------------------------------");
      lines.push(`Catatan: ${data.closingNote}`);
    }
    lines.push("================================");
    lines.push("");

    const text = lines.join("\n");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Laporan Tutup Shift</title>
<style>@page{margin:10mm}body{font-family:ui-monospace,Menlo,Consolas,monospace;max-width:320px;margin:0 auto;white-space:pre-wrap;line-height:1.6;font-size:13px;}</style>
</head><body>${text.replace(/\n/g, "<br>")}<script>window.onload=()=>{window.print()}</script></body></html>`;

    const mode = getPrintMode();

    if (mode === "bluetooth") {
      (async () => {
        try {
          showPrinting("Mencetak laporan shift...");
          const NativePrinter = await import("@/lib/native-printer");
          if (NativePrinter.isNative()) {
            const status = await NativePrinter.isConnected();
            if (!status.connected) await NativePrinter.autoReconnect();
            await NativePrinter.printText(text);
            toast.success("Laporan shift berhasil dicetak!");
          } else {
            const WebBT = await import("@/lib/bluetooth-printer");
            if (!WebBT.isPrinterConnected()) { toast.error("Printer belum terkonek."); hidePrinting(); return; }
            await WebBT.printText(text);
            toast.success("Laporan shift berhasil dicetak!");
          }
        } catch (e: any) { toast.error("Gagal print: " + (e?.message || "")); } finally { hidePrinting(); }
      })();
      return;
    }

    if (mode === "rawbt") {
      sendToRawBT(text);
      toast.success("Laporan shift dikirim ke RawBT.");
      return;
    }

    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) { toast.error("Pop-up print diblokir browser."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  if (!canUse) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman shift hanya untuk owner/admin.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/dashboard")}>
            Kembali
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={1180}>
      <style>{`
        .grid{ margin-top:14px; display:grid; grid-template-columns: 1.1fr .9fr; gap:14px; }
        @media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }
        .stats{ margin-top:12px; display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; }
        @media (max-width: 700px){ .stats{ grid-template-columns: 1fr; } }
        .statbox{ border:1px solid var(--border); border-radius:16px; padding:14px; background:var(--brandSoft); }
        .statlabel{ font-size:12px; color:var(--muted); font-weight:700; }
        .statvalue{ margin-top:6px; font-size:22px; font-weight:900; }
        .history{ margin-top:12px; display:grid; gap:12px; }
        .history-card{ border:1px solid var(--border); border-radius:16px; padding:14px; background:var(--panel); }
        .badge{ display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid var(--border); font-size:12px; font-weight:900; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Shift Kasir</div>
            <div className="small">Kelola buka shift, tutup shift, dan rekap kas per sesi kasir.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        </div>
        {shiftAccessBlocked && (
          <div style={{ marginTop: 12, color: "var(--warning)", fontWeight: 800 }}>
            Fitur shift belum bisa dipakai karena akses Firestore untuk koleksi shift belum diizinkan di project Firebase ini.
          </div>
        )}
        {err && <div style={{ marginTop: 12, color: "var(--danger)", fontWeight: 900 }}>{err}</div>}
        {msg && <div style={{ marginTop: 12, fontWeight: 800 }}>{msg}</div>}
      </div>

      {shiftAccessBlocked ? null : (

      <div className="grid">
        <div className="card">
          <div className="row">
            <div className="h1">Shift Aktif</div>
            <div className="spacer" />
            <span className="badge" style={{ background: activeShift ? "var(--brandSoft)" : "var(--input-bg)" }}>
              {activeShift ? "OPEN" : "BELUM ADA SHIFT"}
            </span>
          </div>

          {activeShift && activeSummary ? (
            <>
              <div className="small" style={{ marginTop: 10 }}>
                Dibuka oleh <b>{activeShift.openedByEmail || "-"}</b> pada <b>{formatDateTime(toDateSafe(activeShift.openedAt))}</b>
              </div>
              {(activeShift.noteOpen || "").trim() && (
                <div className="small" style={{ marginTop: 8 }}>
                  Catatan buka: <b>{activeShift.noteOpen}</b>
                </div>
              )}

              <div className="stats">
                <div className="statbox">
                  <div className="statlabel">Kas Awal</div>
                  <div className="statvalue">Rp {rupiah(activeShift.openingCash || 0)}</div>
                </div>
                <div className="statbox">
                  <div className="statlabel">Cash Sales</div>
                  <div className="statvalue">Rp {rupiah(activeSummary.cashSales)}</div>
                </div>
                <div className="statbox">
                  <div className="statlabel">QRIS Sales</div>
                  <div className="statvalue">Rp {rupiah(activeSummary.qrisSales)}</div>
                </div>
                <div className="statbox">
                  <div className="statlabel">Total Sales / Order</div>
                  <div className="statvalue">Rp {rupiah(activeSummary.totalSales)} / {activeSummary.orderCount}</div>
                </div>
              </div>

              <div className="card" style={{ marginTop: 14, padding: 14 }}>
                <div className="small">Expected Kas Akhir</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: "var(--brand)" }}>
                  Rp {rupiah(activeSummary.expectedCash)}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="small">Kas Aktual Saat Tutup Shift</div>
                  <input
                    className="input"
                    type="number"
                    value={closingCashActual}
                    onChange={(e) => setClosingCashActual(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="small">Catatan Tutup Shift</div>
                  <textarea
                    className="input"
                    style={{ minHeight: 90 }}
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    placeholder="Contoh: serah terima kas, selisih kecil, catatan operasional."
                  />
                </div>

                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={closeShift} disabled={saving}>
                  {saving ? "Menyimpan..." : "Tutup Shift"}
                </button>
              </div>
            </>
          ) : (
            <div className="card" style={{ marginTop: 14, padding: 14 }}>
              <div className="small">Belum ada shift aktif. Buka shift dulu sebelum mulai transaksi kasir.</div>

              <div style={{ marginTop: 12 }}>
                <div className="small">Kas Awal</div>
                <input
                  className="input"
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="small">Catatan Buka Shift</div>
                <textarea
                  className="input"
                  style={{ minHeight: 90 }}
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  placeholder="Contoh: kas awal laci, operator jaga pagi, catatan penting."
                />
              </div>

              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openShift} disabled={saving}>
                {saving ? "Menyimpan..." : "Buka Shift"}
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="h1">Riwayat Shift</div>
          <div className="small" style={{ marginTop: 6 }}>
            Menampilkan sesi shift terbaru beserta ringkasan kas dan omzet.
          </div>

          <div className="history">
            {shifts.slice(0, 12).map((shift) => (
              <div key={shift.id} className="history-card">
                <div className="row">
                  <div style={{ fontWeight: 900 }}>{shift.openedByEmail || "-"}</div>
                  <div className="spacer" />
                  <span className="badge" style={{ background: shift.status === "OPEN" ? "var(--brandSoft)" : "var(--input-bg)" }}>
                    {shift.status}
                  </span>
                </div>

                <div className="small" style={{ marginTop: 8 }}>
                  Mulai: <b>{formatDateTime(toDateSafe(shift.openedAt))}</b>
                </div>
                <div className="small">
                  Selesai: <b>{formatDateTime(toDateSafe(shift.closedAt))}</b>
                </div>
                <div className="small">
                  Kas awal: <b>Rp {rupiah(shift.openingCash || 0)}</b>
                </div>
                <div className="small">
                  Sales: <b>Rp {rupiah(shift.totalSales || 0)}</b> • Order: <b>{shift.orderCount || 0}</b>
                </div>
                <div className="small">
                  Expected: <b>Rp {rupiah(shift.closingCashExpected || 0)}</b> • Aktual: <b>Rp {rupiah(shift.closingCashActual || 0)}</b>
                </div>
                <div className="small">
                  Selisih: <b>Rp {rupiah(shift.variance || 0)}</b>
                </div>
              </div>
            ))}

            {shifts.length === 0 && (
              <div className="small">Belum ada riwayat shift.</div>
            )}
          </div>
        </div>
      </div>
      )}
    </TerraPage>
  );
}
