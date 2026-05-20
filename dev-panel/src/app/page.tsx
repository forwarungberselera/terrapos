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

  return (
    <div>
      <h1 className="page-title">Developer Dashboard</h1>
      <p className="page-sub">Selamat datang, <b>{email}</b>. Overview sistem TerraPOS.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Tenants</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loadingStats ? "..." : stats.tenants}
          </div>
          <div className="stat-note">Outlet terdaftar</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {loadingStats ? "..." : stats.users}
          </div>
          <div className="stat-note">Akun terdaftar</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Firebase Plan</div>
          <div className="stat-value" style={{ fontSize: 18 }}>Spark (Free)</div>
          <div className="stat-note">50K reads, 20K writes/day</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Server</div>
          <div className="stat-value" style={{ fontSize: 16 }}>npos.gtomodachi.fun</div>
          <div className="stat-note">VPS + PM2 + Nginx</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Quick Info</div>
        <div className="card-sub">Informasi environment dan status.</div>
        <table>
          <tbody>
            <tr><th>App</th><td>TerraPOS (POS SaaS multi-tenant)</td></tr>
            <tr><th>Frontend</th><td>Next.js 16 + React 19 + TypeScript</td></tr>
            <tr><th>Backend</th><td>Firebase Firestore + Auth</td></tr>
            <tr><th>Deploy</th><td>VPS, PM2 "terrapos" port 3000, Dev Panel port 3001</td></tr>
            <tr><th>Domain</th><td>npos.gtomodachi.fun</td></tr>
            <tr><th>Dev Panel</th><td>/dev-panel (this app)</td></tr>
            <tr><th>Developer</th><td>{email}</td></tr>
            <tr><th>Timestamp</th><td>{new Date().toLocaleString("id-ID")}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Firestore Limits (Spark Plan)</div>
        <div className="card-sub">Daily quota resets at midnight Pacific Time (~14:00 WIB).</div>
        <table>
          <thead>
            <tr><th>Resource</th><th>Limit</th></tr>
          </thead>
          <tbody>
            <tr><td>Document Reads</td><td><b>50,000 / hari</b></td></tr>
            <tr><td>Document Writes</td><td><b>20,000 / hari</b></td></tr>
            <tr><td>Document Deletes</td><td><b>20,000 / hari</b></td></tr>
            <tr><td>Stored Data</td><td><b>1 GiB</b></td></tr>
            <tr><td>Outbound Transfer</td><td><b>10 GiB / bulan</b></td></tr>
            <tr><td>Cloud Functions</td><td style={{ color: "var(--danger)" }}>Tidak tersedia (butuh Blaze)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
