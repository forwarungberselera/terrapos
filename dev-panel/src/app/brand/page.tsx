"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const DEFAULT_COLORS: Record<string, string> = {
  primary: "#6c9cff",
  primaryHover: "#5588ee",
  secondary: "#4a7adf",
  background: "#0a0c10",
  surface: "#12151c",
  surfaceHover: "#1a1e28",
  border: "#1e2230",
  borderHover: "#2d3348",
  text: "#e8ecf2",
  textMuted: "#7a839a",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#06b6d4",
  inputBg: "#0e1118",
  headerBg: "#12151c",
  sidebarBg: "#0d0f14",
  accentGlow: "#6c9cff33",
};

const COLOR_KEYS = Object.keys(DEFAULT_COLORS);

export default function BrandPage() {
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_COLORS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "brandColors"), (snap) => {
      if (snap.exists()) {
        setColors({ ...DEFAULT_COLORS, ...snap.data() });
      } else {
        setColors({ ...DEFAULT_COLORS });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleChange = (key: string, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "system", "brandColors"), colors);
      setSaved(true);
    } catch (e) {
      console.error("Failed to save brand colors:", e);
      alert("Failed to save. Check console.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all brand colors to defaults? This will overwrite Firestore.")) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "system", "brandColors"), DEFAULT_COLORS);
      setColors({ ...DEFAULT_COLORS });
      setSaved(true);
    } catch (e) {
      console.error("Failed to reset:", e);
      alert("Failed to reset. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Brand Color Editor</h1>
      <p className="page-sub">Edit the 18 brand color keys stored in system/brandColors.</p>

      {loading ? (
        <p className="small">Loading brand colors...</p>
      ) : (
        <>
          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="card-title">Color Configuration</div>
              <div className="spacer" />
              <button className="btn" onClick={handleReset} disabled={saving}>
                Reset Defaults
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save to Firestore"}
              </button>
            </div>
            {saved && (
              <p className="small" style={{ color: "var(--success)", marginBottom: 12 }}>
                ✓ Saved successfully!
              </p>
            )}
            <div className="card-sub">
              Click a color swatch to use the native picker, or type a hex value.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {COLOR_KEYS.map((key) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "var(--input-bg)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <input
                    type="color"
                    value={colors[key] || "#000000"}
                    onChange={(e) => handleChange(key, e.target.value)}
                    style={{
                      width: 36,
                      height: 36,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{key}</div>
                    <input
                      className="input"
                      value={colors[key] || ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      style={{ padding: "4px 8px", fontSize: 12 }}
                    />
                  </div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: colors[key],
                      border: "1px solid var(--border)",
                      flexShrink: 0,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Preview</div>
            <div className="card-sub">Quick preview of some color combinations.</div>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: colors.primary, color: "#fff", fontWeight: 700 }}>
                Primary Button
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: colors.success, color: "#fff", fontWeight: 700 }}>
                Success
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: colors.warning, color: "#fff", fontWeight: 700 }}>
                Warning
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: colors.danger, color: "#fff", fontWeight: 700 }}>
                Danger
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, fontWeight: 700 }}>
                Surface Card
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
