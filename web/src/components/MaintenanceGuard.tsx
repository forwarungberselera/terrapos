"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  checkIsDeveloper,
  DEVELOPER_EMAILS,
  subscribeMaintenanceStatus,
  MaintenanceStatus,
} from "@/lib/developer";

/**
 * MaintenanceGuard - Block seluruh app saat maintenance mode aktif.
 * Developer tetap bisa akses (bypass).
 */
export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [maintenance, setMaintenance] = useState<MaintenanceStatus>({
    enabled: false,
    message: "",
    enabledAt: null,
    enabledBy: "",
  });
  const [isDev, setIsDev] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = subscribeMaintenanceStatus((status) => {
      setMaintenance(status);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsDev(false);
        setChecking(false);
        return;
      }

      // Quick check: hardcoded email
      if (user.email && DEVELOPER_EMAILS.includes(user.email.toLowerCase())) {
        setIsDev(true);
        setChecking(false);
        return;
      }

      // Fallback: Firestore check
      const devStatus = await checkIsDeveloper(user.uid, user.email || "");
      setIsDev(devStatus);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  // Jangan block kalau maintenance off, atau user adalah developer
  if (!maintenance.enabled || isDev) {
    return <>{children}</>;
  }

  // Masih loading auth
  if (checking) {
    return <>{children}</>;
  }

  // BLOCK: tampilkan halaman maintenance
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#111827",
        color: "#fff",
        padding: 24,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 24px",
            borderRadius: "50%",
            background: "#1e293b",
            display: "grid",
            placeItems: "center",
            fontSize: 28,
          }}
        >
          🔧
        </div>

        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
          Sedang Maintenance
        </h1>

        <p
          style={{
            marginTop: 16,
            fontSize: 16,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {maintenance.message || "Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi."}
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 14,
            borderRadius: 14,
            background: "#1e293b",
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          TerraPOS akan segera kembali. Terima kasih atas kesabaran Anda.
        </div>
      </div>
    </div>
  );
}
