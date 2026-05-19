"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  DEFAULT_LANDING_CONFIG,
  getCachedLandingConfig,
  subscribeLandingConfig,
  LandingConfig,
} from "@/lib/landing-config";

export default function HomePage() {
  const r = useRouter();
  const [config, setConfig] = useState<LandingConfig>(
    getCachedLandingConfig() || DEFAULT_LANDING_CONFIG
  );

  // APK: langsung ke login, skip landing page
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      r.replace("/login");
    }
  }, [r]);

  // Subscribe to landing config from Firestore
  useEffect(() => {
    const unsub = subscribeLandingConfig((c) => setConfig(c));
    return () => unsub();
  }, []);

  const { hero, features, featuresTitle, pricing, pricingTitle, pricingSubtitle, ctaTitle, ctaSubtitle, footerText } = config;

  return (
    <main>
      <style>{`
        .lp{
          min-height:100vh;
          background:#ffffff;
          color:#1a1a1a;
          font-family:var(--font-primary, ui-sans-serif, system-ui, -apple-system, sans-serif);
          overflow-x:hidden;
          position:relative;
        }
        .lp::before{
          content:"";
          position:fixed;top:0;left:0;right:0;bottom:0;
          pointer-events:none;z-index:0;
          opacity:0.035;
          background-image:
            radial-gradient(ellipse 300px 300px at 10% 20%, #c8a882 0%, transparent 70%),
            radial-gradient(ellipse 250px 250px at 85% 15%, #b8976e 0%, transparent 70%),
            radial-gradient(ellipse 200px 200px at 70% 80%, #d4b896 0%, transparent 70%),
            radial-gradient(ellipse 180px 180px at 20% 75%, #a08060 0%, transparent 70%),
            url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5c2 0 4 3 3 6s-4 5-7 4-4-4-3-7 4-4 7-3zm15 20c1.5 0 3 2 2.5 4.5s-3 3.5-5 3-3-3-2.5-5.5 3-3 5-2zm-35 8c1 0 2.5 2 2 4s-2.5 3-4 2.5-2.5-2.5-2-4.5 2.5-2.5 4-2zm20 22c1.5 0 3.5 2.5 3 5.5s-3.5 4-5.5 3.5-3-3.5-2.5-6 3.5-3.5 5-3z' fill='%23a08060' fill-opacity='0.4'/%3E%3C/svg%3E");
        }
        .lp>*{position:relative;z-index:1;}

        /* NAV */
        .lp-nav{
          position:fixed;top:0;left:0;right:0;z-index:50;
          padding:16px 24px;
          display:flex;align-items:center;justify-content:space-between;
          backdrop-filter:blur(16px);
          background:rgba(255,255,255,0.85);
          border-bottom:1px solid #f0f0f0;
        }
        .lp-logo{font-size:22px;font-weight:900;letter-spacing:-0.03em;}
        .lp-logo span{color:var(--brand,#d59567);}
        .lp-nav-btns{display:flex;gap:8px;align-items:center;}

        /* BUTTONS */
        .lp-btn{
          padding:10px 20px;border-radius:10px;font-weight:700;font-size:14px;
          border:none;cursor:pointer;transition:all 0.15s ease;
        }
        .lp-btn-ghost{
          background:transparent;color:#555;border:1px solid #e5e5e5;
        }
        .lp-btn-ghost:hover{background:#f9f9f9;border-color:#d0d0d0;}
        .lp-btn-fill{
          background:var(--brand,#d59567);color:#fff;
        }
        .lp-btn-fill:hover{opacity:0.9;transform:translateY(-1px);}
        .lp-btn-lg{padding:14px 28px;font-size:15px;border-radius:12px;}

        /* HERO */
        .lp-hero{
          min-height:90vh;display:flex;flex-direction:column;
          align-items:center;justify-content:center;text-align:center;
          padding:120px 24px 80px;
          position:relative;
          overflow:hidden;
        }
        .lp-hero::before{
          content:"";position:absolute;top:-100px;right:-100px;
          width:500px;height:500px;border-radius:50%;
          background:radial-gradient(circle,rgba(213,149,103,0.06) 0%,transparent 70%);
          pointer-events:none;
        }
        .lp-hero::after{
          content:"";position:absolute;bottom:-60px;left:-80px;
          width:400px;height:400px;border-radius:50%;
          background:radial-gradient(circle,rgba(180,140,100,0.04) 0%,transparent 70%);
          pointer-events:none;
        }
        .lp-badge{
          display:inline-flex;align-items:center;gap:6px;
          padding:7px 16px;border-radius:999px;
          background:#fdf5ef;border:1px solid #f0ddd0;
          color:var(--brand,#d59567);font-size:13px;font-weight:700;
          margin-bottom:24px;
        }
        .lp-hero h1{
          font-size:clamp(36px,7vw,64px);font-weight:900;
          line-height:1.1;letter-spacing:-0.04em;margin:0;max-width:650px;
        }
        .lp-hero h1 em{
          font-style:normal;color:var(--brand,#d59567);
        }
        .lp-hero-sub{
          margin-top:20px;font-size:17px;line-height:1.7;
          color:#666;max-width:500px;
        }
        .lp-hero-actions{
          margin-top:32px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;
        }

        /* FEATURES */
        .lp-section{
          padding:80px 24px;max-width:1000px;margin:0 auto;
          position:relative;
        }
        .lp-section-title{
          text-align:center;font-size:30px;font-weight:900;
          letter-spacing:-0.02em;margin:0 0 12px;
        }
        .lp-section-sub{
          text-align:center;color:#666;font-size:15px;margin:0 0 48px;
        }
        .lp-features-grid{
          display:grid;grid-template-columns:repeat(3,1fr);gap:20px;
        }
        @media(max-width:768px){
          .lp-features-grid{grid-template-columns:1fr;}
        }
        .lp-feature-card{
          padding:24px;border-radius:16px;
          border:1px solid #f0f0f0;background:#fafafa;
          transition:all 0.2s ease;
        }
        .lp-feature-card:hover{
          border-color:#e0d5cc;background:#fdf8f4;transform:translateY(-2px);
          box-shadow:0 8px 24px rgba(0,0,0,0.04);
        }
        .lp-feature-icon{
          width:42px;height:42px;border-radius:10px;
          background:#fdf5ef;display:grid;place-items:center;
          font-size:20px;margin-bottom:14px;
        }
        .lp-feature-card h3{font-size:15px;font-weight:800;margin:0 0 6px;}
        .lp-feature-card p{font-size:13px;line-height:1.6;color:#777;margin:0;}

        /* PRICING */
        .lp-pricing-grid{
          display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:start;
        }
        @media(max-width:860px){
          .lp-pricing-grid{grid-template-columns:1fr;}
        }
        .lp-price-card{
          padding:28px 24px;border-radius:18px;
          border:1px solid #f0f0f0;background:#fff;
          transition:all 0.2s ease;
        }
        .lp-price-card.highlighted{
          border-color:var(--brand,#d59567);
          box-shadow:0 12px 36px rgba(213,149,103,0.12);
          position:relative;
        }
        .lp-price-card.highlighted::before{
          content:"Populer";position:absolute;top:-12px;left:50%;transform:translateX(-50%);
          background:var(--brand,#d59567);color:#fff;font-size:11px;font-weight:800;
          padding:4px 12px;border-radius:999px;
        }
        .lp-price-name{font-size:18px;font-weight:800;margin-bottom:4px;}
        .lp-price-desc{font-size:13px;color:#888;margin-bottom:16px;}
        .lp-price-amount{font-size:36px;font-weight:900;line-height:1;}
        .lp-price-period{font-size:14px;color:#888;font-weight:500;}
        .lp-price-features{
          margin-top:20px;display:grid;gap:10px;
          padding-top:20px;border-top:1px solid #f0f0f0;
        }
        .lp-price-feat{
          font-size:13px;color:#555;display:flex;align-items:center;gap:8px;
        }
        .lp-price-feat::before{
          content:"✓";color:var(--brand,#d59567);font-weight:900;font-size:14px;
        }
        .lp-price-card .lp-btn{width:100%;margin-top:20px;text-align:center;}

        /* CTA */
        .lp-cta{padding:60px 24px 80px;text-align:center;}
        .lp-cta-box{
          max-width:540px;margin:0 auto;padding:48px 32px;border-radius:24px;
          background:linear-gradient(135deg,#fdf8f4,#faf5f0);border:1px solid #f0e6dc;
          position:relative;overflow:hidden;
        }
        .lp-cta-box::before{
          content:"";position:absolute;top:-30px;right:-30px;
          width:120px;height:120px;border-radius:50%;
          background:rgba(213,149,103,0.06);pointer-events:none;
        }
        .lp-cta-box h2{font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 10px;}
        .lp-cta-box p{color:#666;font-size:15px;line-height:1.6;margin:0 0 24px;}

        /* FOOTER */
        .lp-footer{
          padding:24px;text-align:center;color:#aaa;font-size:12px;
          border-top:1px solid #f5f5f5;
        }

        @media(max-width:640px){
          .lp-nav{padding:12px 16px;}
          .lp-hero{padding:100px 16px 60px;}
          .lp-section{padding:48px 16px;}
          .lp-cta{padding:40px 16px 60px;}
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
          <div className="lp-badge">{hero.badge}</div>
          <h1>
            {hero.headline} <em>{hero.headlineHighlight}</em>
          </h1>
          <p className="lp-hero-sub">{hero.subtitle}</p>
          <div className="lp-hero-actions">
            <button className="lp-btn lp-btn-fill lp-btn-lg" onClick={() => r.push("/setup")}>
              {hero.ctaPrimary}
            </button>
            <button className="lp-btn lp-btn-ghost lp-btn-lg" onClick={() => r.push("/login")}>
              {hero.ctaSecondary}
            </button>
          </div>
        </section>

        {/* FEATURES */}
        <section className="lp-section" id="fitur">
          <h2 className="lp-section-title">{featuresTitle}</h2>
          <div className="lp-features-grid">
            {features.map((f, i) => (
              <div key={i} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section className="lp-section" id="harga">
          <h2 className="lp-section-title">{pricingTitle}</h2>
          <p className="lp-section-sub">{pricingSubtitle}</p>
          <div className="lp-pricing-grid">
            {pricing.map((plan, i) => (
              <div key={i} className={`lp-price-card ${plan.highlighted ? "highlighted" : ""}`}>
                <div className="lp-price-name">{plan.name}</div>
                <div className="lp-price-desc">{plan.description}</div>
                <div>
                  <span className="lp-price-amount">{plan.price}</span>
                  {plan.period && <span className="lp-price-period">{plan.period}</span>}
                </div>
                <div className="lp-price-features">
                  {plan.features.map((feat, j) => (
                    <div key={j} className="lp-price-feat">{feat}</div>
                  ))}
                </div>
                <button
                  className={`lp-btn ${plan.highlighted ? "lp-btn-fill" : "lp-btn-ghost"}`}
                  onClick={() => r.push("/setup")}
                >
                  {plan.ctaText}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="lp-cta">
          <div className="lp-cta-box">
            <h2>{ctaTitle}</h2>
            <p>{ctaSubtitle}</p>
            <button className="lp-btn lp-btn-fill lp-btn-lg" onClick={() => r.push("/setup")}>
              {hero.ctaPrimary}
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer">
          &copy; {new Date().getFullYear()} {footerText}
        </footer>
      </div>
    </main>
  );
}
