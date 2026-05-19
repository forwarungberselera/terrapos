"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";
import {
  isRememberMeEnabled,
  saveCredentials,
  clearCredentials,
  loadCredentials,
} from "@/lib/saved-credentials";

export default function LoginPage() {
  const r = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Auto-fill dari credentials tersimpan
  useEffect(() => {
    const saved = loadCredentials();
    if (saved) {
      setEmail(saved.email);
      setPassword(saved.password);
      setRememberMe(true);
    } else {
      setRememberMe(isRememberMeEnabled());
    }
  }, []);

  function mapFirebaseError(message: string) {
    const m = (message || "").toLowerCase();

    if (m.includes("auth/email-already-in-use")) return "Email sudah terdaftar.";
    if (m.includes("auth/invalid-email")) return "Format email tidak valid.";
    if (m.includes("auth/weak-password")) return "Password minimal 6 karakter.";
    if (m.includes("auth/invalid-credential")) return "Email atau password salah.";
    if (m.includes("auth/user-not-found")) return "Akun tidak ditemukan.";
    if (m.includes("auth/wrong-password")) return "Password salah.";

    return message || "Terjadi kesalahan.";
  }

  async function handleLogin() {
    setLoading(true);
    setErr("");

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Email dan password wajib diisi.");
      }

      await signInWithEmailAndPassword(auth, email.trim(), password);

      // Simpan atau hapus credentials berdasarkan checkbox "Ingat Saya"
      if (rememberMe) {
        saveCredentials(email.trim(), password);
      } else {
        clearCredentials();
      }

      r.push("/setup");
    } catch (e: any) {
      setErr(mapFirebaseError(e?.message || "Gagal login"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setLoading(true);
    setErr("");

    try {
      if (!name.trim()) {
        throw new Error("Nama wajib diisi.");
      }
      if (!email.trim()) {
        throw new Error("Email wajib diisi.");
      }
      if (!password.trim()) {
        throw new Error("Password wajib diisi.");
      }
      if (password.trim().length < 6) {
        throw new Error("Password minimal 6 karakter.");
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = cred.user;

      // simpan display name di auth
      await updateProfile(user, {
        displayName: name.trim(),
      });

      // simpan user profile dasar
      await setDoc(
        doc(db, `users/${user.uid}`),
        {
          uid: user.uid,
          name: name.trim(),
          email: user.email || email.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      r.push("/setup");
    } catch (e: any) {
      setErr(mapFirebaseError(e?.message || "Gagal daftar akun"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <TerraPage maxWidth={540}>
      <style>{`
        .auth-wrap{
          min-height:85vh;
          min-height:85dvh;
          display:grid;
          place-items:center;
          padding:16px 0;
        }
        .auth-card{
          width:100%;
          background:var(--panel);
          border:1px solid var(--border);
          border-radius: var(--radius-lg);
          padding:28px 24px;
          box-shadow: var(--shadow-lg);
          transition: background 0.25s ease, border-color 0.25s ease;
        }
        @media (max-width: 540px){
          .auth-card{
            padding:24px 18px;
            border-radius: var(--radius);
          }
        }
        .switch{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:8px;
          margin-top:18px;
          margin-bottom:20px;
        }
        .switch .btn{
          padding:12px;
          font-size:14px;
        }
        .auth-logo{
          font-size:28px;
          font-weight:900;
          font-family:var(--font-primary);
          line-height:1;
          margin-bottom:6px;
          color:var(--text);
        }
        .auth-field{
          margin-top:14px;
        }
        .auth-field .small{
          margin-bottom:6px;
          font-weight:600;
        }
      `}</style>

      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">terra <span style={{ color: "var(--brand)" }}>POS</span></div>
          <div className="small" style={{ marginTop: 6 }}>
            Login atau daftar akun baru untuk mulai memakai TerraPOS.
          </div>

          <div className="switch">
            <button
              className={"btn " + (mode === "login" ? "btn-primary" : "")}
              onClick={() => {
                setMode("login");
                setErr("");
              }}
            >
              Login
            </button>

            <button
              className={"btn " + (mode === "register" ? "btn-primary" : "")}
              onClick={() => {
                setMode("register");
                setErr("");
              }}
            >
              Daftar
            </button>
          </div>

          {mode === "register" && (
            <div className="auth-field">
              <div className="small">Nama</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama kamu"
              />
            </div>
          )}

          <div className="auth-field">
            <div className="small">Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@contoh.com"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <div className="small">Password</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "login" && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  setRememberMe(e.target.checked);
                  if (!e.target.checked) clearCredentials();
                }}
                style={{ width: 18, height: 18, accentColor: "var(--brand)", cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Ingat Saya</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>(simpan email & password)</span>
            </label>
          )}

          {err && (
            <div style={{ marginTop: 12, color: "var(--danger)", fontWeight: 800 }}>
              {err}
            </div>
          )}

          {mode === "login" ? (
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 16 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Masuk..." : "Login"}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 16 }}
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? "Mendaftar..." : "Daftar Akun"}
            </button>
          )}
        </div>
      </div>
    </TerraPage>
  );
}