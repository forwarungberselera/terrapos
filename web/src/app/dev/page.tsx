"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  APP_VERSION,
  BUILD_ENV,
  getSystemInfo,
  MaintenanceStatus,
  subscribeMaintenanceStatus,
} from "@/lib/developer";
import { setStoredTenantId } from "@/lib/tenant";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

type TenantItem = {
  id: string;
  ownerUid: string;
  ownerEmail?: string;
  name?: string;
  createdAt?: any;
};

export default function DevConsolePage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole, isDeveloper } = useRole();
  const toast = useToast();

  const [maintenance, setMaintenance] = useState<MaintenanceStatus>({
    enabled: false,
    message: "",
    enabledAt: null,
    enabledBy: "",
  });
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  const [testBuildMarker, setTestBuildMarker] = useState("");
  const [savingMarker, setSavingMarker] = useState(false);

  const systemInfo = getSystemInfo();

  // Subscribe maintenance status
  useEffect(() => {
    const unsub = subscribeMaintenanceStatus((status) => {
      setMaintenance(status);
      setMaintenanceMsg(status.message);
    });
    return () => unsub();
  }, []);

  // Load all tenants (developer only)
  useEffect(() => {
    if (!isDeveloper) return;
    setLoadingTenants(true);
    (async () => {
      try {
        const snap = await getDocs(collection(db, "tenants"));
        const arr: TenantItem[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ownerUid: data.ownerUid || "",
            ownerEmail: data.ownerEmail || "",
            name: data.name || data.storeName || d.id,
            createdAt: data.createdAt,
          };
        });
        setTenants(arr);
      } catch (e: any) {
        toast.error("Gagal load tenants: " + (e?.message || ""));
      } finally {
        setLoadingTenants(false);
      }
    })();
  }, [isDeveloper]);

  // Load test build marker
  useEffect(() => {
    if (!isDeveloper) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "system/buildInfo"));
        if (snap.exists()) {
          const data = snap.data() as any;
          setTestBuildMarker(data.marker || "");
        }
      } catch {}
    })();
  }, [isDeveloper]);

  async function toggleMaintenance() {
    setSavingMaintenance(true);
    try {
      const newEnabled = !maintenance.enabled;
      await setDoc(
        doc(db, "system/maintenance"),
        {
          enabled: newEnabled,
          message: newEnabled ? (maintenanceMsg.trim() || "Sistem sedang dalam maintenance.") : "",
          enabledAt: newEnabled ? serverTimestamp() : null,
          enabledBy: newEnabled ? (email || "") : "",
          updatedAt: serverTimestamp(),
        }
      );
      toast.success(newEnabled ? "Maintenance mode AKTIF" : "Maintenance mode NONAKTIF");
    } catch (e: any) {
      toast.error("Gagal: " + (e?.message || ""));
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function saveTestBuildMarker() {
    setSavingMarker(true);
    try {
      await setDoc(
        doc(db, "system/buildInfo"),
        {
          marker: testBuildMarker.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: email || "",
        },
        { merge: true }
      );
      toast.success("Build marker tersimpan.");
    } catch (e: any) {
      toast.error("Gagal: " + (e?.message || ""));
    } finally {
      setSavingMarker(false);
    }
  }

  function switchToTenant(tid: string) {
    setStoredTenantId(tid);
    toast.success(`Switched ke tenant: ${tid}`);
    setTimeout(() => {
      window.location.href = "/pos";
    }, 500);
  }

  if (loading || loadingRole) {
    return (
      <TerraPage maxWidth={1200}>
        <SkeletonStyles />
        <PageSkeleton cards={3} />
      </TerraPage>
    );
  }

  if (!isDeveloper) {
    return (
      <TerraPage maxWidth={720}>
        <div className="card">
          <div className="h1">Akses Ditolak</div>
          <div className="small" style={{ marginTop: 8 }}>
            Halaman ini hanya untuk Developer. Akun kamu bukan developer.
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>
            Kembali ke POS
          </button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={1200}>
      <style>{`
        .dev-grid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:14px;
          margin-top:14px;
        }
        @media (max-width: 900px){
          .dev-grid{ grid-template-columns: 1fr; }
        }
        .dev-badge{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:6px 12px;
          border-radius:999px;
          background:#1e1b4b;
          color:#a5b4fc;
          font-size:11px;
          font-weight:900;
          letter-spacing:0.5px;
        }
        .status-dot{
          width:8px;
          height:8px;
          border-radius:50%;
          display:inline-block;
        }
        .status-dot.on{ background:#22c55e; }
        .status-dot.off{ background:#6b7280; }
        .tenant-row{
          padding:12px;
          border:1px solid var(--border);
          border-radius:12px;
          display:flex;
          align-items:center;
          gap:12px;
          background:#fff;
        }
        .tenant-row:hover{
          background:var(--brandSoft);
          border-color:#f5c2d4;
        }
        .info-grid{
          display:grid;
          grid-template-columns: 140px 1fr;
          gap:8px;
          font-size:13px;
        }
        .info-label{
          font-weight:800;
          color:var(--muted);
        }
      `}</style>

      {/* HEADER */}
      <div className="card">
        <div className="row">
          <div>
            <div className="row" style={{ gap: 12 }}>
              <div className="h1">Developer Console</div>
              <span className="dev-badge">DEV MODE</span>
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              {email} • Tenant aktif: <b>{tenantId || "Tidak ada"}</b>
            </div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
          <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>
            Logout
          </button>
        </div>
      </div>

      <div className="dev-grid">
        {/* SYSTEM INFO */}
        <div className="card">
          <div className="h1">System Info</div>
          <div className="small" style={{ marginTop: 4 }}>Informasi build dan environment.</div>

          <div className="info-grid" style={{ marginTop: 14 }}>
            <div className="info-label">App Version</div>
            <div><b>{systemInfo.appVersion}</b></div>

            <div className="info-label">Environment</div>
            <div>
              <span className={`status-dot ${systemInfo.environment === "production" ? "on" : "off"}`} />{" "}
              {systemInfo.environment}
            </div>

            <div className="info-label">Firebase Project</div>
            <div>{systemInfo.firebaseProject}</div>

            <div className="info-label">User UID</div>
            <div style={{ fontSize: 11, wordBreak: "break-all" }}>{auth.currentUser?.uid || "-"}</div>

            <div className="info-label">Role</div>
            <div><b style={{ color: "var(--brand)" }}>{role}</b></div>

            <div className="info-label">Timestamp</div>
            <div>{new Date().toLocaleString("id-ID")}</div>
          </div>
        </div>

        {/* MAINTENANCE MODE */}
        <div className="card">
          <div className="h1">Maintenance Mode</div>
          <div className="small" style={{ marginTop: 4 }}>
            Block akses user biasa. Developer tetap bisa akses.
          </div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid var(--border)", background: maintenance.enabled ? "#fef2f2" : "#f0fdf4" }}>
            <div className="row">
              <span className={`status-dot ${maintenance.enabled ? "on" : "off"}`} style={{ background: maintenance.enabled ? "#ef4444" : "#22c55e" }} />
              <b style={{ color: maintenance.enabled ? "#dc2626" : "#16a34a" }}>
                {maintenance.enabled ? "MAINTENANCE AKTIF" : "SISTEM NORMAL"}
              </b>
            </div>
            {maintenance.enabled && maintenance.enabledBy && (
              <div className="small" style={{ marginTop: 6 }}>
                Diaktifkan oleh: {maintenance.enabledBy}
                {maintenance.enabledAt ? ` • ${maintenance.enabledAt.toLocaleString("id-ID")}` : ""}
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Pesan maintenance (tampil ke user)</div>
            <input
              className="input"
              value={maintenanceMsg}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              placeholder="Sistem sedang dalam maintenance..."
            />
          </div>

          <button
            className={`btn ${maintenance.enabled ? "btn-primary" : "btn-danger"}`}
            style={{ width: "100%", marginTop: 12 }}
            onClick={toggleMaintenance}
            disabled={savingMaintenance}
          >
            {savingMaintenance
              ? "Menyimpan..."
              : maintenance.enabled
                ? "Matikan Maintenance"
                : "Aktifkan Maintenance"
            }
          </button>
        </div>

        {/* TEST BUILD MARKER */}
        <div className="card">
          <div className="h1">Test Build Marker</div>
          <div className="small" style={{ marginTop: 4 }}>
            Tandai build tertentu untuk tracking versi di production/staging.
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="small">Build Marker</div>
            <input
              className="input"
              value={testBuildMarker}
              onChange={(e) => setTestBuildMarker(e.target.value)}
              placeholder="Contoh: v1.2.0-beta, hotfix-printer, test-20240519"
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={saveTestBuildMarker}
            disabled={savingMarker}
          >
            {savingMarker ? "Menyimpan..." : "Simpan Marker"}
          </button>

          {testBuildMarker && (
            <div className="small" style={{ marginTop: 8 }}>
              Marker aktif: <b>{testBuildMarker}</b>
            </div>
          )}
        </div>

        {/* QUICK ACTIONS */}
        <div className="card">
          <div className="h1">Quick Actions</div>
          <div className="small" style={{ marginTop: 4 }}>Shortcut developer.</div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <button className="btn" onClick={() => r.push("/pos")}>
              Buka POS (Tenant: {tenantId || "-"})
            </button>
            <button className="btn" onClick={() => r.push("/dashboard")}>
              Buka Dashboard
            </button>
            <button className="btn" onClick={() => r.push("/orders")}>
              Buka Orders
            </button>
            <button className="btn" onClick={() => r.push("/products")}>
              Buka Products
            </button>
            <button className="btn" onClick={() => r.push("/setup")}>
              Ganti Tenant
            </button>
            <button className="btn" onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}>
              Force Reload App
            </button>
            <button className="btn" onClick={() => {
              if (typeof window !== "undefined") {
                caches.keys().then((names) => {
                  names.forEach((name) => caches.delete(name));
                });
                toast.success("Cache cleared! Reload manual untuk efek penuh.");
              }
            }}>
              Clear All Caches
            </button>
          </div>
        </div>
      </div>

      {/* TENANT BROWSER */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div>
            <div className="h1">Tenant Browser</div>
            <div className="small">Semua tenant terdaftar. Klik untuk switch.</div>
          </div>
          <div className="spacer" />
          <div className="small">{tenants.length} tenant</div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10, maxHeight: 400, overflowY: "auto" }}>
          {loadingTenants ? (
            <div className="small">Memuat tenants...</div>
          ) : tenants.length === 0 ? (
            <div className="small">Tidak ada tenant.</div>
          ) : (
            tenants.map((t) => (
              <div key={t.id} className="tenant-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900 }}>{t.name || t.id}</div>
                  <div className="small">
                    ID: {t.id} • Owner: {t.ownerEmail || t.ownerUid || "-"}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => switchToTenant(t.id)}
                  style={{ fontSize: 12 }}
                >
                  Switch
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </TerraPage>
  );
}
