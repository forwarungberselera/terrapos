"use client";

import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error?.message || "Terjadi kesalahan." };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#f9fafb",
            color: "#1f2937",
            padding: 24,
            fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#fef2f2",
                display: "grid",
                placeItems: "center",
                fontSize: 24,
              }}
            >
              ⚠️
            </div>

            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
              Terjadi Kesalahan
            </h1>

            <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#6b7280" }}>
              Aplikasi mengalami error. Coba refresh halaman atau kembali ke halaman utama.
            </p>

            <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "#d59567",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  color: "#374151",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Ke Halaman Utama
              </button>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 12,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                fontSize: 11,
                color: "#991b1b",
                wordBreak: "break-word",
                textAlign: "left",
              }}
            >
              {this.state.error || "Unknown error"}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
