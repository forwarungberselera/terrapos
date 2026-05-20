"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

// ===== Types & Defaults (same as TerraPOS main app) =====

type BrandColorConfig = {
  brand: string;
  brand2: string;
  brandSoft: string;
  brandHover: string;
  bgLight: string;
  panelLight: string;
  bgDark: string;
  panelDark: string;
  borderLight: string;
  borderDark: string;
  textLight: string;
  mutedLight: string;
  textDark: string;
  mutedDark: string;
  danger: string;
  success: string;
  warning: string;
  inputBgLight: string;
  inputBgDark: string;
};

const DEFAULT_BRAND_COLORS: BrandColorConfig = {
  brand: "#d59567",
  brand2: "#e4b896",
  brandSoft: "#fdf5ef",
  brandHover: "#b87a4f",
  bgLight: "#faf8f6",
  panelLight: "#ffffff",
  bgDark: "#110e0b",
  panelDark: "#1c1814",
  borderLight: "#e8e0d8",
  borderDark: "#302820",
  textLight: "#1f1710",
  mutedLight: "#7a6b5e",
  textDark: "#f5f0eb",
  mutedDark: "#a89888",
  danger: "#dc4444",
  success: "#2d9b6a",
  warning: "#d4880a",
  inputBgLight: "#faf7f4",
  inputBgDark: "#221e19",
};

// ===== Color Presets (templates) =====

type ColorPreset = {
  id: string;
  name: string;
  description: string;
  colors: BrandColorConfig;
};

const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "terra-brown",
    name: "Coffee (Default)",
    description: "Cokelat hangat untuk cafe",
    colors: { ...DEFAULT_BRAND_COLORS },
  },
  {
    id: "terra-pink",
    name: "Pink Classic",
    description: "Pink klasik TerraPOS",
    colors: {
      brand: "#e6739d", brand2: "#f0a0be", brandSoft: "#fdf0f4", brandHover: "#d4607e",
      bgLight: "#f8f9fb", panelLight: "#ffffff", bgDark: "#0c0e14", panelDark: "#161920",
      borderLight: "#e5e7eb", borderDark: "#252836", textLight: "#111827", mutedLight: "#6b7280",
      textDark: "#f1f3f5", mutedDark: "#8b92a5", danger: "#ef4444", success: "#10b981",
      warning: "#f59e0b", inputBgLight: "#f9fafb", inputBgDark: "#1c1f2a",
    },
  },
  {
    id: "terra-blue",
    name: "Ocean Blue",
    description: "Biru profesional modern",
    colors: {
      brand: "#3b82f6", brand2: "#93c5fd", brandSoft: "#eff6ff", brandHover: "#2563eb",
      bgLight: "#f8fafc", panelLight: "#ffffff", bgDark: "#0b1120", panelDark: "#131b2e",
      borderLight: "#dbeafe", borderDark: "#1e3a5f", textLight: "#0f172a", mutedLight: "#64748b",
      textDark: "#f1f5f9", mutedDark: "#94a3b8", danger: "#ef4444", success: "#10b981",
      warning: "#f59e0b", inputBgLight: "#f8fafc", inputBgDark: "#162032",
    },
  },
  {
    id: "terra-green",
    name: "Nature Green",
    description: "Hijau segar untuk healthy food",
    colors: {
      brand: "#16a34a", brand2: "#86efac", brandSoft: "#f0fdf4", brandHover: "#15803d",
      bgLight: "#f7fdf9", panelLight: "#ffffff", bgDark: "#071210", panelDark: "#0f1f1a",
      borderLight: "#dcfce7", borderDark: "#1a3b2e", textLight: "#052e16", mutedLight: "#4d7c5e",
      textDark: "#ecfdf5", mutedDark: "#86b89a", danger: "#ef4444", success: "#22c55e",
      warning: "#eab308", inputBgLight: "#f7fdf9", inputBgDark: "#132a22",
    },
  },
  {
    id: "terra-purple",
    name: "Elegant Purple",
    description: "Ungu elegan untuk fine dining",
    colors: {
      brand: "#8b5cf6", brand2: "#c4b5fd", brandSoft: "#f5f3ff", brandHover: "#7c3aed",
      bgLight: "#faf8ff", panelLight: "#ffffff", bgDark: "#0d0a18", panelDark: "#161226",
      borderLight: "#e9e2f9", borderDark: "#2d2248", textLight: "#1e1037", mutedLight: "#6b5b8a",
      textDark: "#f3f0ff", mutedDark: "#a294c2", danger: "#ef4444", success: "#10b981",
      warning: "#f59e0b", inputBgLight: "#faf8ff", inputBgDark: "#1a1530",
    },
  },
  {
    id: "terra-orange",
    name: "Warm Orange",
    description: "Oranye hangat untuk street food",
    colors: {
      brand: "#ea580c", brand2: "#fdba74", brandSoft: "#fff7ed", brandHover: "#c2410c",
      bgLight: "#fffbf7", panelLight: "#ffffff", bgDark: "#140a04", panelDark: "#1f1308",
      borderLight: "#fed7aa", borderDark: "#3b2010", textLight: "#1c0f04", mutedLight: "#78594a",
      textDark: "#fff5eb", mutedDark: "#b08a6e", danger: "#dc2626", success: "#16a34a",
      warning: "#ca8a04", inputBgLight: "#fffcf8", inputBgDark: "#241a0c",
    },
  },
  {
    id: "terra-dark",
    name: "Midnight Dark",
    description: "Minimalis gelap untuk bar",
    colors: {
      brand: "#a78bfa", brand2: "#c4b5fd", brandSoft: "#1e1836", brandHover: "#8b5cf6",
      bgLight: "#18181b", panelLight: "#27272a", bgDark: "#09090b", panelDark: "#18181b",
      borderLight: "#3f3f46", borderDark: "#27272a", textLight: "#fafafa", mutedLight: "#a1a1aa",
      textDark: "#fafafa", mutedDark: "#71717a", danger: "#f87171", success: "#4ade80",
      warning: "#fbbf24", inputBgLight: "#3f3f46", inputBgDark: "#27272a",
    },
  },
  {
    id: "terra-teal",
    name: "Tropical Teal",
    description: "Teal tropical untuk beach cafe",
    colors: {
      brand: "#0d9488", brand2: "#5eead4", brandSoft: "#f0fdfa", brandHover: "#0f766e",
      bgLight: "#f7fdfb", panelLight: "#ffffff", bgDark: "#041412", panelDark: "#0c1f1c",
      borderLight: "#ccfbf1", borderDark: "#1a3a35", textLight: "#042f2e", mutedLight: "#4a7c76",
      textDark: "#f0fdfa", mutedDark: "#7dc4bc", danger: "#ef4444", success: "#10b981",
      warning: "#f59e0b", inputBgLight: "#f7fdfb", inputBgDark: "#112824",
    },
  },
];

// ===== Color field groups for display =====
const COLOR_GROUPS = [
  {
    title: "Brand",
    keys: ["brand", "brand2", "brandSoft", "brandHover"] as (keyof BrandColorConfig)[],
  },
  {
    title: "Semantic",
    keys: ["danger", "success", "warning"] as (keyof BrandColorConfig)[],
  },
  {
    title: "Light Mode",
    keys: ["bgLight", "panelLight", "borderLight", "textLight", "mutedLight", "inputBgLight"] as (keyof BrandColorConfig)[],
  },
  {
    title: "Dark Mode",
    keys: ["bgDark", "panelDark", "borderDark", "textDark", "mutedDark", "inputBgDark"] as (keyof BrandColorConfig)[],
  },
];

export default function BrandPage() {
  const [colors, setColors] = useState<BrandColorConfig>({ ...DEFAULT_BRAND_COLORS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "brandColors"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        const merged = { ...DEFAULT_BRAND_COLORS };
        for (const key of Object.keys(DEFAULT_BRAND_COLORS)) {
          if (data[key]) (merged as any)[key] = data[key];
        }
        setColors(merged);
      } else {
        setColors({ ...DEFAULT_BRAND_COLORS });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleChange = (key: keyof BrandColorConfig, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setActivePreset(null);
  };

  const applyPreset = (preset: ColorPreset) => {
    setColors({ ...preset.colors });
    setActivePreset(preset.id);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "system", "brandColors"), {
        ...colors,
        updatedAt: serverTimestamp(),
        updatedBy: "dev-panel",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Failed to save:", e);
      alert("Failed to save. Check console.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset semua warna ke default TerraPOS (Coffee/Brown)?")) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "system", "brandColors"), {
        ...DEFAULT_BRAND_COLORS,
        updatedAt: serverTimestamp(),
        updatedBy: "dev-panel",
      });
      setColors({ ...DEFAULT_BRAND_COLORS });
      setActivePreset("terra-brown");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Failed to reset:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Brand Colors</h1>
        <p className="page-sub">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Brand Colors</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Ubah warna seluruh app TerraPOS. Sync realtime ke semua client.
          </p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={handleReset} disabled={saving}>
          Reset Default
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Colors"}
        </button>
      </div>

      {/* ===== PRESETS ===== */}
      <div className="card">
        <div className="card-title">Color Templates</div>
        <div className="card-sub">Pilih template warna lalu klik Save untuk apply ke semua client.</div>

        <div className="preset-grid">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`preset-card ${activePreset === preset.id ? "active" : ""}`}
              onClick={() => applyPreset(preset)}
            >
              <div className="preset-colors">
                <div className="preset-dot" style={{ background: preset.colors.brand }} />
                <div className="preset-dot" style={{ background: preset.colors.brand2 }} />
                <div className="preset-dot" style={{ background: preset.colors.brandHover }} />
                <div className="preset-dot" style={{ background: preset.colors.bgDark }} />
                <div className="preset-dot" style={{ background: preset.colors.textDark }} />
              </div>
              <div className="preset-name">{preset.name}</div>
              <div className="preset-desc">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ===== COLOR EDITOR ===== */}
      {COLOR_GROUPS.map((group) => (
        <div className="card" key={group.title}>
          <div className="card-title">{group.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginTop: 12 }}>
            {group.keys.map((key) => (
              <div className="color-field" key={key}>
                <div className="color-swatch" style={{ background: colors[key] }}>
                  <input
                    type="color"
                    value={colors[key] || "#000000"}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    {key}
                  </div>
                  <input
                    className="input"
                    value={colors[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    style={{ padding: "6px 10px", fontSize: 12, fontFamily: "var(--font-mono)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ===== PREVIEW ===== */}
      <div className="card">
        <div className="card-title">Preview</div>
        <div className="card-sub">Quick preview of current color set.</div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: colors.brand, color: "#fff", fontWeight: 600, fontSize: 13 }}>
            Brand
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: colors.brand2, color: "#fff", fontWeight: 600, fontSize: 13 }}>
            Brand2
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: colors.success, color: "#fff", fontWeight: 600, fontSize: 13 }}>
            Success
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: colors.warning, color: "#000", fontWeight: 600, fontSize: 13 }}>
            Warning
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: colors.danger, color: "#fff", fontWeight: 600, fontSize: 13 }}>
            Danger
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: colors.panelLight, color: colors.textLight, border: `1px solid ${colors.borderLight}`, fontWeight: 600, fontSize: 13 }}>
            Light Panel
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: colors.panelDark, color: colors.textDark, border: `1px solid ${colors.borderDark}`, fontWeight: 600, fontSize: 13 }}>
            Dark Panel
          </div>
        </div>
      </div>
    </div>
  );
}
