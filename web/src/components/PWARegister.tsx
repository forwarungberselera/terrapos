"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Cek update setiap kali halaman dibuka
      reg.update();

      // Kalau ada update, langsung activate
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated") {
            // Reload halaman supaya user dapat versi terbaru
            window.location.reload();
          }
        });
      });
    }).catch(() => {});

    // Force check update setiap 5 menit
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update();
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
