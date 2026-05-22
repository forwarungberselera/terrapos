"use client";

import React from "react";
import { LevelBadge } from "@/components/LevelBadge";
import { useTenant } from "@/hooks/useTenant";
import { useStaff } from "@/hooks/useStaff";

/**
 * PageHeader - Shared header component untuk semua halaman TerraPOS
 * 
 * Desain sama dengan POS page:
 * - Brand title "terra POS" (atau custom page title)
 * - LevelBadge
 * - Staff badge (jika aktif)
 * - Email badge
 * - Shortcut buttons (passed as children)
 * 
 * Mobile optimized: responsive layout, compact badges
 */

type Props = {
  /** Optional page title override (default: shows "terra POS") */
  title?: string;
  /** Optional subtitle below badges */
  subtitle?: string;
  /** Navigation/action buttons - rendered on the right side */
  children?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, children }: Props) {
  const { email } = useTenant();
  const { activeStaff, switchStaff, staffEnabled } = useStaff();

  return (
    <>
      <style>{`
        .page-header{
          display:flex;
          align-items:flex-start;
          gap:12px;
        }
        .page-header-left{
          flex:1;
          min-width:0;
        }
        .page-header-brand{
          font-size:22px;
          font-weight:800;
          font-family:var(--font-primary);
          line-height:1;
        }
        .page-header-title{
          font-size:18px;
          font-weight:800;
          line-height:1.2;
          color:var(--text);
          margin-top:2px;
        }
        .page-header-badges{
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          align-items:center;
          margin-top:8px;
        }
        .page-header-badge{
          display:inline-flex;
          align-items:center;
          padding:4px 8px;
          border-radius:999px;
          background:var(--input-bg);
          border:1px solid var(--border);
          font-size:11px;
          font-weight:600;
          color:var(--muted);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          max-width:180px;
        }
        .page-header-badge-staff{
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:4px 10px;
          border-radius:999px;
          background:rgba(213,149,103,0.15);
          border:1px solid var(--brand);
          font-size:11px;
          font-weight:800;
          color:var(--brand);
          cursor:pointer;
          white-space:nowrap;
        }
        .page-header-badge-staff:active{
          transform:scale(0.95);
        }
        .page-header-subtitle{
          font-size:12px;
          color:var(--muted);
          margin-top:6px;
          font-weight:500;
        }
        .page-header-nav{
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          align-items:center;
        }

        @media(max-width:640px){
          .page-header{
            flex-direction:column;
            gap:10px;
          }
          .page-header-brand{
            font-size:20px;
          }
          .page-header-title{
            font-size:16px;
          }
          .page-header-badges{
            gap:5px;
            margin-top:6px;
          }
          .page-header-badge{
            font-size:10px;
            padding:3px 7px;
            max-width:150px;
          }
          .page-header-badge-staff{
            font-size:10px;
            padding:3px 8px;
          }
          .page-header-nav{
            width:100%;
            gap:5px;
          }
          .page-header-nav .btn{
            flex:1;
            min-width:0;
            font-size:11px !important;
            padding:8px 6px !important;
            text-align:center;
            justify-content:center;
          }
        }
      `}</style>

      <div className="card">
        <div className="page-header">
          <div className="page-header-left">
            {/* Brand */}
            <div className="page-header-brand">
              terra <span style={{ color: "var(--brand)" }}>POS</span>
            </div>

            {/* Page title (if different from brand) */}
            {title && <div className="page-header-title">{title}</div>}

            {/* Badges row */}
            <div className="page-header-badges">
              <LevelBadge size="small" />
              {activeStaff && (
                <span
                  className="page-header-badge-staff"
                  onClick={switchStaff}
                  title="Klik untuk ganti staff"
                >
                  &#128100; {activeStaff.staffName}
                </span>
              )}
              <span className="page-header-badge">
                {email || "-"}
              </span>
            </div>

            {/* Subtitle */}
            {subtitle && (
              <div className="page-header-subtitle">{subtitle}</div>
            )}
          </div>

          {/* Navigation buttons */}
          {children && (
            <div className="page-header-nav">
              {children}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
