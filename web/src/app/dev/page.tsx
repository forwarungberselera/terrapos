"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  APP_VERSION,
  BUILD_ENV,
  checkIsDeveloper,
  DEVELOPER_EMAILS,
  getSystemInfo,
  MaintenanceStatus,
  subscribeMaintenanceStatus,
} from "@/lib/developer";
import { setStoredTenantId, getStoredTenantId } from "@/lib/tenant";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  BrandColorConfig,
  DEFAULT_BRAND_COLORS,
  COLOR_PRESETS,
  saveBrandColors,
  resetBrandColors,
  subscribeBrandColors,
  triggerForceReload,
} from "@/lib/brand-colors";

type TenantItem = {
  id: string;
  ownerUid: string;
  ownerEmail?: string;
  name?: string;
  createdAt?: any;
};

export default function DevConsolePage() {
  const r = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [tenantId, setTenantId] = useState("");

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

  // Brand Colors state
  const [brandColors, setBrandColors] = useState<BrandColorConfig>(DEFAULT_BRAND_COLORS);
  const [savingColors, setSavingColors] = useState(false);
  const [reloading, setReloading] = useState(false);

  const systemInfo = getSystemInfo();

  // Auth check - TANPA redirect ke /setup
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        r.push("/login");
        return;
      }

      setEmail(user.email || "");
      setUid(user.uid);
      setTenantId(getStoredTenantId() || "");

      // Cek developer langsung dari email
      const devStatus = await checkIsDeveloper(user.uid, user.email || "");
      setIsDeveloper(devStatus);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  // Subscribe maintenance status
  useEffect(() => {
    if (!isDeveloper) return;
    const unsub = subscribeMaintenanceStatus((status) => {
      setMaintenance(status);
      setMaintenanceMsg(status.message);
    });
    return () => unsub();
  }, [isDeveloper]);

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

  // Subscribe brand colors
  useEffect(() => {
    if (!isDeveloper) return;
    const unsub = subscribeBrandColors((colors) => {
      setBrandColors(colors);
    });
    return () => unsub();
  }, [isDeveloper]);

  async function handleSaveBrandColors() {
    setSavingColors(true);
    try {
      await saveBrandColors(brandColors, email);
      toast.success("Warna brand tersimpan! Semua client akan sync otomatis.");
    } catch (e: any) {
      toast.error("Gagal simpan warna: " + (e?.message || ""));
    } finally {
      setSavingColors(false);
    }
  }

  async function handleResetBrandColors() {
    if (!confirm("Reset semua warna ke default TerraPOS?")) return;
    setSavingColors(true);
    try {
      await resetBrandColors(email);
      setBrandColors(DEFAULT_BRAND_COLORS);
      toast.success("Warna brand di-reset ke default.");
    } catch (e: any) {
      toast.error("Gagal reset: " + (e?.message || ""));
    } finally {
      setSavingColors(false);
    }
  }

  async function handleForceReloadAll() {
    if (!confirm("Reload SEMUA client yang sedang membuka TerraPOS?")) return;
    setReloading(true);
    try {
      await triggerForceReload(email);
      toast.success("Signal reload dikirim! Semua client akan reload dalam 1 detik.");
    } catch (e: any) {
      toast.error("Gagal kirim reload: " + (e?.message || ""));
    } finally {
      setReloading(false);
    }
  }

  function updateColor(key: keyof BrandColorConfig, value: string) {
    setBrandColors((prev) => ({ ...prev, [key]: value }));
  }

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

  async function switchToTenant(tid: string) {
    try {
      // Update localStorage
      setStoredTenantId(tid);
      setTenantId(tid);

      // Update Firestore juga supaya useTenant() konsisten
      if (uid) {
        const { setActiveTenantId } = await import("@/lib/tenant");
        await setActiveTenantId(uid, tid);
      }

      toast.success(`Switched ke tenant: ${tid}`);
      setTimeout(() => {
        window.location.href = "/pos";
      }, 500);
    } catch (e: any) {
      toast.error("Gagal switch: " + (e?.message || ""));
    }
  }

  if (loading) {
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
            Halaman ini hanya untuk Developer. Akun <b>{email}</b> bukan developer.
          </div>
          <div className="small" style={{ marginTop: 8, color: "var(--muted)" }}>
            Developer yang terdaftar: {DEVELOPER_EMAILS.join(", ")}
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/login")}>
            Kembali ke Login
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
              {email} • Tenant aktif: <b>{tenantId || "Belum dipilih"}</b>
            </div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dev/landing")}>Landing Page</button>
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
          <button className="btn" onClick={() => r.push("/setup")}>Setup Tenant</button>
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
            <div style={{ fontSize: 11, wordBreak: "break-all" }}>{uid || "-"}</div>

            <div className="info-label">Email</div>
            <div><b>{email}</b></div>

            <div className="info-label">Role</div>
            <div><b style={{ color: "var(--brand)" }}>developer</b></div>

            <div className="info-label">Tenant Aktif</div>
            <div>{tenantId || "Belum dipilih"}</div>

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
            <button className="btn" onClick={() => r.push("/setup")}>
              Setup / Pilih Tenant
            </button>
            <button className="btn" onClick={() => r.push("/pos")}>
              Buka POS
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
                toast.success("Cache cleared! Reload untuk efek penuh.");
              }
            }}>
              Clear All Caches
            </button>
          </div>
        </div>
      </div>

      {/* BRAND COLOR CUSTOMIZATION */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div>
            <div className="h1">Brand Color Customization</div>
            <div className="small">Ubah warna seluruh app. Perubahan langsung sync ke semua client realtime.</div>
          </div>
          <div className="spacer" />
          <button className="btn btn-danger" onClick={handleResetBrandColors} disabled={savingColors}>
            Reset Default
          </button>
        </div>

        {/* PRESET TEMPLATES */}
        <div style={{ marginTop: 14 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Template Warna (klik untuk apply)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setBrandColors(preset.colors)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--panel)",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease, transform 0.1s ease",
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = preset.colors.brand; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
              >
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: preset.colors.brand }} />
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: preset.colors.brand2 }} />
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: preset.colors.brandHover }} />
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: preset.colors.bgDark, border: "1px solid #333" }} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 12, color: "var(--text)" }}>{preset.name}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{preset.description}</div>
              </button>
            ))}
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            Pilih template lalu klik &quot;Simpan Warna&quot; untuk mengaplikasikan ke semua client.
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {/* Primary Brand */}
          <ColorField label="Brand Primary" colorKey="brand" value={brandColors.brand} onChange={updateColor} />
          <ColorField label="Brand Secondary" colorKey="brand2" value={brandColors.brand2} onChange={updateColor} />
          <ColorField label="Brand Soft" colorKey="brandSoft" value={brandColors.brandSoft} onChange={updateColor} />
          <ColorField label="Brand Hover" colorKey="brandHover" value={brandColors.brandHover} onChange={updateColor} />

          {/* Semantic */}
          <ColorField label="Danger / Error" colorKey="danger" value={brandColors.danger} onChange={updateColor} />
          <ColorField label="Success" colorKey="success" value={brandColors.success} onChange={updateColor} />
          <ColorField label="Warning" colorKey="warning" value={brandColors.warning} onChange={updateColor} />

          {/* Light Mode */}
          <ColorField label="BG (Light)" colorKey="bgLight" value={brandColors.bgLight} onChange={updateColor} />
          <ColorField label="Panel (Light)" colorKey="panelLight" value={brandColors.panelLight} onChange={updateColor} />
          <ColorField label="Border (Light)" colorKey="borderLight" value={brandColors.borderLight} onChange={updateColor} />
          <ColorField label="Text (Light)" colorKey="textLight" value={brandColors.textLight} onChange={updateColor} />
          <ColorField label="Muted (Light)" colorKey="mutedLight" value={brandColors.mutedLight} onChange={updateColor} />
          <ColorField label="Input BG (Light)" colorKey="inputBgLight" value={brandColors.inputBgLight} onChange={updateColor} />

          {/* Dark Mode */}
          <ColorField label="BG (Dark)" colorKey="bgDark" value={brandColors.bgDark} onChange={updateColor} />
          <ColorField label="Panel (Dark)" colorKey="panelDark" value={brandColors.panelDark} onChange={updateColor} />
          <ColorField label="Border (Dark)" colorKey="borderDark" value={brandColors.borderDark} onChange={updateColor} />
          <ColorField label="Text (Dark)" colorKey="textDark" value={brandColors.textDark} onChange={updateColor} />
          <ColorField label="Muted (Dark)" colorKey="mutedDark" value={brandColors.mutedDark} onChange={updateColor} />
          <ColorField label="Input BG (Dark)" colorKey="inputBgDark" value={brandColors.inputBgDark} onChange={updateColor} />
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleSaveBrandColors}
            disabled={savingColors}
          >
            {savingColors ? "Menyimpan..." : "Simpan Warna"}
          </button>
        </div>

        <div className="small" style={{ marginTop: 8 }}>
          Perubahan warna langsung sync realtime ke semua device/browser yang membuka TerraPOS tanpa reload.
        </div>
      </div>

      {/* FORCE RELOAD ALL */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Reload All Clients</div>
        <div className="small" style={{ marginTop: 4 }}>
          Paksa SEMUA client (browser/HP) yang sedang membuka TerraPOS untuk reload halaman.
          Berguna setelah deploy update besar atau ganti warna yang butuh refresh penuh.
        </div>

        <button
          className="btn btn-danger"
          style={{ width: "100%", marginTop: 14 }}
          onClick={handleForceReloadAll}
          disabled={reloading}
        >
          {reloading ? "Mengirim signal..." : "Reload Semua Client Sekarang"}
        </button>

        <div className="small" style={{ marginTop: 8 }}>
          Semua user (termasuk kasir yang sedang transaksi) akan di-reload. Gunakan dengan hati-hati.
        </div>
      </div>

      {/* TENANT BROWSER + MANAGEMENT */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div>
            <div className="h1">Tenant Management</div>
            <div className="small">Kelola semua tenant. Switch, atau hapus tenant beserta semua datanya.</div>
          </div>
          <div className="spacer" />
          <div className="small">{tenants.length} tenant</div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10, maxHeight: 500, overflowY: "auto" }}>
          {loadingTenants ? (
            <div className="small">Memuat tenants...</div>
          ) : tenants.length === 0 ? (
            <div className="small">Tidak ada tenant atau belum bisa load (cek Firestore Rules).</div>
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
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (!confirm(`HAPUS tenant "${t.name || t.id}"?\n\nSemua data (orders, products, staff, settings) di tenant ini akan DIHAPUS PERMANEN.\n\nKetik "HAPUS" di prompt berikutnya untuk konfirmasi.`)) return;
                    const confirmText = prompt("Ketik HAPUS untuk konfirmasi:");
                    if (confirmText !== "HAPUS") { toast.error("Dibatalkan."); return; }
                    try {
                      // Delete tenant document
                      const { deleteDoc, doc: docRef } = await import("firebase/firestore");
                      await deleteDoc(docRef(db, `tenants/${t.id}`));
                      toast.success(`Tenant "${t.name || t.id}" dihapus.`);
                      // Refresh list
                      setTenants((prev) => prev.filter((x) => x.id !== t.id));
                    } catch (e: any) {
                      toast.error("Gagal hapus: " + (e?.message || ""));
                    }
                  }}
                  style={{ fontSize: 12 }}
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ACCOUNT MANAGEMENT */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="h1">Account Management</div>
        <div className="small" style={{ marginTop: 4 }}>
          Buat akun baru atau hapus akun user. Akun yang dihapus dari sini hanya dihapus data Firestore-nya (users collection).
          Untuk hapus dari Firebase Auth, gunakan Firebase Console.
        </div>

        {/* CREATE ACCOUNT */}
        <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Buat Akun Baru</div>
          <div className="small" style={{ marginTop: 4 }}>Daftarkan akun baru via Firebase Auth + simpan profil di Firestore.</div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div className="small">Nama</div>
              <input className="input" id="dev-new-name" placeholder="Nama lengkap" />
            </div>
            <div>
              <div className="small">Email</div>
              <input className="input" id="dev-new-email" type="email" placeholder="email@contoh.com" />
            </div>
            <div>
              <div className="small">Password</div>
              <input className="input" id="dev-new-pass" type="password" placeholder="Min 6 karakter" />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={async () => {
                  const nameEl = document.getElementById("dev-new-name") as HTMLInputElement;
                  const emailEl = document.getElementById("dev-new-email") as HTMLInputElement;
                  const passEl = document.getElementById("dev-new-pass") as HTMLInputElement;
                  const name = (nameEl?.value || "").trim();
                  const newEmail = (emailEl?.value || "").trim();
                  const pass = (passEl?.value || "").trim();
                  if (!name || !newEmail || !pass) { toast.error("Semua field wajib diisi."); return; }
                  if (pass.length < 6) { toast.error("Password minimal 6 karakter."); return; }
                  try {
                    const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
                    const { doc: docRef, setDoc: setDocFn, serverTimestamp: ts } = await import("firebase/firestore");
                    // Use secondary auth to not log out current developer
                    const { initializeApp, getApps } = await import("firebase/app");
                    const { getAuth } = await import("firebase/auth");
                    let secondaryApp = getApps().find(a => a.name === "secondary");
                    if (!secondaryApp) {
                      const primaryApp = getApps()[0];
                      secondaryApp = initializeApp(primaryApp.options, "secondary");
                    }
                    const secondaryAuth = getAuth(secondaryApp);
                    const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, pass);
                    await updateProfile(cred.user, { displayName: name });
                    await setDocFn(docRef(db, `users/${cred.user.uid}`), {
                      uid: cred.user.uid,
                      name,
                      email: newEmail,
                      createdAt: ts(),
                      updatedAt: ts(),
                      createdBy: email,
                    }, { merge: true });
                    await secondaryAuth.signOut();
                    toast.success(`Akun "${newEmail}" berhasil dibuat!`);
                    nameEl.value = "";
                    emailEl.value = "";
                    passEl.value = "";
                  } catch (e: any) {
                    toast.error("Gagal buat akun: " + (e?.message || ""));
                  }
                }}
              >
                Buat Akun
              </button>
            </div>
          </div>
        </div>

        {/* DELETE ACCOUNT */}
        <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Hapus Akun (Firestore Data)</div>
          <div className="small" style={{ marginTop: 4 }}>
            Hapus dokumen user dari Firestore berdasarkan email. Data di Firebase Auth tetap ada (hapus manual di console).
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <input className="input" id="dev-del-email" type="email" placeholder="email yang ingin dihapus" style={{ flex: 1 }} />
            <button
              className="btn btn-danger"
              onClick={async () => {
                const el = document.getElementById("dev-del-email") as HTMLInputElement;
                const delEmail = (el?.value || "").trim().toLowerCase();
                if (!delEmail) { toast.error("Email wajib diisi."); return; }
                if (!confirm(`Hapus data Firestore untuk akun "${delEmail}"?`)) return;
                try {
                  const { getDocs: getDocsFn, query: qFn, where: wFn, collection: colFn, deleteDoc: delFn } = await import("firebase/firestore");
                  const snap = await getDocsFn(qFn(colFn(db, "users"), wFn("email", "==", delEmail)));
                  if (snap.empty) { toast.error("User dengan email tersebut tidak ditemukan di Firestore."); return; }
                  for (const d of snap.docs) {
                    await delFn(d.ref);
                  }
                  toast.success(`Data Firestore untuk "${delEmail}" dihapus (${snap.docs.length} dokumen).`);
                  el.value = "";
                } catch (e: any) {
                  toast.error("Gagal hapus: " + (e?.message || ""));
                }
              }}
            >
              Hapus Data
            </button>
          </div>
        </div>
      </div>
    </TerraPage>
  );
}


// ============ COLOR FIELD COMPONENT ============

function ColorField({
  label,
  colorKey,
  value,
  onChange,
}: {
  label: string;
  colorKey: keyof BrandColorConfig;
  value: string;
  onChange: (key: keyof BrandColorConfig, value: string) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
        background: "var(--panel)",
      }}
    >
      <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(colorKey, e.target.value)}
          style={{
            width: 40,
            height: 40,
            border: "1px solid var(--border)",
            borderRadius: 8,
            cursor: "pointer",
            padding: 2,
            background: "transparent",
          }}
        />
        <input
          className="input"
          value={value || ""}
          onChange={(e) => onChange(colorKey, e.target.value)}
          placeholder="#hex"
          style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
      </div>
      <div
        style={{
          marginTop: 8,
          height: 6,
          borderRadius: 999,
          background: value || "#ccc",
        }}
      />
    </div>
  );
}
