"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const contextValue: ToastContextType = {
    toast: addToast,
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    info: (msg) => addToast(msg, "info"),
    warning: (msg) => addToast(msg, "warning"),
  };

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const iconMap: Record<ToastType, string> = {
    success: "\u2705",
    error: "\u274C",
    info: "\u2139\uFE0F",
    warning: "\u26A0\uFE0F",
  };

  const colorMap: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46" },
    error: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
    info: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af" },
    warning: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast Container */}
      <div className="terra-toast-container">
        {toasts.map((t) => {
          const colors = colorMap[t.type];
          return (
            <div
              key={t.id}
              className="terra-toast-item"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              onClick={() => removeToast(t.id)}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{iconMap[t.type]}</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        .terra-toast-container {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 360px;
          pointer-events: none;
        }
        /* Mobile: pindah ke top center, full width */
        @media (max-width: 768px) {
          .terra-toast-container {
            top: calc(12px + var(--safe-top, 0px));
            right: 12px;
            left: 12px;
            max-width: none;
          }
        }
        .terra-toast-item {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          animation: toast-slide-in 0.3s ease;
          cursor: pointer;
        }
        @media (max-width: 768px) {
          .terra-toast-item {
            padding: 14px 16px;
            font-size: 14px;
            border-radius: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            animation: toast-slide-down 0.3s ease;
          }
        }
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes toast-slide-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback jika di luar provider (tidak crash)
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    };
  }
  return ctx;
}
