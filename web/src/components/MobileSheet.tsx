"use client";

import React, { useEffect, useRef } from "react";

type MobileSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
};

/**
 * MobileSheet: Bottom sheet pada mobile, centered modal pada desktop/tablet.
 * Responsive breakpoint: 768px
 */
export default function MobileSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = "85vh",
}: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <style>{`
        .ms-overlay{
          position:fixed;inset:0;z-index:1000;
          background:rgba(0,0,0,0.5);
          animation:ms-fadeIn 0.2s ease;
          display:grid;place-items:center;
          padding:16px;
        }
        @keyframes ms-fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes ms-slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
        @keyframes ms-scaleIn{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}

        /* Desktop/tablet: centered modal */
        .ms-panel{
          background:var(--panel);
          border-radius:var(--radius-lg);
          max-width:480px;
          width:100%;
          max-height:${maxHeight};
          overflow-y:auto;
          padding:24px;
          box-shadow:0 12px 40px rgba(0,0,0,0.2);
          animation:ms-scaleIn 0.2s ease;
          position:relative;
        }

        /* Mobile: bottom sheet */
        @media (max-width: 768px){
          .ms-overlay{
            align-items:flex-end;
            padding:0;
          }
          .ms-panel{
            max-width:100%;
            width:100%;
            max-height:${maxHeight};
            border-radius:20px 20px 0 0;
            padding:20px 16px calc(20px + var(--safe-bottom, 0px));
            animation:ms-slideUp 0.25s ease;
          }
        }

        .ms-handle{
          display:none;
        }
        @media (max-width: 768px){
          .ms-handle{
            display:block;
            width:36px;height:4px;
            border-radius:999px;
            background:var(--border);
            margin:0 auto 12px;
          }
        }

        .ms-header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom:16px;
        }
        .ms-title{
          font-size:18px;
          font-weight:900;
          color:var(--text);
          line-height:1.2;
        }
        @media (max-width: 768px){
          .ms-title{ font-size:16px; }
        }
        .ms-close{
          width:32px;height:32px;
          border-radius:50%;
          border:1px solid var(--border);
          background:var(--panel);
          display:grid;place-items:center;
          cursor:pointer;
          transition:background 0.15s ease,transform 0.1s ease;
          touch-action:manipulation;
          flex-shrink:0;
        }
        .ms-close:hover{ background:var(--brandSoft); }
        .ms-close:active{ transform:scale(0.9); }
        .ms-body{
          display:grid;
          gap:12px;
        }
      `}</style>

      <div className="ms-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ms-panel" ref={sheetRef}>
          <div className="ms-handle" />
          {title && (
            <div className="ms-header">
              <div className="ms-title">{title}</div>
              <button className="ms-close" onClick={onClose} aria-label="Tutup">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
          <div className="ms-body">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
