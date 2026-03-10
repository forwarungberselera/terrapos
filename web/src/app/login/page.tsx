"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const r = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
          min-height:80vh;
          display:grid;
          place-items:center;
        }
        .auth-card{
          width:100%;
          background:#fff;
          border:1px solid var(--border);
          border-radius:24px;
          padding:24px;
          box-shadow:0 12px 28px rgba(17,24,39,.06);
        }
        .switch{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-top:16px;
          margin-bottom:18px;
        }
      `}</style>

      <div className="auth-wrap">
        <div className="auth-card">
          <div className="h1">TerraPOS</div>
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
            <div style={{ marginTop: 12 }}>
              <div className="small">Nama</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama kamu"
              />
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div className="small">Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@contoh.com"
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Password</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </div>

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