"use client";

import React, { useState, useCallback, useEffect } from "react";
import { StaffAccount } from "@/lib/staff-session";

/**
 * StaffPinLock - Full screen PIN lock overlay
 * 
 * Tampil saat staff system aktif tapi belum ada yang login via PIN.
 * Flow: Pilih nama staff → Masukkan PIN 4-6 digit → Verified → masuk POS
 */

type Props = {
  staffAccounts: StaffAccount[];
  onLogin: (staffId: string, pin: string) => Promise<boolean>;
  error?: string;
};

export default function StaffPinLock({ staffAccounts, onLogin, error }: Props) {
  const [selectedStaff, setSelectedStaff] = useState<StaffAccount | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [shake, setShake] = useState(false);

  // Reset saat ganti staff
  useEffect(() => {
    setPin("");
    setLocalError("");
  }, [selectedStaff]);

  const handleNumpad = useCallback((digit: string) => {
    if (pin.length >= 6) return;
    setPin((prev) => prev + digit);
    setLocalError("");
  }, [pin]);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setLocalError("");
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setLocalError("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedStaff || pin.length < 4) {
      setLocalError("PIN minimal 4 digit.");
      return;
    }

    setLoading(true);
    setLocalError("");

    const success = await onLogin(selectedStaff.id, pin);

    if (!success) {
      setShake(true);
      setLocalError("PIN salah. Coba lagi.");
      setPin("");
      setTimeout(() => setShake(false), 500);
    }

    setLoading(false);
  }, [selectedStaff, pin, onLogin]);

  // Auto-submit when PIN reaches 4-6 digits
  useEffect(() => {
    if (pin.length < 4 || !selectedStaff) return;
    if (pin.length === 6) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => {
      handleSubmit();
    }, 800);
    return () => clearTimeout(timer);
  }, [pin, selectedStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayError = localError || error || "";

  return (
    <>
      <style>{`
        .pin-lock-overlay{
          position:fixed;
          inset:0;
          z-index:9999;
          background:var(--bg);
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:20px;
          animation:fadeIn 0.25s ease;
          overflow-y:auto;
        }
        .pin-lock-card{
          width:100%;
          max-width:420px;
          text-align:center;
          display:flex;
          flex-direction:column;
          align-items:center;
        }
        .pin-lock-title{
          font-size:26px;
          font-weight:900;
          font-family:var(--font-primary);
          margin-bottom:8px;
        }
        .pin-lock-subtitle{
          font-size:14px;
          color:var(--muted);
          margin-bottom:28px;
        }

        /* Staff selector - centered grid */
        .staff-selector{
          display:flex;
          flex-wrap:wrap;
          justify-content:center;
          gap:14px;
          margin-bottom:28px;
          max-height:280px;
          overflow-y:auto;
          padding:8px;
          width:100%;
        }
        .staff-chip{
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:8px;
          padding:16px 14px;
          border-radius:16px;
          border:2px solid var(--border);
          background:var(--panel);
          cursor:pointer;
          transition:all 0.15s ease;
          width:110px;
        }
        .staff-chip:hover{
          border-color:var(--brand);
          transform:scale(1.04);
          box-shadow:0 4px 16px rgba(0,0,0,0.08);
        }
        .staff-chip:active{
          transform:scale(0.96);
        }
        .staff-chip.selected{
          border-color:var(--brand);
          background:rgba(213,149,103,0.1);
          box-shadow:0 0 0 3px rgba(213,149,103,0.2);
        }
        .staff-chip-avatar{
          width:48px;
          height:48px;
          border-radius:50%;
          background:var(--brand);
          color:#fff;
          display:grid;
          place-items:center;
          font-weight:900;
          font-size:20px;
        }
        .staff-chip-name{
          font-size:12px;
          font-weight:800;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          max-width:90px;
          color:var(--text);
        }
        .staff-chip-role{
          font-size:10px;
          color:var(--muted);
          text-transform:capitalize;
        }

        /* PIN display */
        .pin-dots{
          display:flex;
          justify-content:center;
          gap:14px;
          margin:24px 0;
          min-height:32px;
        }
        .pin-dot{
          width:18px;
          height:18px;
          border-radius:50%;
          border:2px solid var(--border);
          transition:all 0.15s ease;
        }
        .pin-dot.filled{
          background:var(--brand);
          border-color:var(--brand);
          transform:scale(1.15);
        }
        .pin-dots.shake{
          animation:pinShake 0.4s ease;
        }
        @keyframes pinShake{
          0%,100%{transform:translateX(0);}
          20%{transform:translateX(-8px);}
          40%{transform:translateX(8px);}
          60%{transform:translateX(-6px);}
          80%{transform:translateX(6px);}
        }

        /* Numpad */
        .numpad{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:12px;
          width:100%;
          max-width:300px;
        }
        .numpad-btn{
          height:64px;
          border-radius:16px;
          border:1px solid var(--border);
          background:var(--panel);
          font-size:26px;
          font-weight:800;
          cursor:pointer;
          display:grid;
          place-items:center;
          transition:all 0.1s ease;
          user-select:none;
          -webkit-tap-highlight-color:transparent;
          color:var(--text);
        }
        .numpad-btn:active{
          transform:scale(0.9);
          background:var(--brand);
          color:#fff;
          border-color:var(--brand);
        }
        .numpad-btn.action{
          font-size:14px;
          font-weight:700;
          color:var(--muted);
        }
        .numpad-btn.action:active{
          background:var(--input-bg);
          color:var(--text);
          transform:scale(0.9);
        }

        .pin-error{
          color:var(--danger);
          font-size:13px;
          font-weight:800;
          margin-top:14px;
          min-height:20px;
        }

        .pin-back-btn{
          margin-top:20px;
          font-size:14px;
          color:var(--muted);
          cursor:pointer;
          background:none;
          border:none;
          text-decoration:underline;
          padding:8px 16px;
        }
        .pin-back-btn:active{
          color:var(--text);
        }

        .pin-selected-avatar{
          width:64px;
          height:64px;
          border-radius:50%;
          background:var(--brand);
          color:#fff;
          display:grid;
          place-items:center;
          font-weight:900;
          font-size:28px;
          margin:0 auto 12px;
        }

        @media(max-width:640px){
          .pin-lock-title{font-size:22px;}
          .pin-lock-subtitle{font-size:13px; margin-bottom:20px;}
          .staff-selector{
            gap:10px;
            max-height:220px;
          }
          .staff-chip{
            width:90px;
            padding:12px 10px;
            border-radius:14px;
          }
          .staff-chip-avatar{
            width:40px;
            height:40px;
            font-size:17px;
          }
          .staff-chip-name{
            font-size:11px;
            max-width:70px;
          }
          .numpad{
            max-width:270px;
            gap:10px;
          }
          .numpad-btn{
            height:58px;
            font-size:24px;
            border-radius:14px;
          }
          .pin-selected-avatar{
            width:56px;
            height:56px;
            font-size:24px;
          }
        }

        @media(max-width:380px){
          .staff-chip{
            width:80px;
            padding:10px 8px;
          }
          .numpad{
            max-width:240px;
            gap:8px;
          }
          .numpad-btn{
            height:52px;
            font-size:22px;
          }
        }
      `}</style>

      <div className="pin-lock-overlay">
        <div className="pin-lock-card">
          <div className="pin-lock-title">
            terra <span style={{ color: "var(--brand)" }}>POS</span>
          </div>

          {!selectedStaff ? (
            <>
              {/* Step 1: Pilih Staff */}
              <div className="pin-lock-subtitle">Pilih staff untuk mulai</div>
              <div className="staff-selector">
                {staffAccounts.map((s) => (
                  <div
                    key={s.id}
                    className="staff-chip"
                    onClick={() => setSelectedStaff(s)}
                  >
                    <div className="staff-chip-avatar">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="staff-chip-name">{s.name}</div>
                    <div className="staff-chip-role">{s.role}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Masukkan PIN */}
              <div className="pin-selected-avatar">
                {selectedStaff.name.charAt(0).toUpperCase()}
              </div>
              <div className="pin-lock-subtitle">
                Masukkan PIN untuk <b>{selectedStaff.name}</b>
              </div>

              {/* PIN Dots */}
              <div className={`pin-dots ${shake ? "shake" : ""}`}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`pin-dot ${i < pin.length ? "filled" : ""}`}
                  />
                ))}
              </div>

              {/* Error */}
              <div className="pin-error">{displayError}</div>

              {/* Numpad */}
              <div className="numpad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    className="numpad-btn"
                    onClick={() => handleNumpad(d)}
                    disabled={loading}
                  >
                    {d}
                  </button>
                ))}
                <button
                  className="numpad-btn action"
                  onClick={handleClear}
                  disabled={loading}
                >
                  Clear
                </button>
                <button
                  className="numpad-btn"
                  onClick={() => handleNumpad("0")}
                  disabled={loading}
                >
                  0
                </button>
                <button
                  className="numpad-btn action"
                  onClick={handleBackspace}
                  disabled={loading}
                >
                  &#9003;
                </button>
              </div>

              {/* Back button */}
              <button className="pin-back-btn" onClick={() => setSelectedStaff(null)}>
                &larr; Pilih staff lain
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
