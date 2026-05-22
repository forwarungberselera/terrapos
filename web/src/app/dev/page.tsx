"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { checkIsDeveloper, APP_VERSION, BUILD_ENV } from "@/lib/developer";
import { getStoredTenantId } from "@/lib/tenant";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";

type MenuItem = {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
};

const MENU_ITEMS: MenuItem[] = [
  { title: "System Info", description: "App version, environment, build marker", icon: "🖥️", href: "/dev/system", color: "#6366f1" },
  { title: "Maintenance", description: "Toggle maintenance mode untuk semua user", icon: "🔧", href: "/dev/maintenance", color: "#ef4444" },
  { title: "Brand Colors", description: "Ubah tema warna app, force reload clients", icon: "🎨", href: "/dev/brand-colors", color: "#f59e0b" },
  { title: "Tenant Management", description: "Browse, switch, hapus tenant", icon: "🏪", href: "/dev/tenants", color: "#10b981" },
  { title: "User Management", description: "Kelola akun, ubah level, assign tenant", icon: "👥", href: "/dev/users", color: "#8b5cf6" },
  { title: "Landing Page", description: "Edit hero, fitur, pricing, footer", icon: "🌐", href: "/dev/landing", color: "#0ea5e9" },
  { title: "Notifikasi", description: "Broadcast notifikasi in-app ke user", icon: "🔔", href: "/dev/notifications", color: "#ec4899" },
];

export default function DevConsolePage() {
  const r = useRouter();
  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { r.push("/login"); return; }
      setEmail(user.email || "");
      setTenantId(getStoredTenantId() || "");
      const devStatus = await checkIsDeveloper(user.uid, user.email || "");
      setIsDeveloper(devStatus);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  if (loading) return <TerraPage maxWidth={900}><SkeletonStyles /><PageSkeleton cards={3} /></TerraPage>;

  if (!isDeveloper) {
    return (
      <TerraPage maxWidth={600}>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="h1">Akses Ditolak</div>
          <div className="small" style={{ marginTop: 8 }}>Halaman ini hanya untuk Developer.</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => r.push("/dashboard")}>Kembali</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={900}>
      <style>{`
        .dev-hub-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .dev-hub-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;background:#1e1b4b;color:#a5b4fc;font-size:11px;font-weight:900;letter-spacing:0.5px;}
        .dev-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:16px;}
        .dev-hub-card{
          padding:20px;border:1px solid var(--border);border-radius:16px;
          background:var(--panel);cursor:pointer;transition:all 0.2s ease;
          display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden;
        }
        .dev-hub-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08);border-color:var(--brand);}
        .dev-hub-card-icon{font-size:28px;}
        .dev-hub-card-title{font-size:15px;font-weight:900;color:var(--text);}
        .dev-hub-card-desc{font-size:12px;color:var(--muted);line-height:1.5;}
        .dev-hub-card-stripe{position:absolute;top:0;left:0;right:0;height:3px;}
        .dev-hub-info{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--muted);}
        .dev-hub-info b{color:var(--text);}
        .dev-hub-nav{display:flex;gap:8px;flex-wrap:wrap;}
      `}</style>

      {/* HEADER */}
      <div className="card">
        <div className="dev-hub-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="h1">Developer Console</div>
              <span className="dev-hub-badge">DEV</span>
            </div>
            <div className="dev-hub-info">
              <span>{email}</span>
              <span>v<b>{APP_VERSION}</b></span>
              <span>{BUILD_ENV}</span>
              <span>Tenant: <b>{tenantId || "—"}</b></span>
            </div>
          </div>
          <div className="dev-hub-nav">
            <button className="btn" onClick={() => r.push("/pos")}>POS</button>
            <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
            <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
          </div>
        </div>
      </div>

      {/* MENU GRID */}
      <div className="dev-hub-grid">
        {MENU_ITEMS.map((item) => (
          <div key={item.href} className="dev-hub-card" onClick={() => r.push(item.href)}>
            <div className="dev-hub-card-stripe" style={{ background: item.color }} />
            <div className="dev-hub-card-icon">{item.icon}</div>
            <div className="dev-hub-card-title">{item.title}</div>
            <div className="dev-hub-card-desc">{item.description}</div>
          </div>
        ))}
      </div>

      {/* QUICK LINKS */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Quick Links</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => r.push("/setup")}>Setup Tenant</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => r.push("/products")}>Products</button>
          <button className="btn" onClick={() => r.push("/shifts")}>Shifts</button>
          <button className="btn" onClick={() => r.push("/reports")}>Reports</button>
          <button className="btn" onClick={() => r.push("/settings")}>Settings</button>
          <button className="btn" onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}>Reload App</button>
          <button className="btn" onClick={() => { if (typeof window !== "undefined") { caches.keys().then((n) => n.forEach((k) => caches.delete(k))); } }}>Clear Cache</button>
        </div>
      </div>
    </TerraPage>
  );
}
