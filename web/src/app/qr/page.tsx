"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { QRCodeCanvas } from "qrcode.react";

export default function QRPage() {
  const router = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const roleLower = (role || "").toString().toLowerCase();
  const canView = roleLower === "owner" || roleLower === "admin";

  const [table, setTable] = useState("1");

  // ✅ ini kuncinya: origin hanya dibuat setelah halaman jalan di browser
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = useMemo(() => {
    if (!origin) return "";
    return `${origin}/pos?table=${encodeURIComponent(table)}`;
  }, [origin, table]);

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  if (!canView) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">QR hanya untuk owner/admin.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => router.push("/pos")}>
            Kembali ke POS
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <style>{`
        .qrbox{ display:grid; place-items:center; margin-top:14px; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">QR Meja</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">User: {email || "-"}</div>
            <div className="small">Role: <b>{role || "-"}</b></div>
          </div>

          <div className="spacer" />

          <button className="btn" onClick={() => router.push("/dashboard")}>Dashboard</button>
          <button className="btn" onClick={() => router.push("/pos")}>POS</button>
          <button className="btn" onClick={() => router.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => router.push("/reports")}>Reports</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="small">Nomor Meja</div>
        <input
          className="input"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder="contoh: 1"
        />

        <div className="qrbox">
          {/* kalau origin belum siap, tetap render QR dengan value placeholder agar tidak error */}
          <QRCodeCanvas value={link || "loading"} size={240} />
        </div>

        <div className="small" style={{ marginTop: 10, wordBreak: "break-all" }}>
          Link: <b>{link || "memuat..."}</b>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={!link}
            onClick={() => {
              navigator.clipboard.writeText(link);
              alert("Link disalin.");
            }}
          >
            Copy Link
          </button>

          <button
            className="btn"
            style={{ width: "100%" }}
            disabled={!link}
            onClick={() => window.open(link, "_blank")}
          >
            Test POS
          </button>
        </div>
      </div>
    </TerraPage>
  );
}