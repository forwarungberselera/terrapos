"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { useLevel } from "@/hooks/useLevel";
import dynamic from "next/dynamic";
import { useToast } from "@/components/Toast";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeCanvas),
  { ssr: false, loading: () => <div style={{ width: 240, height: 240, background: "var(--input-bg)", borderRadius: 12 }} /> }
);

export default function QRPage() {
  const router = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();
  const { canAccess: canAccessLevel } = useLevel();
  const toast = useToast();

  const roleLower = (role || "").toString().toLowerCase();
  const canView = roleLower === "owner" || roleLower === "admin" || roleLower === "developer";

  const [table, setTable] = useState("1");

  // ✅ ini kuncinya: origin hanya dibuat setelah halaman jalan di browser
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Link untuk kasir (POS internal)
  const link = useMemo(() => {
    if (!origin) return "";
    return `${origin}/pos?table=${encodeURIComponent(table)}`;
  }, [origin, table]);

  // Link untuk customer (menu publik)
  const customerLink = useMemo(() => {
    if (!origin || !tenantId) return "";
    return `${origin}/menu/${tenantId}?table=${encodeURIComponent(table)}`;
  }, [origin, tenantId, table]);

  if (loading || loadingRole) {
    return (
      <TerraPage>
        <div className="card">Loading...</div>
      </TerraPage>
    );
  }

  if (!canAccessLevel("qr")) {
    return (
      <TerraPage>
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>&#128274;</div>
          <div className="h1">Fitur Premium</div>
          <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
            Fitur ini tersedia untuk paket <b>Core</b> atau lebih tinggi.
            Upgrade paket Anda untuk mengakses fitur ini.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.push("/dashboard")}>
            Kembali ke Dashboard
          </button>
        </div>
      </TerraPage>
    );
  }

  if (!canView) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">QR hanya untuk owner/admin.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => router.push("/dashboard")}>
            Kembali ke Dashboard
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

          <button className="btn" onClick={() => router.push("/tables")} style={{ marginRight: 6 }}>
            Kelola Meja
          </button>
          <button className="btn" onClick={() => router.push("/dashboard")}>Dashboard</button>
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

        {/* QR untuk Customer (Menu Publik) */}
        <div style={{ marginTop: 16 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>
            &#128722; QR Customer (Self-Order)
          </div>
          <div className="qrbox">
            <QRCodeCanvas value={customerLink || "loading"} size={240} />
          </div>
          <div className="small" style={{ marginTop: 10, wordBreak: "break-all" }}>
            Link: <b>{customerLink || "memuat..."}</b>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={!customerLink}
              onClick={() => {
                navigator.clipboard.writeText(customerLink);
                toast.success("Link customer disalin.");
              }}
            >
              Copy Link Customer
            </button>
            <button
              className="btn"
              style={{ width: "100%" }}
              disabled={!customerLink}
              onClick={() => window.open(customerLink, "_blank")}
            >
              Test Menu Customer
            </button>
          </div>
        </div>

        {/* QR untuk Kasir (POS Internal) */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>
            &#128179; QR Kasir (POS Internal)
          </div>
          <div className="small" style={{ wordBreak: "break-all" }}>
            Link: <b>{link || "memuat..."}</b>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              style={{ width: "100%" }}
              disabled={!link}
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Link POS disalin.");
              }}
            >
              Copy Link POS
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
      </div>
    </TerraPage>
  );
}