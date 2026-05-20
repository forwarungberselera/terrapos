"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useDevAuth } from "./AuthGuard";

const NAV_ITEMS = [
  { href: "/dev-panel", label: "Dashboard", icon: "H" },
  { href: "/dev-panel/tenants", label: "Tenants", icon: "T" },
  { href: "/dev-panel/usage", label: "Firestore Usage", icon: "U" },
  { href: "/dev-panel/monitor", label: "Realtime Monitor", icon: "M" },
  { href: "/dev-panel/audit", label: "Audit Log", icon: "A" },
  { href: "/dev-panel/users", label: "User Manager", icon: "P" },
  { href: "/dev-panel/revenue", label: "Revenue", icon: "R" },
  { href: "/dev-panel/maintenance", label: "Maintenance", icon: "X" },
  { href: "/dev-panel/brand", label: "Brand Colors", icon: "B" },
  { href: "/dev-panel/landing", label: "Landing Editor", icon: "L" },
  { href: "/dev-panel/health", label: "System Health", icon: "S" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { email } = useDevAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">terra<em>DEV</em></span>
        <span className="sidebar-badge">DEVELOPER</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dev-panel" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? "active" : ""}`}>
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">{email}</div>
        <button className="sidebar-logout" onClick={() => signOut(auth)}>Logout</button>
        <a href="/" className="sidebar-link" style={{ marginTop: 8, textAlign: "center", display: "block", fontSize: 12 }}>
          Kembali ke TerraPOS
        </a>
      </div>
    </aside>
  );
}
