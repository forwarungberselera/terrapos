"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";
import { checkIsDeveloper } from "@/lib/developer";

export default function WaitingPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        r.push("/login");
        return;
      }

      setEmail(user.email || "");

      // Developer langsung ke /dev
      const isDev = await checkIsDeveloper(user.uid, user.email || "");
      if (isDev) {
        r.push("/dev");
        return;
      }

      // Cek apakah user sudah punya tenant membership
      try {
        const membershipsSnap = await getDocs(
          collection(db, `users/${user.uid}/tenantMemberships`)
        );
        if (!membershipsSnap.empty) {
          // Sudah punya tenant, redirect ke setup untuk pilih tenant
          r.push("/setup");
          return;
        }
      } catch {
        // Ignore error, tetap di waiting
      }

      setChecking(false);
    });

    return () => unsub();
  }, [r]);

  // Realtime listener: auto-redirect kalau developer assign tenant
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Listen ke user doc untuk perubahan (misalnya level di-update)
    const unsubUser = onSnapshot(doc(db, `users/${currentUser.uid}`), () => {});

    // Listen ke tenantMemberships - kalau ada doc baru, redirect
    const unsubMemberships = onSnapshot(
      collection(db, `users/${currentUser.uid}/tenantMemberships`),
      (snap) => {
        if (!snap.empty) {
          r.push("/setup");
        }
      }
    );

    return () => {
      unsubUser();
      unsubMemberships();
    };
  }, [r, checking]);

  if (checking) {
    return (
      <TerraPage>
        <div style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
          <div className="card" style={{ textAlign: "center" }}>Loading...</div>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={540}>
      <style>{`
        .wait-wrap{
          min-height:85vh;
          min-height:85dvh;
          display:grid;
          place-items:center;
          padding:16px 0;
        }
        .wait-card{
          width:100%;
          background:var(--panel);
          border:1px solid var(--border);
          border-radius: var(--radius-lg);
          padding:32px 24px;
          box-shadow: var(--shadow-lg);
          text-align:center;
        }
        .wait-icon{
          width:72px;
          height:72px;
          margin:0 auto 20px;
          border-radius:50%;
          background:var(--bg);
          display:grid;
          place-items:center;
          font-size:32px;
        }
        .wait-title{
          font-size:22px;
          font-weight:900;
          color:var(--text);
          margin-bottom:12px;
        }
        .wait-desc{
          font-size:14px;
          line-height:1.7;
          color:var(--muted);
          max-width:380px;
          margin:0 auto;
        }
        .wait-email{
          margin-top:16px;
          padding:12px 16px;
          background:var(--bg);
          border-radius:var(--radius);
          font-size:13px;
          color:var(--text);
          font-weight:600;
        }
        .wait-hint{
          margin-top:20px;
          padding:14px;
          background:var(--bg);
          border-radius:var(--radius);
          font-size:12px;
          color:var(--muted);
          line-height:1.6;
        }
      `}</style>

      <div className="wait-wrap">
        <div className="wait-card">
          <div className="wait-icon">
            <span role="img" aria-label="clock">&#9203;</span>
          </div>

          <div className="wait-title">Menunggu Akses</div>

          <div className="wait-desc">
            Akun kamu sudah terdaftar, tetapi belum memiliki akses ke outlet manapun.
            Hubungi admin atau developer untuk mendapatkan akses.
          </div>

          <div className="wait-email">
            Login sebagai: <b>{email}</b>
          </div>

          <div className="wait-hint">
            Halaman ini akan otomatis berpindah ketika admin sudah mengatur akses outlet untuk akun kamu.
          </div>

          <button
            className="btn btn-danger"
            style={{ marginTop: 20, width: "100%" }}
            onClick={() => signOut(auth).then(() => r.push("/login"))}
          >
            Logout
          </button>
        </div>
      </div>
    </TerraPage>
  );
}
