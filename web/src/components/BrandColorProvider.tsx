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

  useEffect(() => {
    // 1. Instant apply dari cache (prevent FOUC)
    const cached = getCachedBrandColors();
    applyBrandColorsToCSS(cached || DEFAULT_BRAND_COLORS);

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
        // Delay sedikit supaya Firestore color update sudah ter-cache
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    });

    // 4. Watch theme changes (MutationObserver pada data-theme attribute)
    const observer = new MutationObserver(() => {
      const cached = getCachedBrandColors();
      applyBrandColorsToCSS(cached || DEFAULT_BRAND_COLORS);
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
