"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isDeveloperEmail } from "@/lib/developer";

type AuthState = "loading" | "unauthenticated" | "unauthorized" | "authorized";

export function useDevAuth() {
  const [state, setState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setState("unauthenticated");
        setUser(null);
      } else if (!isDeveloperEmail(u.email)) {
        setState("unauthorized");
        setUser(u);
      } else {
        setState("authorized");
        setUser(u);
      }
    });
    return () => unsub();
  }, []);

  return { state, user, email: user?.email || "" };
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state, email } = useDevAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin() {
    setLoginErr("");
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPass);
    } catch (e: any) {
      setLoginErr(e?.message || "Login gagal");
    } finally {
      setLoggingIn(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="guard-container">
        <div className="guard-card">
          <div className="guard-title">Loading...</div>
        </div>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return (
      <div className="guard-container">
        <div className="guard-card">
          <div className="guard-title">TerraPOS Developer Panel</div>
          <p className="guard-sub">Login dengan akun developer.</p>
          <input
            className="guard-input"
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
          <input
            className="guard-input"
            type="password"
            placeholder="Password"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {loginErr && <p className="guard-err">{loginErr}</p>}
          <button className="guard-btn" onClick={handleLogin} disabled={loggingIn}>
            {loggingIn ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    );
  }

  if (state === "unauthorized") {
    return (
      <div className="guard-container">
        <div className="guard-card">
          <div className="guard-title">Akses Ditolak</div>
          <p className="guard-sub">
            Akun <b>{email}</b> bukan developer. Panel ini hanya untuk developer yang terdaftar.
          </p>
          <button className="guard-btn" onClick={() => signOut(auth)}>
            Logout & Coba Akun Lain
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
