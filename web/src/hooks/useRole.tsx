"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getStoredTenantId } from "@/lib/tenant";
import { checkIsDeveloper, setDevModeLocal } from "@/lib/developer";

export function useRole() {
  const [role, setRole] = useState<string>("");
  const [loadingRole, setLoadingRole] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setRole("");
          setIsDeveloper(false);
          setDevModeLocal(false);
          setLoadingRole(false);
          return;
        }

        // 0. Cek apakah user adalah developer (global, bukan per-tenant)
        const devStatus = await checkIsDeveloper(user.uid, user.email || "");
        setIsDeveloper(devStatus);
        setDevModeLocal(devStatus);

        // Developer otomatis dapat akses "developer" (super-role)
        // Tapi tetap cek tenant role juga untuk compatibility
        if (devStatus) {
          // Developer tetap cek tenant role untuk display,
          // tapi akan selalu punya akses penuh
          const tenantId = getStoredTenantId();
          if (tenantId) {
            const tenantSnap = await getDoc(doc(db, `tenants/${tenantId}`));
            if (tenantSnap.exists()) {
              const td = tenantSnap.data() as any;
              if ((td.ownerUid || "") === user.uid) {
                setRole("developer");
                setLoadingRole(false);
                return;
              }
            }
          }
          // Developer tanpa tenant atau bukan owner tetap role "developer"
          setRole("developer");
          setLoadingRole(false);
          return;
        }

        const tenantId = getStoredTenantId();

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

        // 2. cek staff role
        const staffSnap = await getDoc(doc(db, `tenants/${tenantId}/staff/${user.uid}`));
        if (staffSnap.exists()) {
          const sd = staffSnap.data() as any;
          const r = (sd.role || "").toString().toLowerCase();
          if (r) {
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
        setIsDeveloper(false);
        setLoadingRole(false);
      }
    });

    return () => unsub();
  }, []);

  return { role, loadingRole, isDeveloper };
}
