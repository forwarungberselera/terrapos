"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, db, authReadyPromise } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { checkIsDeveloper, MaintenanceStatus, subscribeMaintenanceStatus } from "@/lib/developer";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

export default function DevMaintenancePage() {
  const r = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [email, setEmail] = useState("");
  const [maintenance, setMaintenance] = useState<MaintenanceStatus>({ enabled: false, message: "", enabledAt: null, enabledBy: "" });
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { await authReadyPromise; if (!auth.currentUser) { r.push("/login"); return; } return; }
      setEmail(user.email || "");
      const dev = await checkIsDeveloper(user.uid, user.email || "");
      if (!dev) { r.push("/dev"); return; }
      setIsDev(true);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  useEffect(() => {
    if (!isDev) return;
    let unsub: (() => void) | null = null;
    const timer = setTimeout(() => {
      unsub = subscribeMaintenanceStatus((status) => { setMaintenance(status); setMaintenanceMsg(status.message); });
    }, 300);
    return () => {
      clearTimeout(timer);
      if (unsub) unsub();
    };
  }, [isDev]);

  async function toggleMaintenance() {
    setSaving(true);
    try {
      const newEnabled = !maintenance.enabled;
      await setDoc(doc(db, "system/maintenance"), {
        enabled: newEnabled,
        message: newEnabled ? (maintenanceMsg.trim() || "Sistem sedang dalam maintenance.") : "",
        enabledAt: newEnabled ? serverTimestamp() : null,
        enabledBy: newEnabled ? email : "",
        updatedAt: serverTimestamp(),
      });
      toast.success(newEnabled ? "Maintenance mode AKTIF" : "Maintenance mode NONAKTIF");
    } catch (e: any) { toast.error("Gagal: " + (e?.message || "")); }
    finally { setSaving(false); }
  }

  if (loading) return <TerraPage maxWidth={600}><SkeletonStyles /><PageSkeleton cards={1} /></TerraPage>;

  return (
    <TerraPage maxWidth={600}>
      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Maintenance Mode</div>
            <div className="small">Block akses user biasa. Developer tetap bisa akses.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dev")}>← Dev Console</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--border)", background: maintenance.enabled ? "#fef2f2" : "#f0fdf4" }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: maintenance.enabled ? "#ef4444" : "#22c55e" }} />
            <b style={{ color: maintenance.enabled ? "var(--danger)" : "var(--success)", fontSize: 15 }}>
              {maintenance.enabled ? "MAINTENANCE AKTIF" : "SISTEM NORMAL"}
            </b>
          </div>
          {maintenance.enabled && maintenance.enabledBy && (
            <div className="small" style={{ marginTop: 8 }}>Diaktifkan oleh: <b>{maintenance.enabledBy}</b></div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Pesan maintenance (tampil ke user)</div>
          <textarea className="input" value={maintenanceMsg} onChange={(e) => setMaintenanceMsg(e.target.value)} placeholder="Sistem sedang dalam maintenance..." rows={3} style={{ resize: "vertical" }} />
        </div>

        <button className={`btn ${maintenance.enabled ? "btn-primary" : "btn-danger"}`} style={{ width: "100%", marginTop: 16, padding: "14px" }} onClick={toggleMaintenance} disabled={saving}>
          {saving ? "Menyimpan..." : maintenance.enabled ? "Matikan Maintenance" : "Aktifkan Maintenance"}
        </button>
      </div>
    </TerraPage>
  );
}
