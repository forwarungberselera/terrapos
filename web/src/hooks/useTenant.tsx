"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getActiveTenantId,
  getStoredTenantId,
  setActiveTenantId,
} from "@/lib/tenant";
import { hasSavedCredentials } from "@/lib/auth-guard";

export function useTenant() {
  const r = useRouter();

  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let redirectTimeout: NodeJS.Timeout | null = null;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        // Jangan langsung redirect - tunggu autoReLogin jika ada credentials
        if (hasSavedCredentials()) {
          // Tunggu 3 detik untuk autoReLogin di firebase.ts
          if (!redirectTimeout) {
            redirectTimeout = setTimeout(() => {
              if (!auth.currentUser) {
                setLoading(false);
                r.push("/login");
              }
            }, 3000);
          }
          return;
        }
        setLoading(false);
        r.push("/login");
        return;
      }

      // User berhasil login / restore - cancel pending redirect
      if (redirectTimeout) { clearTimeout(redirectTimeout); redirectTimeout = null; }

      setEmail(u.email ?? "");

      try {
        let current = (await getActiveTenantId(u.uid)) || "";

        if (!current) {
          const storedTenantId = getStoredTenantId();
          if (storedTenantId) {
            await setActiveTenantId(u.uid, storedTenantId);
            current = storedTenantId;
          }
        }

        if (!current) {
          setLoading(false);
          r.push("/setup");
          return;
        }

        setTenantId(current);
        setLoading(false);
      } catch (e: any) {
        // Network error: try localStorage fallback instead of redirecting
        const storedTenantId = getStoredTenantId();
        if (storedTenantId) {
          setTenantId(storedTenantId);
          setLoading(false);
        } else {
          setLoading(false);
          r.push("/setup");
        }
      }
    });

    return () => {
      unsub();
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, [r]);

  return { tenantId, loading, email };
}
