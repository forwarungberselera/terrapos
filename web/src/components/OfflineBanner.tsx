"use client";

import React, { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);

    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#111",
        color: "#fff",
        padding: "10px 12px",
        borderRadius: 12,
        fontWeight: 800,
        fontSize: 13,
        boxShadow: "0 10px 30px rgba(0,0,0,.2)",
      }}
    >
      Offline. Transaksi tetap bisa dibuat, nanti otomatis sync saat online.
    </div>
  );
}