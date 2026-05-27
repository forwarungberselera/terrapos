"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, authReadyPromise } from "@/lib/firebase";
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
  { title: "System Info", description: "Version, environment, build marker", icon: "🖥️", href: "/dev/system", color: "#6366f1" },
  { title: "Maintenance", description: "Toggle maintenance mode", icon: "🔧", href: "/dev/maintenance", color: "#ef4444" },
  { title: "Brand Colors", description: "Tema warna global & force reload", icon: "🎨", href: "/dev/brand-colors", color: "#f59e0b" },
  { title: "Tenant Branding", description: "Warna per tenant / semua tenant", icon: "🖌️", href: "/dev/tenant-branding", color: "#d946ef" },
  { title: "Tenants", description: "Browse, switch, buat, hapus tenant", icon: "🏪", href: "/dev/tenants", color: "#10b981" },
  { title: "Users", description: "Akun, level, assign tenant", icon: "👥", href: "/dev/users", color: "#8b5cf6" },
  { title: "Landing Page", description: "Hero, fitur, pricing, footer", icon: "🌐", href: "/dev/landing", color: "#0ea5e9" },
  { title: "Notifikasi", description: "Broadcast in-app ke user", icon: "🔔", href: "/dev/notifications", color: "#ec4899" },
];

export default function DevConsolePage() {
  const r = useRouter();
  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { await authReadyPromise; if (!auth.currentUser) { r.push("/login"); return; } return; }
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
        .dev-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .dev-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:#1e1b4b;color:#a5b4fc;font-size:10px;font-weight:900;letter-spacing:0.5px;}
        .dev-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--muted);}
        .dev-meta span{padding:4px 8px;background:var(--input-bg);border-radius:6px;border:1px solid var(--border);}
        .dev-meta b{color:var(--text);}
        .dev-nav{display:flex;gap:6px;flex-wrap:wrap;}
        .dev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:14px;}
        .dev-card{
          padding:16px 18px;border:1px solid var(--border);border-radius:14px;
          background:var(--panel);cursor:pointer;transition:all 0.2s ease;
          display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;
        }
        .dev-card:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,0.06);border-color:var(--brand);}
        .dev-card:active{transform:scale(0.98);}
        .dev-card-icon{font-size:26px;flex-shrink:0;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--input-bg);}
        .dev-card-text{flex:1;min-width:0;}
        .dev-card-title{font-size:14px;font-weight:900;color:var(--text);}
        .dev-card-desc{font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4;}
        .dev-card-stripe{position:absolute;top:0;left:0;bottom:0;width:3px;}
        .dev-quick{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;margin-top:10px;}
        .dev-quick button{font-size:12px;padding:10px 8px;text-align:center;}

        @media(max-width:640px){
          .dev-grid{grid-template-columns:1fr;}
          .dev-card{padding:14px;}
          .dev-card-icon{width:38px;height:38px;font-size:22px;}
          .dev-header{flex-direction:column;gap:10px;}
          .dev-nav{width:100%;}
          .dev-nav button{flex:1;font-size:12px;padding:8px 6px;}
          .dev-quick{grid-template-columns:repeat(3,1fr);}
          .dev-quick button{font-size:11px;padding:8px 4px;}
        }
      `}</style>

      {/* HEADER */}
      <div className="card">
        <div className="dev-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="h1" style={{ fontSize: 18 }}>Dev Console</div>
              <span className="dev-badge">DEV</span>
            </div>
            <div className="dev-meta">
              <span><b>{email.split("@")[0]}</b></span>
              <span>v{APP_VERSION}</span>
              <span>{BUILD_ENV}</span>
              <span>T: <b>{tenantId || "—"}</b></span>
            </div>
          </div>
          <div className="dev-nav">
            <button className="btn" onClick={() => r.push("/pos")}>POS</button>
            <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
            <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
          </div>
        </div>
      </div>

      {/* MENU GRID */}
      <div className="dev-grid">
        {MENU_ITEMS.map((item) => (
          <div key={item.href} className="dev-card" onClick={() => r.push(item.href)}>
            <div className="dev-card-stripe" style={{ background: item.color }} />
            <div className="dev-card-icon">{item.icon}</div>
            <div className="dev-card-text">
              <div className="dev-card-title">{item.title}</div>
              <div className="dev-card-desc">{item.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* QUICK LINKS */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Quick Links</div>
        <div className="dev-quick">
          <button className="btn" onClick={() => r.push("/setup")}>Setup</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => r.push("/products")}>Products</button>
          <button className="btn" onClick={() => r.push("/shifts")}>Shifts</button>
          <button className="btn" onClick={() => r.push("/reports")}>Reports</button>
          <button className="btn" onClick={() => r.push("/settings")}>Settings</button>
          <button className="btn" onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}>Reload</button>
          <button className="btn" onClick={() => { if (typeof window !== "undefined") { caches.keys().then((n) => n.forEach((k) => caches.delete(k))); } }}>Clear Cache</button>
        </div>
      </div>
    </TerraPage>
  );
}
