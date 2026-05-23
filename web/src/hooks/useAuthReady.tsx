"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { hasSavedCredentials } from "@/lib/auth-guard";

/**
 * Hook yang menunggu Firebase Auth state stabil sebelum return.
 * 
 * Di Android Capacitor, saat app di-kill lalu dibuka:
 * 1. onAuthStateChanged fire `null` terlebih dahulu
 * 2. Lalu autoReLogin() di firebase.ts re-login dari saved credentials
 * 3. onAuthStateChanged fire lagi dengan user yang valid
 * 
 * Hook ini menunggu proses ini selesai (max 3 detik) sebelum return.
 * Mencegah premature redirect ke /login.
 */
export function useAuthReady() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let settled = false;
    let timeout: NodeJS.Timeout | null = null;

    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // Got user - immediately settle
        if (!settled) { settled = true; if (timeout) clearTimeout(timeout); }
        setUser(u);
        setReady(true);
      } else if (!hasSavedCredentials()) {
        // No user AND no saved credentials - genuinely not logged in
        if (!settled) { settled = true; if (timeout) clearTimeout(timeout); }
        setUser(null);
        setReady(true);
      } else {
        // No user but has saved credentials - wait for autoReLogin
        if (!settled && !timeout) {
          timeout = setTimeout(() => {
            if (!settled) {
              settled = true;
              setUser(auth.currentUser);
              setReady(true);
            }
          }, 3500);
        }
      }
    });

    return () => {
      unsub();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return { user, ready };
}
