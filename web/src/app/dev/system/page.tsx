"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { checkIsDeveloper, APP_VERSION, BUILD_ENV, getSystemInfo } from "@/lib/developer";
import { getStoredTenantId } from "@/lib/tenant";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

export default function DevSystemPage() {
  const r = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [testBuildMarker, setTestBuildMarker] = useState("");
  const [savingMarker, setSavingMarker] = useState(false);

  const systemInfo = getSystemInfo();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { r.push("/login"); return; }
      setEmail(user.email || "");
      setUid(user.uid);
      setTenantId(getStoredTenantId() || "");
      const dev = await checkIsDeveloper(user.uid, user.email || "");
      if (!dev) { r.push("/dev"); return; }
      setIsDev(true);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  useEffect(() => {
    if (!isDev) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "system/buildInfo"));
        if (snap.exists()) setTestBuildMarker((snap.data() as any).marker || "");
      } catch {}
    })();
  }, [isDev]);

  async function saveMarker() {
    setSavingMarker(true);
    try {
      await setDoc(doc(db, "system/buildInfo"), { marker: testBuildMarker.trim(), updatedAt: serverTimestamp(), updatedBy: email }, { merge: true });
      toast.success("Build marker tersimpan.");
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
    finally { setSavingMarker(false); }
  }

  if (loading) return <TerraPage maxWidth={700}><SkeletonStyles /><PageSkeleton cards={2} /></TerraPage>;

  return (
    <TerraPage maxWidth={700}>
      <style>{`
        .sys-grid{display:grid;grid-template-columns:160px 1fr;gap:10px;font-size:13px;margin-top:16px;}
        .sys-label{font-weight:800;color:var(--muted);}
        .sys-val{word-break:break-all;}
        .sys-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px;}
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">System Info</div>
            <div className="small">Informasi build, environment, dan diagnostics.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dev")}>← Dev Console</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>Environment</div>
        <div className="sys-grid">
          <div className="sys-label">App Version</div>
          <div className="sys-val"><b>{systemInfo.appVersion}</b></div>
          <div className="sys-label">Environment</div>
          <div className="sys-val"><span className="sys-dot" style={{ background: systemInfo.environment === "production" ? "#22c55e" : "#f59e0b" }} />{systemInfo.environment}</div>
          <div className="sys-label">Firebase Project</div>
          <div className="sys-val">{systemInfo.firebaseProject}</div>
          <div className="sys-label">User UID</div>
          <div className="sys-val" style={{ fontSize: 11 }}>{uid}</div>
          <div className="sys-label">Email</div>
          <div className="sys-val"><b>{email}</b></div>
          <div className="sys-label">Role</div>
          <div className="sys-val"><b style={{ color: "var(--brand)" }}>developer</b></div>
          <div className="sys-label">Tenant Aktif</div>
          <div className="sys-val">{tenantId || "Belum dipilih"}</div>
          <div className="sys-label">Timestamp</div>
          <div className="sys-val">{new Date().toLocaleString("id-ID")}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>Build Marker</div>
        <div className="small" style={{ marginTop: 4 }}>Tandai build tertentu untuk tracking versi di production/staging.</div>
        <div style={{ marginTop: 14 }}>
          <input className="input" value={testBuildMarker} onChange={(e) => setTestBuildMarker(e.target.value)} placeholder="Contoh: v1.2.0-beta, hotfix-printer, test-20240519" />
        </div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={saveMarker} disabled={savingMarker}>
          {savingMarker ? "Menyimpan..." : "Simpan Marker"}
        </button>
        {testBuildMarker && <div className="small" style={{ marginTop: 8 }}>Marker aktif: <b>{testBuildMarker}</b></div>}
      </div>
    </TerraPage>
  );
}
