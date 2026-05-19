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
          background:linear-gradient(135deg,#fdf5ef,#f8ece0);border:1px solid #e8d5c4;
          position:relative;overflow:hidden;
        }
        .lp-cta-box::before{
          content:"";position:absolute;top:-30px;right:-30px;
          width:150px;height:150px;border-radius:50%;
          background:rgba(213,149,103,0.1);pointer-events:none;
        }
        .lp-cta-box::after{
          content:"";position:absolute;bottom:-20px;left:-20px;
          width:100px;height:100px;border-radius:50%;
          background:rgba(180,140,100,0.08);pointer-events:none;
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
        {/* DECORATIVE BACKGROUND ELEMENTS */}
        <div aria-hidden="true" style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
          {/* Large rock - bottom right */}
          <svg viewBox="0 0 120 80" style={{position:'absolute',bottom:'5%',right:'3%',width:140,opacity:0.08}}>
            <path d="M10 70c5-20 20-55 50-65s50 10 55 35c3 15-5 25-20 28s-40 5-60 8c-10 1-20-2-25-6z" fill="#8b7355"/>
            <path d="M30 65c3-15 15-40 35-48s35 5 40 22c2 8-2 15-12 18s-30 6-45 10c-6 1-15-1-18-2z" fill="#a08968"/>
          </svg>
          {/* Small rocks - left side */}
          <svg viewBox="0 0 60 40" style={{position:'absolute',bottom:'12%',left:'5%',width:70,opacity:0.1}}>
            <ellipse cx="30" cy="25" rx="25" ry="14" fill="#9e8b6e"/>
            <ellipse cx="22" cy="22" rx="15" ry="10" fill="#b3a084"/>
          </svg>
          {/* Pebbles cluster - top left */}
          <svg viewBox="0 0 80 50" style={{position:'absolute',top:'15%',left:'8%',width:90,opacity:0.07}}>
            <ellipse cx="20" cy="30" rx="12" ry="8" fill="#a08968"/>
            <ellipse cx="45" cy="25" rx="8" ry="6" fill="#8b7355"/>
            <ellipse cx="60" cy="35" rx="10" ry="7" fill="#b3a084"/>
          </svg>
          {/* Leaf 1 - top right area */}
          <svg viewBox="0 0 60 100" style={{position:'absolute',top:'8%',right:'10%',width:50,opacity:0.09,transform:'rotate(-15deg)'}}>
            <path d="M30 5c-15 20-25 50-20 80 0 0 8-5 15-20s10-35 12-55c0-3-2-5-7-5z" fill="#7a9e5a"/>
            <path d="M30 10c0 25-5 50-10 70" stroke="#5c7a42" strokeWidth="1.2" fill="none"/>
          </svg>
          {/* Leaf 2 - mid left */}
          <svg viewBox="0 0 50 80" style={{position:'absolute',top:'45%',left:'3%',width:40,opacity:0.08,transform:'rotate(20deg)'}}>
            <path d="M25 5c-12 15-20 40-15 65 0 0 6-4 12-16s8-28 9-44c0-3-2-5-6-5z" fill="#8aad6a"/>
            <path d="M25 8c0 20-4 40-8 56" stroke="#5c7a42" strokeWidth="1" fill="none"/>
          </svg>
          {/* Tree silhouette - far right */}
          <svg viewBox="0 0 80 160" style={{position:'absolute',top:'25%',right:'2%',width:70,opacity:0.05}}>
            <rect x="36" y="90" width="8" height="65" rx="3" fill="#6b5840"/>
            <ellipse cx="40" cy="55" rx="32" ry="45" fill="#6b8f4a"/>
            <ellipse cx="35" cy="40" rx="22" ry="30" fill="#7da35a"/>
          </svg>
          {/* Small leaf - bottom left area */}
          <svg viewBox="0 0 40 60" style={{position:'absolute',bottom:'30%',left:'12%',width:30,opacity:0.07,transform:'rotate(-30deg)'}}>
            <path d="M20 5c-8 12-14 30-10 48 0 0 5-3 9-12s6-22 6-32c0-2-1-4-5-4z" fill="#8aad6a"/>
          </svg>
          {/* Big rock - top right */}
          <svg viewBox="0 0 100 60" style={{position:'absolute',top:'60%',right:'8%',width:100,opacity:0.06}}>
            <path d="M5 50c8-15 25-40 50-45s35 8 40 25c3 10-3 18-15 20s-35 4-55 6c-8 0-16-2-20-6z" fill="#8b7355"/>
          </svg>
        </div>

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
