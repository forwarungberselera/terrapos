"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useTenant } from "./useTenant";

export function useRole() {
  const { tenantId } = useTenant();

  const [role, setRole] = useState<"owner" | "kasir">("kasir");
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const user = auth.currentUser;
        if (!user || !tenantId) return;

        const snap = await getDoc(doc(db, `tenants/${tenantId}/staff/${user.uid}`));
        if (snap.exists()) {
          const r = (snap.data() as any).role;
          if (r === "owner" || r === "kasir") setRole(r);
        }
      } finally {
        setLoadingRole(false);
      }
    }
    load();
  }, [tenantId]);

  return { role, loadingRole };
}