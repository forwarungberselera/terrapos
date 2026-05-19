"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

export default function HomePage() {
  const r = useRouter();

  // APK: langsung ke login, skip landing page
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      r.replace("/login");
    }
  }, [r]);

  return (
    <main>
      <style>{`
        .lp {
          min-height: 100vh;
          background: #0a0a0a;
          color: #fafafa;
          font-family: var(--font-primary, ui-sans-serif, system-ui, -apple-system, sans-serif);
          overflow-x: hidden;
        }

        .lp-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          backdrop-filter: blur(20px);
          background: rgba(10,10,10,0.7);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .lp-logo {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .lp-logo span {
          color: #d59567;
        }

        .lp-nav-btns {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .lp-btn {
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .lp-btn-ghost {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .lp-btn-ghost:hover {
          color: #fff;
          border-color: rgba(255,255,255,0.25);
        }

        .lp-btn-fill {
          background: #d59567;
          color: #fff;
        }

        .lp-btn-fill:hover {
          background: #c07f52;
          transform: translateY(-1px);
        }

        .lp-hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 100px 24px 60px;
          position: relative;
        }

        .lp-hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(213,149,103,0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(213,149,103,0.1);
          border: 1px solid rgba(213,149,103,0.25);
          color: #d59567;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 28px;
        }

        .lp-hero h1 {
          font-size: clamp(40px, 8vw, 72px);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -0.04em;
          margin: 0;
          max-width: 700px;
        }

        .lp-hero h1 em {
          font-style: normal;
          background: linear-gradient(135deg, #d59567, #e4b896);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-hero-sub {
          margin-top: 20px;
          font-size: 17px;
          line-height: 1.7;
          color: #71717a;
          max-width: 520px;
        }

        .lp-hero-actions {
          margin-top: 36px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .lp-btn-lg {
          padding: 14px 28px;
          font-size: 15px;
          border-radius: 12px;
        }

        .lp-stats {
          margin-top: 64px;
          display: flex;
          gap: 48px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .lp-stat {
          text-align: center;
        }

        .lp-stat-val {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
        }

        .lp-stat-label {
          margin-top: 4px;
          font-size: 12px;
          color: #71717a;
          font-weight: 600;
        }

        .lp-features {
          padding: 80px 24px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .lp-section-title {
          text-align: center;
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.03em;
          margin-bottom: 48px;
        }

        .lp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
        }

        @media (max-width: 768px) {
          .lp-grid {
            grid-template-columns: 1fr;
          }
        }

        .lp-feature {
          padding: 32px 24px;
          background: #0a0a0a;
          transition: background 0.2s ease;
        }

        .lp-feature:hover {
          background: #111;
        }

        .lp-feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(213,149,103,0.1);
          display: grid;
          place-items: center;
          font-size: 18px;
          margin-bottom: 16px;
        }

        .lp-feature h3 {
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 8px;
        }

        .lp-feature p {
          font-size: 13px;
          line-height: 1.6;
          color: #71717a;
          margin: 0;
        }

        .lp-cta {
          padding: 80px 24px 100px;
          text-align: center;
        }

        .lp-cta-box {
          max-width: 560px;
          margin: 0 auto;
          padding: 48px 32px;
          border-radius: 24px;
          background: linear-gradient(145deg, rgba(213,149,103,0.08), rgba(213,149,103,0.02));
          border: 1px solid rgba(213,149,103,0.15);
        }

        .lp-cta-box h2 {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.02em;
          margin: 0 0 12px;
        }

        .lp-cta-box p {
          color: #71717a;
          font-size: 15px;
          line-height: 1.6;
          margin: 0 0 28px;
        }

        .lp-footer {
          padding: 24px;
          text-align: center;
          color: #3f3f46;
          font-size: 12px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }

        @media (max-width: 640px) {
          .lp-nav { padding: 14px 16px; }
          .lp-hero { padding: 80px 16px 40px; }
          .lp-stats { gap: 32px; }
          .lp-features { padding: 48px 16px; }
          .lp-cta { padding: 48px 16px 64px; }
        }
      `}</style>

      <div className="lp">
        {/* NAV */}
        <nav className="lp-nav">
          <div className="lp-logo">terra<span>POS</span></div>
          <div className="lp-nav-btns">
            <button className="lp-btn lp-btn-ghost" onClick={() => r.push("/login")}>
              Masuk
            </button>
            <button className="lp-btn lp-btn-fill" onClick={() => r.push("/setup")}>
              Daftar Gratis
            </button>
          </div>
        </nav>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-badge">Sistem POS Modern untuk Cafe & Resto</div>

          <h1>
            Kasir <em>lebih cepat</em>,<br />
            laporan lebih rapi.
          </h1>

          <p className="lp-hero-sub">
            Kelola order, cetak struk, pantau omzet, dan atur meja — semua dari satu dashboard. Gratis untuk mulai.
          </p>

          <div className="lp-hero-actions">
            <button className="lp-btn lp-btn-fill lp-btn-lg" onClick={() => r.push("/setup")}>
              Mulai Sekarang
            </button>
            <button className="lp-btn lp-btn-ghost lp-btn-lg" onClick={() => r.push("/login")}>
              Login
            </button>
          </div>

          <div className="lp-stats">
            <div className="lp-stat">
              <div className="lp-stat-val">3</div>
              <div className="lp-stat-label">Mode Print</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-val">2</div>
              <div className="lp-stat-label">Mode Bayar</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-val">24/7</div>
              <div className="lp-stat-label">Offline Ready</div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="lp-features" id="fitur">
          <h2 className="lp-section-title">Semua yang kamu butuhkan</h2>

          <div className="lp-grid">
            <div className="lp-feature">
              <div className="lp-feature-icon">&#9889;</div>
              <h3>POS Dual Mode</h3>
              <p>Bayar langsung atau simpan per meja, bayar nanti di kasir.</p>
            </div>

            <div className="lp-feature">
              <div className="lp-feature-icon">&#128424;</div>
              <h3>Cetak Struk</h3>
              <p>Browser, RawBT, atau Bluetooth ESC/POS langsung ke thermal printer.</p>
            </div>

            <div className="lp-feature">
              <div className="lp-feature-icon">&#128200;</div>
              <h3>Dashboard Realtime</h3>
              <p>Omzet harian, grafik 7 hari, top produk, dan breakdown CASH vs QRIS.</p>
            </div>

            <div className="lp-feature">
              <div className="lp-feature-icon">&#128241;</div>
              <h3>QR Meja</h3>
              <p>Generate QR per meja untuk alur order yang lebih cepat dan teratur.</p>
            </div>

            <div className="lp-feature">
              <div className="lp-feature-icon">&#128202;</div>
              <h3>Laporan & Export</h3>
              <p>Rekap penjualan harian/mingguan/bulanan, export ke Excel satu klik.</p>
            </div>

            <div className="lp-feature">
              <div className="lp-feature-icon">&#127760;</div>
              <h3>Multi Outlet</h3>
              <p>Satu akun bisa kelola banyak tenant. Cocok untuk ekspansi bisnis.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-cta">
          <div className="lp-cta-box">
            <h2>Siap digitalisasi kasir outlet kamu?</h2>
            <p>Buat akun, setup tenant, dan langsung terima order hari ini juga.</p>
            <button className="lp-btn lp-btn-fill lp-btn-lg" onClick={() => r.push("/setup")}>
              Daftar Gratis Sekarang
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer">
          &copy; {new Date().getFullYear()} TerraPOS &mdash; POS modern untuk cafe & resto.
        </footer>
      </div>
    </main>
  );
}
