"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export function useRole() {
  const [role, setRole] = useState<string>("");
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setRole("");
          setLoadingRole(false);
          return;
        }

        const tenantId =
          typeof window !== "undefined"
            ? localStorage.getItem("terrapos_tenant_id") || ""
            : "";

        if (!tenantId) {
          setRole("");
          setLoadingRole(false);
          return;
        }

        // 1. owner tenant = owner
        const tenantSnap = await getDoc(doc(db, `tenants/${tenantId}`));
        if (tenantSnap.exists()) {
          const td = tenantSnap.data() as any;
          if ((td.ownerUid || "") === user.uid) {
            setRole("owner");
            setLoadingRole(false);
            return;
          }
        }

        // 2. cek staff admin
        const staffSnap = await getDoc(doc(db, `tenants/${tenantId}/staff/${user.uid}`));
        if (staffSnap.exists()) {
          const sd = staffSnap.data() as any;
          const r = (sd.role || "").toString().toLowerCase();

          if (r === "admin" || r === "owner") {
            setRole(r);
            setLoadingRole(false);
            return;
          }
        }

        // 3. tidak ada role = kosong
        setRole("");
        setLoadingRole(false);
      } catch {
        setRole("");
        setLoadingRole(false);
      }
    });

    return () => unsub();
  }, []);

  return { role, loadingRole };
}