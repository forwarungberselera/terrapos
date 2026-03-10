"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import TerraPage from "@/components/TerraPage";

async function routeAfterLogin(uid: string, r: any) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const tenantId = (snap.exists() ? (snap.data() as any).currentTenantId : "") || "";
    if (!tenantId) r.push("/setup");
    else r.push("/pos");
  } catch {
    r.push("/setup");
  }
}

export default function LoginPage() {
  const r = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) routeAfterLogin(u.uid, r);
    });
    return () => unsub();
  }, [r]);

  async function doLogin() {
    setErr(null); setBusy(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), pass);
      await routeAfterLogin(res.user.uid, r);
    } catch (e: any) {
      setErr(e?.code || e?.message || "Login gagal");
    } finally {
      setBusy(false);
    }
  }

  async function doRegister() {
    setErr(null); setBusy(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      await routeAfterLogin(res.user.uid, r);
    } catch (e: any) {
      setErr(e?.code || e?.message || "Daftar gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TerraPage maxWidth={520}>
      <div className="card" style={{ marginTop: 30 }}>
        <div className="row">
          <div className="h1">TerraPOS</div>
          <div className="spacer" />
          <span className="badge">Orange Theme</span>
        </div>
        <div className="small" style={{ marginTop: 6 }}>Login / Daftar untuk lanjut.</div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className={"btn " + (mode === "login" ? "btn-primary" : "btn-ghost")} onClick={() => setMode("login")}>Login</button>
          <button className={"btn " + (mode === "register" ? "btn-primary" : "btn-ghost")} onClick={() => setMode("register")}>Daftar</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="small">Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="small">Password</div>
          <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="minimal 6 karakter" />
        </div>

        {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

        <button
          className={"btn btn-primary"}
          style={{ width: "100%", marginTop: 14 }}
          disabled={busy}
          onClick={mode === "login" ? doLogin : doRegister}
        >
          {busy ? "Proses..." : mode === "login" ? "Login" : "Daftar"}
        </button>
      </div>
    </TerraPage>
  );
}