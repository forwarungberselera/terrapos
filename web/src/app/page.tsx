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

  // Subscribe to landing config from Firestore (safe - fallback to defaults)
  useEffect(() => {
    try {
      const unsub = subscribeLandingConfig((c) => setConfig(c));
      return () => unsub();
    } catch {
      // If Firestore fails entirely, keep defaults
      return () => {};
    }
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

        /* FLOATING NATURE ELEMENTS */
        @keyframes floatDrift{
          0%{transform:translate(0,0) rotate(0deg);}
          25%{transform:translate(15px,-20px) rotate(5deg);}
          50%{transform:translate(-10px,-35px) rotate(-3deg);}
          75%{transform:translate(20px,-15px) rotate(4deg);}
          100%{transform:translate(0,0) rotate(0deg);}
        }
        @keyframes floatSlow{
          0%{transform:translate(0,0) rotate(0deg);}
          33%{transform:translate(-12px,18px) rotate(-4deg);}
          66%{transform:translate(10px,-12px) rotate(3deg);}
          100%{transform:translate(0,0) rotate(0deg);}
        }
        @keyframes floatRock{
          0%{transform:translate(0,0);}
          50%{transform:translate(5px,8px);}
          100%{transform:translate(0,0);}
        }
        .lp-bg-elements{
          position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;
        }
        .lp-float{
          position:absolute;
          will-change:transform;
        }
        .lp-float--leaf{animation:floatDrift 20s ease-in-out infinite;}
        .lp-float--rock{animation:floatRock 25s ease-in-out infinite;}
        .lp-float--tree{animation:floatSlow 30s ease-in-out infinite;}

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
          background:linear-gradient(180deg,#fff 0%,#fdfaf7 100%);
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
        .lp-section--features{
          background:#f9f7f5;
          max-width:100%;padding:80px 24px;
        }
        .lp-section--features .lp-section-inner{
          max-width:1000px;margin:0 auto;
        }
        .lp-section--pricing{
          background:#ffffff;
          max-width:100%;padding:80px 24px;
        }
        .lp-section--pricing .lp-section-inner{
          max-width:1000px;margin:0 auto;
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
        .lp-cta{padding:60px 24px 80px;text-align:center;background:#faf8f6;}
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
        {/* ANIMATED FLOATING BACKGROUND ELEMENTS */}
        <div className="lp-bg-elements" aria-hidden="true">
          {/* Leaves */}
          {[
            {t:8,l:5,s:28,d:18,r:-20},{t:15,l:85,s:22,d:22,r:15},{t:35,l:3,s:24,d:25,r:30},
            {t:55,l:90,s:20,d:19,r:-10},{t:72,l:8,s:26,d:23,r:45},{t:88,l:75,s:18,d:21,r:-35},
            {t:25,l:92,s:16,d:27,r:20},{t:45,l:12,s:20,d:20,r:-25},{t:65,l:95,s:22,d:24,r:10},
            {t:5,l:45,s:18,d:26,r:-15},{t:78,l:40,s:14,d:22,r:35},{t:92,l:20,s:20,d:19,r:-40},
          ].map((p, i) => (
            <svg key={`leaf-${i}`} className="lp-float lp-float--leaf" viewBox="0 0 40 60"
              style={{top:`${p.t}%`,left:`${p.l}%`,width:p.s,opacity:0.09+(i%3)*0.02,
                      animationDuration:`${p.d}s`,transform:`rotate(${p.r}deg)`,animationDelay:`${i*-1.5}s`}}>
              <path d="M20 3c-10 12-16 32-12 50 0 0 5-3 10-14s7-24 7-32c0-2-1-4-5-4z" fill="#7a9e5a"/>
              <path d="M20 6c0 18-3 35-7 48" stroke="#5c7a42" strokeWidth="0.8" fill="none"/>
            </svg>
          ))}
          {/* Rocks / Pebbles */}
          {[
            {t:90,l:80,s:50,d:28},{t:85,l:10,s:40,d:32},{t:70,l:60,s:35,d:26},
            {t:20,l:75,s:30,d:30},{t:50,l:2,s:45,d:24},{t:95,l:50,s:38,d:29},
            {t:30,l:88,s:28,d:27},{t:60,l:15,s:32,d:31},{t:10,l:30,s:25,d:25},
          ].map((p, i) => (
            <svg key={`rock-${i}`} className="lp-float lp-float--rock" viewBox="0 0 60 40"
              style={{top:`${p.t}%`,left:`${p.l}%`,width:p.s,opacity:0.06+(i%3)*0.015,
                      animationDuration:`${p.d}s`,animationDelay:`${i*-2}s`}}>
              <ellipse cx="30" cy="24" rx={22-i%5} ry={12-i%3} fill="#9e8b6e"/>
              <ellipse cx={25+i%8} cy={22} rx={14-i%4} ry={8-i%2} fill="#b3a084"/>
            </svg>
          ))}
          {/* Trees */}
          {[
            {t:20,l:96,s:55,d:35},{t:40,l:-1,s:48,d:32},{t:75,l:93,s:42,d:28},
          ].map((p, i) => (
            <svg key={`tree-${i}`} className="lp-float lp-float--tree" viewBox="0 0 60 120"
              style={{top:`${p.t}%`,left:`${p.l}%`,width:p.s,opacity:0.04+i*0.01,
                      animationDuration:`${p.d}s`,animationDelay:`${i*-4}s`}}>
              <rect x="27" y="70" width="6" height="45" rx="2" fill="#6b5840"/>
              <ellipse cx="30" cy="42" rx="24" ry="35" fill="#6b8f4a"/>
              <ellipse cx="27" cy="32" rx="16" ry="24" fill="#7da35a"/>
            </svg>
          ))}
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
        <section className="lp-section--features" id="fitur">
          <div className="lp-section-inner">
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
          </div>
        </section>

        {/* PRICING */}
        <section className="lp-section--pricing" id="harga">
          <div className="lp-section-inner">
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
