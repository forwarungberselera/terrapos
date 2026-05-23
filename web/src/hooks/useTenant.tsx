"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, authReadyPromise } from "@/lib/firebase";
import {
  getActiveTenantId,
  getStoredTenantId,
  setActiveTenantId,
} from "@/lib/tenant";

export function useTenant() {
  const r = useRouter();

  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Tunggu auth state settle dulu (termasuk autoReLogin di Android)
      await authReadyPromise;

      if (!mounted) return;

      // Sekarang listen auth state - sudah stable
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (!mounted) return;

        if (!u) {
          setLoading(false);
          r.push("/login");
          return;
        }

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

      return () => unsub();
    })();

    return () => { mounted = false; };
  }, [r]);

  return { tenantId, loading, email };
}
