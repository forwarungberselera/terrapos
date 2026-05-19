/**
 * TerraPOS Brand Colors - Developer Customization
 *
 * Warna bisa diubah oleh developer dari /dev console.
 * Disimpan di Firestore: system/brandColors
 * Cache di localStorage untuk instant load (no FOUC).
 * Semua client auto-sync via onSnapshot.
 */

import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// ============ TYPES ============

export type BrandColorConfig = {
  // Primary brand
  brand: string;
  brand2: string;
  brandSoft: string;
  brandHover: string;

  // Backgrounds
  bgLight: string;
  panelLight: string;
  bgDark: string;
  panelDark: string;

  // Borders
  borderLight: string;
  borderDark: string;

  // Text
  textLight: string;
  mutedLight: string;
  textDark: string;
  mutedDark: string;

  // Semantic
  danger: string;
  success: string;
  warning: string;

  // Input
  inputBgLight: string;
  inputBgDark: string;

  // Metadata
  updatedAt?: any;
  updatedBy?: string;
};

// ============ DEFAULTS ============

export const DEFAULT_BRAND_COLORS: BrandColorConfig = {
  // Primary brand (pink TerraPOS)
  brand: "#e6739d",
  brand2: "#f0a0be",
  brandSoft: "#fdf0f4",
  brandHover: "#d4607e",

  // Light mode backgrounds
  bgLight: "#f8f9fb",
  panelLight: "#ffffff",

  // Dark mode backgrounds
  bgDark: "#0c0e14",
  panelDark: "#161920",

  // Light borders
  borderLight: "#e5e7eb",

  // Dark borders
  borderDark: "#252836",

  // Light text
  textLight: "#111827",
  mutedLight: "#6b7280",

  // Dark text
  textDark: "#f1f3f5",
  mutedDark: "#8b92a5",

  // Semantic colors
  danger: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",

  // Input backgrounds
  inputBgLight: "#f9fafb",
  inputBgDark: "#1c1f2a",
};

// ============ LOCAL STORAGE ============

const STORAGE_KEY = "terrapos_brand_colors";

export function getCachedBrandColors(): BrandColorConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BrandColorConfig;
  } catch {
    return null;
  }
}

export function setCachedBrandColors(colors: BrandColorConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {}
}

export function clearCachedBrandColors() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// ============ FIRESTORE ============

const FIRESTORE_DOC = "system/brandColors";

/**
 * Subscribe ke brand colors (realtime)
 */
export function subscribeBrandColors(
  callback: (colors: BrandColorConfig) => void
): () => void {
  return onSnapshot(
    doc(db, FIRESTORE_DOC),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_BRAND_COLORS);
        return;
      }
      const data = snap.data() as any;
      const merged: BrandColorConfig = { ...DEFAULT_BRAND_COLORS };

      // Override hanya field yang ada di Firestore
      for (const key of Object.keys(DEFAULT_BRAND_COLORS) as (keyof BrandColorConfig)[]) {
        if (data[key] && typeof data[key] === "string") {
          (merged as any)[key] = data[key];
        }
      }

      setCachedBrandColors(merged);
      callback(merged);
    },
    () => {
      // Fallback ke cache atau default
      const cached = getCachedBrandColors();
      callback(cached || DEFAULT_BRAND_COLORS);
    }
  );
}

/**
 * Get brand colors sekali (non-realtime)
 */
export async function getBrandColors(): Promise<BrandColorConfig> {
  try {
    const snap = await getDoc(doc(db, FIRESTORE_DOC));
    if (!snap.exists()) return DEFAULT_BRAND_COLORS;

    const data = snap.data() as any;
    const merged: BrandColorConfig = { ...DEFAULT_BRAND_COLORS };
    for (const key of Object.keys(DEFAULT_BRAND_COLORS) as (keyof BrandColorConfig)[]) {
      if (data[key] && typeof data[key] === "string") {
        (merged as any)[key] = data[key];
      }
    }
    return merged;
  } catch {
    return getCachedBrandColors() || DEFAULT_BRAND_COLORS;
  }
}

/**
 * Save brand colors ke Firestore (developer only)
 */
export async function saveBrandColors(colors: Partial<BrandColorConfig>, email: string): Promise<void> {
  const payload: any = {};

  for (const [key, value] of Object.entries(colors)) {
    if (value && typeof value === "string" && value.startsWith("#")) {
      payload[key] = value;
    }
  }

  payload.updatedAt = serverTimestamp();
  payload.updatedBy = email;

  await setDoc(doc(db, FIRESTORE_DOC), payload, { merge: true });
}

/**
 * Reset brand colors ke default
 */
export async function resetBrandColors(email: string): Promise<void> {
  const payload: any = { ...DEFAULT_BRAND_COLORS };
  payload.updatedAt = serverTimestamp();
  payload.updatedBy = email;

  await setDoc(doc(db, FIRESTORE_DOC), payload);
  clearCachedBrandColors();
}

// ============ CSS VARIABLE MAPPING ============

/**
 * Apply brand colors ke CSS variables (document root)
 */
export function applyBrandColorsToCSS(colors: BrandColorConfig) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Brand colors (both modes)
  root.style.setProperty("--brand", colors.brand);
  root.style.setProperty("--brand2", colors.brand2);
  root.style.setProperty("--brandSoft", colors.brandSoft);
  root.style.setProperty("--brandHover", colors.brandHover);

  // Semantic
  root.style.setProperty("--danger", colors.danger);
  root.style.setProperty("--success", colors.success);
  root.style.setProperty("--warning", colors.warning);

  // Mode-specific: check current theme
  const isDark = root.getAttribute("data-theme") === "dark";

  if (isDark) {
    root.style.setProperty("--bg", colors.bgDark);
    root.style.setProperty("--panel", colors.panelDark);
    root.style.setProperty("--border", colors.borderDark);
    root.style.setProperty("--text", colors.textDark);
    root.style.setProperty("--muted", colors.mutedDark);
    root.style.setProperty("--input-bg", colors.inputBgDark);
  } else {
    root.style.setProperty("--bg", colors.bgLight);
    root.style.setProperty("--panel", colors.panelLight);
    root.style.setProperty("--border", colors.borderLight);
    root.style.setProperty("--text", colors.textLight);
    root.style.setProperty("--muted", colors.mutedLight);
    root.style.setProperty("--input-bg", colors.inputBgLight);
  }
}

// ============ FORCE RELOAD ============

const RELOAD_DOC = "system/forceReload";

/**
 * Trigger force reload untuk semua client
 */
export async function triggerForceReload(email: string): Promise<void> {
  await setDoc(doc(db, RELOAD_DOC), {
    triggeredAt: serverTimestamp(),
    triggeredBy: email,
    timestamp: Date.now(),
  });
}

/**
 * Subscribe ke force reload signal
 */
export function subscribeForceReload(callback: (timestamp: number) => void): () => void {
  return onSnapshot(
    doc(db, RELOAD_DOC),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      if (data.timestamp) {
        callback(Number(data.timestamp));
      }
    },
    () => {} // ignore errors
  );
}
