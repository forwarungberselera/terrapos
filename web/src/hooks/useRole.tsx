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

        // 1) cek membership user
        const membershipRef = doc(db, `users/${user.uid}/tenantMemberships/${tenantId}`);
        const membershipSnap = await getDoc(membershipRef);

        if (membershipSnap.exists()) {
          const d = membershipSnap.data() as any;
          const membershipRole = (d.role || "").toString().toLowerCase();
          if (membershipRole) {
            setRole(membershipRole);
            setLoadingRole(false);
            return;
          }
        }

        // 2) cek staff doc
        const staffRef = doc(db, `tenants/${tenantId}/staff/${user.uid}`);
        const staffSnap = await getDoc(staffRef);

        if (staffSnap.exists()) {
          const d = staffSnap.data() as any;
          const staffRole = (d.role || "").toString().toLowerCase();
          if (staffRole) {
            setRole(staffRole);
            setLoadingRole(false);
            return;
          }
        }

        // 3) fallback ownerUid tenant
        const tenantRef = doc(db, `tenants/${tenantId}`);
        const tenantSnap = await getDoc(tenantRef);

        if (tenantSnap.exists()) {
          const td = tenantSnap.data() as any;
          if ((td.ownerUid || "") === user.uid) {
            setRole("owner");
            setLoadingRole(false);
            return;
          }
        }

        // 4) terakhir baru fallback cashier
        setRole("cashier");
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