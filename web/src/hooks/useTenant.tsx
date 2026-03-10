"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useTenant() {
  const r = useRouter();

  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setLoading(false);
        r.push("/login");
        return;
      }

      setEmail(u.email ?? "");

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const current = (snap.exists() ? (snap.data() as any).currentTenantId : "") || "";

        if (!current) {
          setLoading(false);
          r.push("/setup");
          return;
        }

        setTenantId(current);
        setLoading(false);
      } catch {
        setLoading(false);
        r.push("/setup");
      }
    });

    return () => unsub();
  }, [r]);

  return { tenantId, loading, email };
}