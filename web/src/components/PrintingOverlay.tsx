"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

type PrintingContextType = {
  showPrinting: (message?: string) => void;
  hidePrinting: () => void;
  isPrinting: boolean;
};

const PrintingContext = createContext<PrintingContextType | null>(null);

export function PrintingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Mencetak...");

  const showPrinting = useCallback((msg?: string) => {
    setMessage(msg || "Mencetak...");
    setVisible(true);
  }, []);

  const hidePrinting = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <PrintingContext.Provider value={{ showPrinting, hidePrinting, isPrinting: visible }}>
      {children}

      {visible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 9998,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "32px 40px",
              textAlign: "center",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              maxWidth: 320,
              width: "90%",
            }}
          >
            {/* Spinner */}
            <div
              style={{
                width: 48,
                height: 48,
                margin: "0 auto 16px",
                border: "4px solid #e5e7eb",
                borderTopColor: "var(--brand, #e6739d)",
                borderRadius: "50%",
                animation: "print-spin 0.8s linear infinite",
              }}
            />

            <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
              {message}
            </div>

            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              Mohon tunggu, jangan tutup aplikasi
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes print-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </PrintingContext.Provider>
  );
}

export function usePrinting(): PrintingContextType {
  const ctx = useContext(PrintingContext);
  if (!ctx) {
    return {
      showPrinting: () => {},
      hidePrinting: () => {},
      isPrinting: false,
    };
  }
  return ctx;
}
