"use client";

import { useEffect, useRef } from "react";
import {
  applyBrandColorsToCSS,
  getCachedBrandColors,
  DEFAULT_BRAND_COLORS,
  subscribeBrandColors,
  subscribeForceReload,
} from "@/lib/brand-colors";

/**
 * BrandColorProvider
 *
 * - Saat mount: langsung apply cached colors (instant, no flash)
 * - Subscribe ke Firestore system/brandColors (realtime sync)
 * - Subscribe ke Firestore system/forceReload (auto reload semua client)
 * - Re-apply saat theme berubah (dark/light toggle)
 */
export default function BrandColorProvider() {
  const lastReloadTimestamp = useRef<number>(0);
  const initializedRef = useRef(false);
  const mountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    mountTimeRef.current = Date.now();

    // 1. Instant apply dari cache ATAU default (prevent FOUC / blank page)
    try {
      const cached = getCachedBrandColors();
      applyBrandColorsToCSS(cached || DEFAULT_BRAND_COLORS);
    } catch {
      // Fallback: apply defaults jika localStorage error
      applyBrandColorsToCSS(DEFAULT_BRAND_COLORS);
    }

    // 2. Subscribe ke Firestore untuk realtime color updates
    const unsubColors = subscribeBrandColors((colors) => {
      applyBrandColorsToCSS(colors);
    });

    // 3. Subscribe ke force reload signal
    const unsubReload = subscribeForceReload((timestamp) => {
      // Skip initial load (hanya react ke perubahan baru)
      if (!initializedRef.current) {
        lastReloadTimestamp.current = timestamp;
        initializedRef.current = true;
        return;
      }

      // Jika timestamp berubah dari sebelumnya, reload
      if (timestamp > lastReloadTimestamp.current) {
        lastReloadTimestamp.current = timestamp;

        // Prevent reload loop: don't reload if page just loaded (within 5 seconds)
        const timeSinceMount = Date.now() - mountTimeRef.current;
        if (timeSinceMount < 5000) {
          return;
        }

        // Also use sessionStorage to prevent rapid reloads
        const RELOAD_KEY = "terrapos_force_reload";
        const lastForceReload = sessionStorage.getItem(RELOAD_KEY);
        const now = Date.now();
        if (lastForceReload && now - Number(lastForceReload) < 15000) {
          return; // Already reloaded within 15 seconds
        }
        sessionStorage.setItem(RELOAD_KEY, String(now));

        // Delay sedikit supaya Firestore color update sudah ter-cache
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    });

    // 4. Watch theme changes (MutationObserver pada data-theme attribute)
    const observer = new MutationObserver(() => {
      try {
        const cached = getCachedBrandColors();
        applyBrandColorsToCSS(cached || DEFAULT_BRAND_COLORS);
      } catch {
        applyBrandColorsToCSS(DEFAULT_BRAND_COLORS);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      unsubColors();
      unsubReload();
      observer.disconnect();
    };
  }, []);

  return null;
}
