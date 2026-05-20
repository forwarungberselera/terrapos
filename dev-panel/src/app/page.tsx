"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getCountFromServer } from "firebase/firestore";
import { useDevAuth } from "@/components/AuthGuard";

export default function DashboardPage() {
  const { email } = useDevAuth();
  const [stats, setStats] = useState({ tenants: 0, users: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tenantsSnap, usersSnap] = await Promise.all([
          getCountFromServer(collection(db, "tenants")),
          getCountFromServer(collection(db, "users")),
        ]);
        setStats({
          tenants: tenantsSnap.data().count,
          users: usersSnap.data().count,
        });
      } catch (e) {
        console.warn("Failed to load stats:", e);
      } finally {
        setLoadingStats(false);
      }
    })();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Selamat pagi";
    if (h < 17) return "Selamat siang";
    return "Selamat malam";
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">{greeting()}</h1>
        <p className="page-sub">Overview sistem TerraPOS. Logged in as <b>{email}</b></p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Tenants</div>
          <div className="stat-value" style={{ color: "var(--brand2)" }}>
            {loadingStats ? <span className="animate-pulse">--</span> : stats.tenants}
          </div>
          <div className="stat-note">Outlet terdaftar</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Users</div>
          <div className="stat-value" style={{ color: "var(--brand2)" }}>
            {loadingStats ? <span className="animate-pulse">--</span> : stats.users}
          </div>
          <div className="stat-note">Akun terdaftar</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Plan</div>
          <div className="stat-value" style={{ fontSize: 20, color: "var(--warning)" }}>Spark</div>
          <div className="stat-note">Free tier Firebase</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Status</div>
          <div className="stat-value" style={{ fontSize: 20, color: "var(--success)" }}>Online</div>
          <div className="stat-note">npos.gtomodachi.fun</div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="card">
        <div className="card-title">Environment</div>
        <div className="card-sub">Stack dan konfigurasi sistem.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoRow label="Frontend" value="Next.js 16 + React 19" />
          <InfoRow label="Backend" value="Firebase Firestore + Auth" />
          <InfoRow label="Deploy" value="VPS + PM2 + Nginx" />
          <InfoRow label="Domain" value="npos.gtomodachi.fun" />
          <InfoRow label="Web Port" value="3000" />
          <InfoRow label="Dev Panel Port" value="3001" />
          <InfoRow label="Mobile" value="Capacitor 6 (Server Mode)" />
          <InfoRow label="Developer" value={email} />
        </div>
      </div>

      {/* Quota */}
      <div className="card">
        <div className="card-title">Firestore Quota (Spark)</div>
        <div className="card-sub">Daily limits — resets at ~14:00 WIB.</div>

        <div style={{ display: "grid", gap: 14 }}>
          <QuotaBar label="Document Reads" limit="50,000 / hari" percent={0} color="var(--brand)" />
          <QuotaBar label="Document Writes" limit="20,000 / hari" percent={0} color="var(--success)" />
          <QuotaBar label="Document Deletes" limit="20,000 / hari" percent={0} color="var(--warning)" />
          <QuotaBar label="Storage" limit="1 GiB" percent={0} color="var(--brand2)" />
        </div>

        <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--dangerSoft)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
            Cloud Functions tidak tersedia (butuh Blaze plan)
          </span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      background: "rgba(255,255,255,0.02)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", minWidth: 90 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function QuotaBar({ label, limit, percent, color }: { label: string; limit: string; percent: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{limit}</span>
      </div>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${Math.max(percent, 2)}%`, background: color }} />
      </div>
    </div>
  );
}
