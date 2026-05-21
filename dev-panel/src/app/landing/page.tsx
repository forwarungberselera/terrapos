"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface Feature {
  title: string;
  description: string;
}

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  yearlyPrice: string;
  yearlyPeriod: string;
  description: string;
  features: string[];
  highlighted: boolean;
  ctaText: string;
  ctaLink: string;
}

interface LandingData {
  hero: { title: string; subtitle: string };
  features: Feature[];
  pricing: PricingPlan[];
}

const EMPTY_LANDING: LandingData = {
  hero: { title: "", subtitle: "" },
  features: [],
  pricing: [
    { name: "Seed", price: "Segera Hadir", period: "", yearlyPrice: "Segera Hadir", yearlyPeriod: "", description: "Untuk memulai bisnis kecil", features: ["Point of Sales", "Management Product", "Laporan Penjualan", "Shift System", "Single Outlet", "1 User"], highlighted: false, ctaText: "Hubungi Kami", ctaLink: "/setup" },
    { name: "Core", price: "Segera Hadir", period: "", yearlyPrice: "Segera Hadir", yearlyPeriod: "", description: "Untuk bisnis yang berkembang", features: ["Semua fitur Seed", "Promo & Discount", "Staff Management (3-5 user)", "Audit Log", "QR Meja"], highlighted: true, ctaText: "Hubungi Kami", ctaLink: "/setup" },
    { name: "Orbit", price: "Segera Hadir", period: "", yearlyPrice: "Segera Hadir", yearlyPeriod: "", description: "Untuk enterprise & multi-outlet", features: ["Semua fitur Core", "Multi-outlet management", "Unlimited user", "Priority support", "Custom branding", "API access", "Dedicated account manager"], highlighted: false, ctaText: "Hubungi Kami", ctaLink: "/setup" },
  ],
};

export default function LandingPage() {
  const [data, setData] = useState<LandingData>(EMPTY_LANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "system", "landingPage"));
        if (snap.exists()) {
          const raw = snap.data();
          setData({
            hero: raw.hero || { title: "", subtitle: "" },
            features: raw.features || [],
            pricing: (raw.pricing || []).map((p: any) => ({
              name: p.name || "",
              price: p.price || "Segera Hadir",
              period: p.period || "",
              yearlyPrice: p.yearlyPrice || "Segera Hadir",
              yearlyPeriod: p.yearlyPeriod || "",
              description: p.description || "",
              features: Array.isArray(p.features) ? p.features : [],
              highlighted: p.highlighted ?? false,
              ctaText: p.ctaText || "Hubungi Kami",
              ctaLink: p.ctaLink || "/setup",
            })),
          });
        }
      } catch (e) {
        console.error("Failed to load landing page data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "system", "landingPage"), data);
      setSaved(true);
    } catch (e) {
      console.error("Failed to save:", e);
      alert("Failed to save landing page data.");
    } finally {
      setSaving(false);
    }
  };

  const updateHero = (field: "title" | "subtitle", value: string) => {
    setData((prev) => ({ ...prev, hero: { ...prev.hero, [field]: value } }));
    setSaved(false);
  };

  const addFeature = () => {
    setData((prev) => ({
      ...prev,
      features: [...prev.features, { title: "", description: "" }],
    }));
    setSaved(false);
  };

  const updateFeature = (index: number, field: keyof Feature, value: string) => {
    setData((prev) => {
      const features = [...prev.features];
      features[index] = { ...features[index], [field]: value };
      return { ...prev, features };
    });
    setSaved(false);
  };

  const removeFeature = (index: number) => {
    setData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
    setSaved(false);
  };

  const addPricing = () => {
    setData((prev) => ({
      ...prev,
      pricing: [...prev.pricing, { name: "", price: "Segera Hadir", period: "", yearlyPrice: "Segera Hadir", yearlyPeriod: "", description: "", features: [], highlighted: false, ctaText: "Hubungi Kami", ctaLink: "/setup" }],
    }));
    setSaved(false);
  };

  const updatePricing = (index: number, field: keyof PricingPlan, value: any) => {
    setData((prev) => {
      const pricing = [...prev.pricing];
      pricing[index] = { ...pricing[index], [field]: value };
      return { ...prev, pricing };
    });
    setSaved(false);
  };

  const updatePricingFeatures = (index: number, value: string) => {
    setData((prev) => {
      const pricing = [...prev.pricing];
      pricing[index] = { ...pricing[index], features: value.split("\n").filter(Boolean) };
      return { ...prev, pricing };
    });
    setSaved(false);
  };

  const removePricing = (index: number) => {
    setData((prev) => ({
      ...prev,
      pricing: prev.pricing.filter((_, i) => i !== index),
    }));
    setSaved(false);
  };

  return (
    <div>
      <h1 className="page-title">Landing Page Editor</h1>
      <p className="page-sub">Edit the public landing page content stored in system/landingPage.</p>

      {loading ? (
        <p className="small">Loading landing page data...</p>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save All Changes"}
            </button>
            {saved && <span className="small" style={{ color: "var(--success)" }}>✓ Saved!</span>}
          </div>

          {/* Hero Section */}
          <div className="card">
            <div className="card-title">Hero Section</div>
            <div className="card-sub">Main title and subtitle shown at the top of the landing page.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="small" style={{ display: "block", marginBottom: 4 }}>Title</label>
                <input
                  className="input"
                  value={data.hero.title}
                  onChange={(e) => updateHero("title", e.target.value)}
                  placeholder="e.g. TerraPOS — Point of Sale Modern"
                />
              </div>
              <div>
                <label className="small" style={{ display: "block", marginBottom: 4 }}>Subtitle</label>
                <input
                  className="input"
                  value={data.hero.subtitle}
                  onChange={(e) => updateHero("subtitle", e.target.value)}
                  placeholder="e.g. Solusi kasir digital untuk UMKM Indonesia."
                />
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <div className="card-title">Features</div>
              <div className="spacer" />
              <button className="btn" onClick={addFeature}>+ Add Feature</button>
            </div>
            <div className="card-sub">{data.features.length} feature(s) defined.</div>

            {data.features.length === 0 ? (
              <p className="small">No features yet. Click &quot;Add Feature&quot; to start.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.features.map((f, i) => (
                  <div key={i} style={{ padding: 12, background: "var(--input-bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div className="row" style={{ marginBottom: 8 }}>
                      <span className="badge">Feature {i + 1}</span>
                      <div className="spacer" />
                      <button className="btn btn-danger" onClick={() => removeFeature(i)} style={{ padding: "4px 8px", fontSize: 11 }}>
                        Remove
                      </button>
                    </div>
                    <input
                      className="input"
                      value={f.title}
                      onChange={(e) => updateFeature(i, "title", e.target.value)}
                      placeholder="Feature title"
                      style={{ marginBottom: 6 }}
                    />
                    <input
                      className="input"
                      value={f.description}
                      onChange={(e) => updateFeature(i, "description", e.target.value)}
                      placeholder="Feature description"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Section */}
          <div className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <div className="card-title">Pricing Plans</div>
              <div className="spacer" />
              <button className="btn" onClick={addPricing}>+ Add Plan</button>
            </div>
            <div className="card-sub">{data.pricing.length} plan(s) defined.</div>

            {data.pricing.length === 0 ? (
              <p className="small">No pricing plans yet. Click &quot;Add Plan&quot; to start.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.pricing.map((p, i) => (
                  <div key={i} style={{ padding: 16, background: "var(--input-bg)", borderRadius: 10, border: p.highlighted ? "2px solid var(--brand)" : "1px solid var(--border)" }}>
                    <div className="row" style={{ marginBottom: 10 }}>
                      <span className="badge">{p.name || `Plan ${i + 1}`}</span>
                      {p.highlighted && <span className="badge" style={{ background: "var(--brand)", color: "#fff", marginLeft: 6 }}>Populer</span>}
                      <div className="spacer" />
                      <button className="btn btn-danger" onClick={() => removePricing(i)} style={{ padding: "4px 8px", fontSize: 11 }}>
                        Remove
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="small" style={{ display: "block", marginBottom: 4 }}>Nama Paket</label>
                        <input className="input" value={p.name} onChange={(e) => updatePricing(i, "name", e.target.value)} placeholder="Seed / Core / Orbit" />
                      </div>
                      <div>
                        <label className="small" style={{ display: "block", marginBottom: 4 }}>Harga (Bulanan)</label>
                        <input className="input" value={p.price} onChange={(e) => updatePricing(i, "price", e.target.value)} placeholder="Rp 99.000 atau Segera Hadir" />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="small" style={{ display: "block", marginBottom: 4 }}>Periode (Bulanan)</label>
                        <input className="input" value={p.period} onChange={(e) => updatePricing(i, "period", e.target.value)} placeholder="/bulan atau kosong" />
                      </div>
                      <div>
                        <label className="small" style={{ display: "block", marginBottom: 4 }}>Harga (Tahunan)</label>
                        <input className="input" value={p.yearlyPrice} onChange={(e) => updatePricing(i, "yearlyPrice", e.target.value)} placeholder="Rp 999.000 atau Segera Hadir" />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="small" style={{ display: "block", marginBottom: 4 }}>Periode (Tahunan)</label>
                        <input className="input" value={p.yearlyPeriod} onChange={(e) => updatePricing(i, "yearlyPeriod", e.target.value)} placeholder="/tahun atau kosong" />
                      </div>
                      <div>
                        <label className="small" style={{ display: "block", marginBottom: 4 }}>Teks Tombol (CTA)</label>
                        <input className="input" value={p.ctaText} onChange={(e) => updatePricing(i, "ctaText", e.target.value)} placeholder="Hubungi Kami" />
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label className="small" style={{ display: "block", marginBottom: 4 }}>Link Tombol CTA</label>
                      <input className="input" value={p.ctaLink} onChange={(e) => updatePricing(i, "ctaLink", e.target.value)} placeholder="/setup atau https://wa.me/628xxx" />
                      <span className="small" style={{ color: "#888", marginTop: 2, display: "block" }}>Internal (/setup, /login) atau external (https://...)</span>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label className="small" style={{ display: "block", marginBottom: 4 }}>Deskripsi</label>
                      <input className="input" value={p.description} onChange={(e) => updatePricing(i, "description", e.target.value)} placeholder="Untuk memulai bisnis kecil" />
                    </div>
                    <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" id={`highlight-${i}`} checked={p.highlighted} onChange={(e) => updatePricing(i, "highlighted", e.target.checked)} />
                      <label htmlFor={`highlight-${i}`} className="small" style={{ fontWeight: 700 }}>Tandai sebagai &quot;Populer&quot;</label>
                    </div>
                    <div>
                      <label className="small" style={{ display: "block", marginBottom: 4 }}>Fitur (satu per baris)</label>
                      <textarea className="input" rows={4} value={p.features.join("\n")} onChange={(e) => updatePricingFeatures(i, e.target.value)} placeholder={"Point of Sales\nManagement Product\nLaporan Penjualan"} style={{ resize: "vertical" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
