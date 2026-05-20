"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";

const functions = getFunctions();

export default function RefundPinPage() {
  const r = useRouter();
  const { tenantId, loading } = useTenant();
  const { role, loadingRole } = useRole();

  const [pinInput, setPinInput] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "">("");

  const isOwner = ["owner", "developer"].includes((role || "").toString().toLowerCase());

  async function saveRefundPin() {
    if (!tenantId) return;

    const nextPin = pinInput.trim();
    const confirm = confirmPin.trim();

    if (!nextPin) {
      setMsg("PIN refund baru wajib diisi.");
      setMsgType("error");
      return;
    }

    if (nextPin.length < 6) {
      setMsg("PIN refund minimal 6 digit.");
      setMsgType("error");
      return;
    }

    if (nextPin !== confirm) {
      setMsg("Konfirmasi PIN refund tidak cocok.");
      setMsgType("error");
      return;
    }

    setSaving(true);
    setMsg("");
    setMsgType("");

    try {
      const updateRefundPinFn = httpsCallable<
        { tenantId: string; refundPin: string },
        { ok: boolean }
      >(functions, "updateRefundPin");

      await updateRefundPinFn({
        tenantId,
        refundPin: nextPin,
      });

      setPinInput("");
      setConfirmPin("");
      setMsg("PIN refund berhasil diperbarui secara aman di server.");
      setMsgType("success");
      setTimeout(() => { setMsg(""); setMsgType(""); }, 3000);
    } catch (e: any) {
      setMsg("Gagal simpan PIN refund: " + (e?.message || "unknown"));
      setMsgType("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>Loading...</div>
        </div>
      </TerraPage>
    );
  }

  if (!isOwner) {
    return (
      <TerraPage>
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div className="h1">Akses Ditolak</div>
          <div className="small" style={{ marginTop: 8 }}>Hanya owner yang bisa mengatur PIN Refund.</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => r.push("/dashboard")}>Kembali ke Dashboard</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <style>{`
        .pin-page-card {
          max-width: 480px;
          margin: 0 auto;
        }
        .pin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .pin-form-group {
          margin-bottom: 16px;
        }
        .pin-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          margin-bottom: 6px;
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .pin-info {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: var(--radius-sm);
          background: var(--brandSoft);
          border: 1px solid var(--brand2);
          font-size: 13px;
          line-height: 1.6;
          color: var(--text);
        }
        .pin-msg {
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-weight: 700;
          font-size: 13px;
        }
        .pin-msg.success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #6ee7b7;
        }
        .pin-msg.error {
          background: #fee2e2;
          color: var(--danger);
          border: 1px solid #fca5a5;
        }
      `}</style>

      <div className="card pin-page-card">
        <div className="pin-header">
          <div>
            <div className="h1">Setting PIN Refund</div>
            <div className="small">Atur PIN untuk otorisasi refund order.</div>
          </div>
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        </div>

        <div className="pin-info">
          PIN refund digunakan untuk memverifikasi tindakan refund order. PIN disimpan secara aman di server dan tidak akan ditampilkan kembali setelah disimpan.
        </div>

        <div className="pin-form-group" style={{ marginTop: 20 }}>
          <label className="pin-label">PIN Refund Baru (min. 6 digit)</label>
          <input
            className="input"
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Masukkan PIN baru..."
            maxLength={20}
          />
        </div>

        <div className="pin-form-group">
          <label className="pin-label">Konfirmasi PIN Refund</label>
          <input
            className="input"
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Ulangi PIN refund..."
            maxLength={20}
          />
        </div>

        {msg && <div className={`pin-msg ${msgType}`}>{msg}</div>}

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 16 }}
          onClick={saveRefundPin}
          disabled={saving}
        >
          {saving ? "Menyimpan PIN..." : "Simpan PIN Refund"}
        </button>

        <div className="small" style={{ marginTop: 12, textAlign: "center" }}>
          PIN refund saat ini: <b>Dikelola Server</b> (tidak ditampilkan di client)
        </div>
      </div>
    </TerraPage>
  );
}
