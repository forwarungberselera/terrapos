"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useDevAuth } from "./AuthGuard";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "⌘" },
  { href: "/tenants", label: "Tenants", icon: "◫" },
  { href: "/usage", label: "Usage", icon: "◔" },
  { href: "/monitor", label: "Monitor", icon: "◉" },
  { href: "/audit", label: "Audit", icon: "◷" },
  { href: "/users", label: "Users", icon: "◎" },
  { href: "/revenue", label: "Revenue", icon: "◈" },
  { href: "/maintenance", label: "Maintenance", icon: "⚙" },
  { href: "/brand", label: "Brand", icon: "◐" },
  { href: "/landing", label: "Landing", icon: "◧" },
  { href: "/health", label: "Health", icon: "♥" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { email } = useDevAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">terra<em>DEV</em></span>
        <span className="sidebar-badge">PANEL</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
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
        <button className="sidebar-logout" onClick={() => signOut(auth)}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
