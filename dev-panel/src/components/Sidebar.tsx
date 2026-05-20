"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useDevAuth } from "./AuthGuard";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "H" },
  { href: "/tenants", label: "Tenants", icon: "T" },
  { href: "/usage", label: "Firestore Usage", icon: "U" },
  { href: "/monitor", label: "Realtime Monitor", icon: "M" },
  { href: "/audit", label: "Audit Log", icon: "A" },
  { href: "/users", label: "User Manager", icon: "P" },
  { href: "/revenue", label: "Revenue", icon: "R" },
  { href: "/maintenance", label: "Maintenance", icon: "X" },
  { href: "/brand", label: "Brand Colors", icon: "B" },
  { href: "/landing", label: "Landing Editor", icon: "L" },
  { href: "/health", label: "System Health", icon: "S" },
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
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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
