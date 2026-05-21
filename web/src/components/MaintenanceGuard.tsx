"use client";

import React, { useEffect, useState, useRef } from "react";
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
 * 
 * Fix: Wait for BOTH auth AND maintenance status before deciding.
 */
export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [maintenance, setMaintenance] = useState<MaintenanceStatus>({
    enabled: false,
    message: "",
    enabledAt: null,
    enabledBy: "",
  });
  const [isDev, setIsDev] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [maintenanceReady, setMaintenanceReady] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe maintenance status (realtime)
  useEffect(() => {
    // Safety timeout: jika Firestore gagal, jangan stuck selamanya
    timeoutRef.current = setTimeout(() => {
      setMaintenanceReady(true);
    }, 5000);

    const unsub = subscribeMaintenanceStatus((status) => {
      setMaintenance(status);
      setMaintenanceReady(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    });

    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Check auth & developer status
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsDev(false);
        setAuthReady(true);
        return;
      }

      // Quick check: hardcoded email
      if (user.email && DEVELOPER_EMAILS.includes(user.email.toLowerCase())) {
        setIsDev(true);
        setAuthReady(true);
        return;
      }

      // Fallback: Firestore check
      try {
        const devStatus = await checkIsDeveloper(user.uid, user.email || "");
        setIsDev(devStatus);
      } catch {
        setIsDev(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Still loading — render children to avoid blank screen flash
  // But only for max ~5 seconds (timeout above)
  if (!authReady || !maintenanceReady) {
    return <>{children}</>;
  }

  // Developer always bypasses
  if (isDev) {
    return <>{children}</>;
  }

  // Maintenance OFF — let through
  if (!maintenance.enabled) {
    return <>{children}</>;
  }

  // BLOCK: maintenance ON + user is NOT developer
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
