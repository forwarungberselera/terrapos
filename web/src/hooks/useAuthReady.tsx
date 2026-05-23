"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "firebase/auth";
import { auth, authReadyPromise } from "@/lib/firebase";

/**
 * Hook utama untuk auth guard di semua halaman.
 * 
 * WAJIB digunakan di semua page yang butuh autentikasi.
 * Menunggu authReadyPromise (max 4 detik) sebelum memutuskan user null.
 * 
 * Ini menyelesaikan masalah Android Capacitor dimana app di-kill
 * menyebabkan onAuthStateChanged fire null sebelum auth restore selesai.
 * 
 * Usage:
 *   const { user, loading } = useAuthReady();
 *   if (loading) return <Loading />;
 *   if (!user) return redirect or null;
 */
export function useAuthReady(options?: { redirectToLogin?: boolean }) {
  const r = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Tunggu auth state settle (termasuk autoReLogin)
      await authReadyPromise;

      if (!mounted) return;

      const currentUser = auth.currentUser;
      setUser(currentUser);
      setLoading(false);

      // Auto redirect ke login jika diminta dan user null
      if (!currentUser && options?.redirectToLogin !== false) {
        r.push("/login");
      }
    })();

    // Juga listen untuk perubahan state setelah ready
    const unsub = auth.onAuthStateChanged((u) => {
      if (!mounted) return;
      if (u) {
        setUser(u);
        setLoading(false);
      }
    });

    return () => { mounted = false; unsub(); };
  }, [r]);

  return { user, loading };
}
