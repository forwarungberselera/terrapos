"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const r = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fffaf5",
        color: "#1f2937",
      }}
    >
      <style>{`
        .container{
          width:100%;
          max-width:1200px;
          margin:0 auto;
          padding:0 20px;
        }

        .topbar{
          position:sticky;
          top:0;
          z-index:30;
          backdrop-filter: blur(10px);
          background: rgba(255,250,245,0.9);
          border-bottom:1px solid #f1e5d8;
        }

        .nav{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:16px;
          min-height:72px;
        }

        .brand{
          font-size:24px;
          font-weight:900;
          letter-spacing:-0.02em;
          color:#ea6a00;
        }

        .navlinks{
          display:flex;
          align-items:center;
          gap:12px;
          flex-wrap:wrap;
        }

        .btn{
          border:1px solid #e5d5c4;
          background:#fff;
          color:#1f2937;
          padding:11px 16px;
          border-radius:14px;
          font-weight:800;
          cursor:pointer;
        }

        .btn:hover{
          background:#fff3e8;
        }

        .btn-primary{
          background:#f97316;
          color:#fff;
          border-color:#f97316;
        }

        .btn-primary:hover{
          background:#ea580c;
        }

        .hero{
          padding:72px 0 34px;
        }

        .hero-grid{
          display:grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap:28px;
          align-items:center;
        }

        @media (max-width: 960px){
          .hero-grid{
            grid-template-columns: 1fr;
          }
        }

        .hero-card{
          background:#fff;
          border:1px solid #f1e5d8;
          border-radius:28px;
          padding:28px;
          box-shadow: 0 10px 30px rgba(17,24,39,0.05);
        }

        .eyebrow{
          display:inline-flex;
          align-items:center;
          gap:8px;
          background:#fff3e8;
          color:#ea6a00;
          border:1px solid #ffd5b5;
          padding:8px 12px;
          border-radius:999px;
          font-size:12px;
          font-weight:900;
        }

        .hero h1{
          margin:18px 0 0;
          font-size:54px;
          line-height:1.02;
          letter-spacing:-0.04em;
        }

        @media (max-width: 640px){
          .hero h1{
            font-size:38px;
          }
        }

        .hero p{
          margin:18px 0 0;
          font-size:18px;
          line-height:1.7;
          color:#6b7280;
          max-width:700px;
        }

        .hero-actions{
          display:flex;
          flex-wrap:wrap;
          gap:12px;
          margin-top:24px;
        }

        .hero-badges{
          display:grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap:12px;
          margin-top:22px;
        }

        @media (max-width: 640px){
          .hero-badges{
            grid-template-columns: 1fr;
          }
        }

        .mini{
          background:#fff;
          border:1px solid #f1e5d8;
          border-radius:18px;
          padding:14px;
        }

        .mini-label{
          font-size:12px;
          color:#6b7280;
          font-weight:800;
        }

        .mini-value{
          margin-top:8px;
          font-size:22px;
          font-weight:900;
          color:#111827;
        }

        .mockup{
          background:#111827;
          color:#fff;
          border-radius:28px;
          padding:18px;
          box-shadow: 0 20px 45px rgba(17,24,39,0.16);
        }

        .mockup-top{
          display:flex;
          gap:8px;
          margin-bottom:14px;
        }

        .dot{
          width:10px;
          height:10px;
          border-radius:999px;
          background:#374151;
        }

        .mockup-screen{
          background:#fffaf5;
          color:#111827;
          border-radius:22px;
          padding:18px;
          min-height:420px;
          border:1px solid rgba(255,255,255,0.08);
        }

        .screen-grid{
          display:grid;
          grid-template-columns: 1fr 240px;
          gap:14px;
        }

        @media (max-width: 640px){
          .screen-grid{
            grid-template-columns: 1fr;
          }
        }

        .screen-panel{
          background:#fff;
          border:1px solid #f1e5d8;
          border-radius:18px;
          padding:14px;
        }

        .screen-title{
          font-size:14px;
          font-weight:900;
        }

        .screen-sub{
          margin-top:4px;
          font-size:12px;
          color:#6b7280;
        }

        .menu-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap:10px;
          margin-top:12px;
        }

        .menu-item{
          border:1px solid #f1e5d8;
          border-radius:14px;
          padding:12px;
          background:#fffaf5;
        }

        .menu-name{
          font-weight:900;
          font-size:13px;
        }

        .menu-price{
          margin-top:6px;
          color:#ea6a00;
          font-weight:900;
          font-size:13px;
        }

        .section{
          padding:22px 0 14px;
        }

        .section-head{
          max-width:760px;
          margin-bottom:18px;
        }

        .section-head h2{
          margin:0;
          font-size:36px;
          line-height:1.1;
          letter-spacing:-0.03em;
        }

        .section-head p{
          margin:12px 0 0;
          color:#6b7280;
          line-height:1.7;
          font-size:16px;
        }

        .cards{
          display:grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap:16px;
        }

        @media (max-width: 980px){
          .cards{
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px){
          .cards{
            grid-template-columns: 1fr;
          }
        }

        .card{
          background:#fff;
          border:1px solid #f1e5d8;
          border-radius:22px;
          padding:20px;
          box-shadow: 0 10px 25px rgba(17,24,39,0.04);
        }

        .card h3{
          margin:0;
          font-size:18px;
        }

        .card p{
          margin:10px 0 0;
          color:#6b7280;
          line-height:1.7;
          font-size:14px;
        }

        .steps{
          display:grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap:16px;
        }

        @media (max-width: 980px){
          .steps{
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px){
          .steps{
            grid-template-columns: 1fr;
          }
        }

        .step-no{
          width:36px;
          height:36px;
          border-radius:999px;
          background:#fff3e8;
          border:1px solid #ffd5b5;
          color:#ea6a00;
          display:grid;
          place-items:center;
          font-weight:900;
          margin-bottom:12px;
        }

        .pricing{
          display:grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap:16px;
        }

        @media (max-width: 980px){
          .pricing{
            grid-template-columns: 1fr;
          }
        }

        .price-card{
          background:#fff;
          border:1px solid #f1e5d8;
          border-radius:24px;
          padding:24px;
          box-shadow: 0 10px 25px rgba(17,24,39,0.04);
        }

        .price-card.featured{
          border-color:#f97316;
          box-shadow: 0 18px 40px rgba(249,115,22,0.14);
        }

        .price-name{
          font-size:18px;
          font-weight:900;
        }

        .price{
          margin-top:14px;
          font-size:40px;
          font-weight:900;
          line-height:1;
        }

        .price-sub{
          margin-top:8px;
          color:#6b7280;
          font-size:14px;
        }

        .feature-list{
          margin-top:18px;
          display:grid;
          gap:10px;
          color:#374151;
          font-size:14px;
        }

        .feature{
          display:flex;
          gap:10px;
          align-items:flex-start;
        }

        .cta{
          padding:30px 0 72px;
        }

        .cta-box{
          background:#111827;
          color:#fff;
          border-radius:28px;
          padding:30px;
          display:flex;
          justify-content:space-between;
          gap:20px;
          align-items:center;
          flex-wrap:wrap;
        }

        .cta-box h3{
          margin:0;
          font-size:34px;
          line-height:1.1;
        }

        .cta-box p{
          margin:10px 0 0;
          color:rgba(255,255,255,0.78);
          max-width:620px;
          line-height:1.7;
        }

        .footer{
          border-top:1px solid #f1e5d8;
          padding:20px 0 36px;
          color:#6b7280;
          font-size:14px;
        }
      `}</style>

      {/* TOPBAR */}
      <header className="topbar">
        <div className="container nav">
          <div className="brand">TerraPOS</div>

          <div className="navlinks">
            <button className="btn" onClick={() => document.getElementById("fitur")?.scrollIntoView({ behavior: "smooth" })}>
              Fitur
            </button>
            <button className="btn" onClick={() => document.getElementById("harga")?.scrollIntoView({ behavior: "smooth" })}>
              Harga
            </button>
            <button className="btn" onClick={() => r.push("/login")}>
              Login
            </button>
            <button className="btn btn-primary" onClick={() => r.push("/setup")}>
              Mulai Sekarang
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-card">
            <div className="eyebrow">POS SaaS untuk Cafe & Resto</div>

            <h1>
              Kelola kasir, meja, laporan, dan printer dalam satu sistem.
            </h1>

            <p>
              TerraPOS membantu cafe dan resto menjalankan operasional lebih rapi:
              order cepat, bayar sekarang atau nanti, QR meja, laporan penjualan,
              dan cetak struk langsung ke RawBT.
            </p>

            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => r.push("/setup")}>
                Coba TerraPOS
              </button>
              <button className="btn" onClick={() => r.push("/login")}>
                Masuk ke Dashboard
              </button>
            </div>

            <div className="hero-badges">
              <div className="mini">
                <div className="mini-label">Cocok untuk</div>
                <div className="mini-value">Cafe & Resto</div>
              </div>
              <div className="mini">
                <div className="mini-label">Mode Print</div>
                <div className="mini-value">Browser + RawBT</div>
              </div>
              <div className="mini">
                <div className="mini-label">Sistem</div>
                <div className="mini-value">Multi Tenant SaaS</div>
              </div>
            </div>
          </div>

          <div className="mockup">
            <div className="mockup-top">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>

            <div className="mockup-screen">
              <div className="screen-grid">
                <div className="screen-panel">
                  <div className="screen-title">POS TerraPOS</div>
                  <div className="screen-sub">Bayar Sekarang / Bayar Nanti</div>

                  <div className="menu-grid">
                    <div className="menu-item">
                      <div className="menu-name">Kopi Susu</div>
                      <div className="menu-price">Rp 18.000</div>
                    </div>
                    <div className="menu-item">
                      <div className="menu-name">Nasi Goreng</div>
                      <div className="menu-price">Rp 22.000</div>
                    </div>
                    <div className="menu-item">
                      <div className="menu-name">Es Teh</div>
                      <div className="menu-price">Rp 8.000</div>
                    </div>
                    <div className="menu-item">
                      <div className="menu-name">Mie Ayam</div>
                      <div className="menu-price">Rp 20.000</div>
                    </div>
                  </div>
                </div>

                <div className="screen-panel">
                  <div className="screen-title">Keranjang</div>
                  <div className="screen-sub">Meja 3</div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div className="menu-item">
                      <div className="menu-name">Kopi Susu x1</div>
                      <div className="menu-price">Rp 18.000</div>
                    </div>
                    <div className="menu-item">
                      <div className="menu-name">Nasi Goreng x1</div>
                      <div className="menu-price">Rp 22.000</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div className="screen-sub">Total</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#ea6a00", marginTop: 4 }}>
                      Rp 40.000
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="screen-panel">
                  <div className="screen-title">Dashboard Admin</div>
                  <div className="screen-sub">Omzet, top produk, printer, QR meja, dan laporan dalam satu panel.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FITUR */}
      <section className="section" id="fitur">
        <div className="container">
          <div className="section-head">
            <h2>Fitur lengkap untuk operasional cafe dan resto</h2>
            <p>
              TerraPOS dirancang agar admin dan kasir bisa bekerja cepat, sambil tetap mudah memantau penjualan dan mengatur sistem.
            </p>
          </div>

          <div className="cards">
            <div className="card">
              <h3>POS Dual Mode</h3>
              <p>
                Terima order dengan dua alur: bayar langsung atau simpan dulu per meja lalu bayar nanti di kasir.
              </p>
            </div>

            <div className="card">
              <h3>RawBT Print</h3>
              <p>
                Struk bisa langsung terkirim ke RawBT, cocok untuk printer bluetooth thermal yang umum dipakai cafe.
              </p>
            </div>

            <div className="card">
              <h3>Dashboard Premium</h3>
              <p>
                Lihat omzet hari ini, omzet bulan ini, grafik 7 hari, metode pembayaran, dan top produk dalam satu tampilan modern.
              </p>
            </div>

            <div className="card">
              <h3>QR Meja</h3>
              <p>
                Buat QR untuk tiap meja supaya order lebih cepat dan alur resto lebih rapi.
              </p>
            </div>

            <div className="card">
              <h3>Reports & Export Excel</h3>
              <p>
                Rekap penjualan tersimpan rapi dan bisa diexport ke Excel untuk kebutuhan analisis atau pembukuan.
              </p>
            </div>

            <div className="card">
              <h3>Multi Tenant SaaS</h3>
              <p>
                Struktur sistem sudah siap untuk banyak tenant/outlet sehingga cocok dijual sebagai layanan SaaS.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CARA KERJA */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Cara kerja TerraPOS</h2>
            <p>
              Alur sederhana, cepat dipahami, dan cocok untuk operasional harian di outlet.
            </p>
          </div>

          <div className="steps">
            <div className="card">
              <div className="step-no">1</div>
              <h3>Setup Tenant</h3>
              <p>Buat tenant/outlet dan masuk dengan akun yang sudah terhubung ke sistem.</p>
            </div>

            <div className="card">
              <div className="step-no">2</div>
              <h3>Kelola Menu</h3>
              <p>Tambahkan produk, kategori, harga, dan siapkan tampilan kasir sesuai kebutuhan outlet.</p>
            </div>

            <div className="card">
              <div className="step-no">3</div>
              <h3>Terima Order</h3>
              <p>Input order di POS, pilih meja bila perlu, lalu lanjut bayar sekarang atau simpan untuk bayar nanti.</p>
            </div>

            <div className="card">
              <div className="step-no">4</div>
              <h3>Cetak & Analisis</h3>
              <p>Struk tercetak ke printer, data tersimpan ke dashboard, dan admin bisa lihat statistik penjualan.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HARGA */}
      <section className="section" id="harga">
        <div className="container">
          <div className="section-head">
            <h2>Harga sederhana, mudah dipilih</h2>
            <p>
              Cocok untuk outlet kecil sampai bisnis yang ingin berkembang menjadi banyak tenant atau cabang.
            </p>
          </div>

          <div className="pricing">
            <div className="price-card">
              <div className="price-name">Starter</div>
              <div className="price">Rp79k</div>
              <div className="price-sub">per bulan / outlet</div>

              <div className="feature-list">
                <div className="feature">✓ POS dasar</div>
                <div className="feature">✓ Order & pembayaran</div>
                <div className="feature">✓ Browser print</div>
                <div className="feature">✓ Laporan dasar</div>
              </div>

              <button className="btn" style={{ width: "100%", marginTop: 20 }} onClick={() => r.push("/setup")}>
                Pilih Starter
              </button>
            </div>

            <div className="price-card featured">
              <div className="price-name">Pro</div>
              <div className="price">Rp149k</div>
              <div className="price-sub">per bulan / outlet</div>

              <div className="feature-list">
                <div className="feature">✓ Semua fitur Starter</div>
                <div className="feature">✓ RawBT direct print</div>
                <div className="feature">✓ Dashboard premium</div>
                <div className="feature">✓ QR meja</div>
                <div className="feature">✓ Export Excel</div>
              </div>

              <button className="btn btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={() => r.push("/setup")}>
                Pilih Pro
              </button>
            </div>

            <div className="price-card">
              <div className="price-name">Enterprise</div>
              <div className="price">Custom</div>
              <div className="price-sub">untuk multi outlet besar</div>

              <div className="feature-list">
                <div className="feature">✓ Multi tenant / cabang</div>
                <div className="feature">✓ Kustomisasi lanjutan</div>
                <div className="feature">✓ Integrasi operasional</div>
                <div className="feature">✓ Dukungan prioritas</div>
              </div>

              <button className="btn" style={{ width: "100%", marginTop: 20 }} onClick={() => r.push("/login")}>
                Hubungi Kami
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="container">
          <div className="cta-box">
            <div>
              <h3>Siap pakai TerraPOS untuk outlet kamu?</h3>
              <p>
                Mulai atur tenant, kelola menu, terima order, cetak struk, dan pantau penjualan dari dashboard premium.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => r.push("/setup")}>
                Mulai Sekarang
              </button>
              <button className="btn" onClick={() => r.push("/login")}>
                Login
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          © {new Date().getFullYear()} TerraPOS — SaaS POS untuk cafe & resto.
        </div>
      </footer>
    </main>
  );
}