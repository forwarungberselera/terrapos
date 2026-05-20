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
  features: string[];
}

interface LandingData {
  hero: { title: string; subtitle: string };
  features: Feature[];
  pricing: PricingPlan[];
}

const EMPTY_LANDING: LandingData = {
  hero: { title: "", subtitle: "" },
  features: [],
  pricing: [],
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
            pricing: raw.pricing || [],
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
      pricing: [...prev.pricing, { name: "", price: "", features: [] }],
    }));
    setSaved(false);
  };

  const updatePricing = (index: number, field: "name" | "price", value: string) => {
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
                  <div key={i} style={{ padding: 12, background: "var(--input-bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div className="row" style={{ marginBottom: 8 }}>
                      <span className="badge">{p.name || `Plan ${i + 1}`}</span>
                      <div className="spacer" />
                      <button className="btn btn-danger" onClick={() => removePricing(i)} style={{ padding: "4px 8px", fontSize: 11 }}>
                        Remove
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <input
                        className="input"
                        value={p.name}
                        onChange={(e) => updatePricing(i, "name", e.target.value)}
                        placeholder="Plan name (e.g. Basic)"
                      />
                      <input
                        className="input"
                        value={p.price}
                        onChange={(e) => updatePricing(i, "price", e.target.value)}
                        placeholder="Price (e.g. Rp 99.000/bln)"
                      />
                    </div>
                    <div>
                      <label className="small" style={{ display: "block", marginBottom: 4 }}>
                        Features (one per line)
                      </label>
                      <textarea
                        className="input"
                        rows={3}
                        value={p.features.join("\n")}
                        onChange={(e) => updatePricingFeatures(i, e.target.value)}
                        placeholder={"Feature 1\nFeature 2\nFeature 3"}
                        style={{ resize: "vertical" }}
                      />
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
