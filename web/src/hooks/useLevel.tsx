"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserLevel = "free" | "seed" | "core" | "orbit";

const LEVEL_FEATURES: Record<UserLevel, string[]> = {
  free: ["pos", "orders", "shifts", "products", "reports", "settings/receipt", "printer", "refund-pin"],
  seed: ["pos", "orders", "shifts", "products", "reports", "settings/receipt", "printer", "refund-pin"],
  core: ["pos", "orders", "shifts", "products", "reports", "settings/receipt", "printer", "refund-pin", "qr", "staff", "promos", "audit"],
  orbit: ["pos", "orders", "shifts", "products", "reports", "settings/receipt", "printer", "refund-pin", "qr", "staff", "promos", "audit", "members"],
};

export function useLevel() {
  const [level, setLevel] = useState<UserLevel>("free");
  const [loadingLevel, setLoadingLevel] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLevel("free"); setLoadingLevel(false); return; }
      try {
        const snap = await getDoc(doc(db, `users/${u.uid}`));
        if (snap.exists()) {
          const data = snap.data() as any;
          const lvl = (data.level || "free").toString().toLowerCase();
          if (["free", "seed", "core", "orbit"].includes(lvl)) {
            setLevel(lvl as UserLevel);
          } else {
            // Map old levels to new
            if (lvl === "basic") setLevel("seed");
            else if (lvl === "premium") setLevel("core");
            else if (lvl === "owner") setLevel("orbit");
            else setLevel("free");
          }
        }
      } catch {}
      setLoadingLevel(false);
    });
    return () => unsub();
  }, []);

  function canAccess(feature: string): boolean {
    return LEVEL_FEATURES[level].includes(feature);
  }

  function canDisableWatermark(): boolean {
    return level !== "free";
  }

  return { level, loadingLevel, canAccess, canDisableWatermark };
}
