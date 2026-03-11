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

        // 1️⃣ cek tenant
        const tenantRef = doc(db, `tenants/${tenantId}`);
        const tenantSnap = await getDoc(tenantRef);

        if (!tenantSnap.exists()) {
          setRole("cashier");
          setLoadingRole(false);
          return;
        }

        const tenant = tenantSnap.data() as any;

        // 2️⃣ jika user adalah owner tenant
        if (tenant.ownerUid === user.uid) {
          setRole("owner");
          setLoadingRole(false);
          return;
        }

        // 3️⃣ cek staff role
        const staffRef = doc(db, `tenants/${tenantId}/staff/${user.uid}`);
        const staffSnap = await getDoc(staffRef);

        if (staffSnap.exists()) {
          const staff = staffSnap.data() as any;
          setRole((staff.role || "cashier").toLowerCase());
          setLoadingRole(false);
          return;
        }

        // 4️⃣ fallback
        setRole("cashier");
        setLoadingRole(false);

      } catch (err) {
        console.error(err);
        setRole("cashier");
        setLoadingRole(false);
      }
    });

    return () => unsub();
  }, []);

  return { role, loadingRole };
}