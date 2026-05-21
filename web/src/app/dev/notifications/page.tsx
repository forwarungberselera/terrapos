"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { checkIsDeveloper } from "@/lib/developer";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  NotificationItem,
  NotificationType,
  sendNotification,
  deleteNotification,
  subscribeNotifications,
  getNotifTypeColor,
  getNotifTypeIcon,
  formatTimeAgo,
} from "@/lib/notifications";

type TenantItem = { id: string; name: string };

export default function DevNotificationsPage() {
  const r = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [email, setEmail] = useState("");

  // Form state
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifType, setNotifType] = useState<NotificationType>("info");
  const [notifTarget, setNotifTarget] = useState("all");
  const [notifExpiry, setNotifExpiry] = useState("0");
  const [sendingNotif, setSendingNotif] = useState(false);

  // Data
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [tenants, setTenants] = useState<TenantItem[]>([]);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); r.push("/login"); return; }
      setEmail(user.email || "");
      const devStatus = await checkIsDeveloper(user.uid, user.email || "");
      setIsDeveloper(devStatus);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  // Subscribe notifications
  useEffect(() => {
    if (!isDeveloper) return;
    setLoadingNotifs(true);
    const unsub = subscribeNotifications((items) => {
      setNotifications(items);
      setLoadingNotifs(false);
    });
    return () => unsub();
  }, [isDeveloper]);

  // Load tenants
  useEffect(() => {
    if (!isDeveloper) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "tenants"));
        setTenants(snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: data.name || data.storeName || d.id };
        }));
      } catch {}
    })();
  }, [isDeveloper]);

  async function handleSend() {
    if (!notifTitle.trim()) { toast.error("Judul wajib diisi."); return; }
    if (!notifMessage.trim()) { toast.error("Pesan wajib diisi."); return; }

    setSendingNotif(true);
    try {
      await sendNotification({
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        target: notifTarget,
        expiresInHours: parseInt(notifExpiry) || 0,
        createdBy: email,
      });
      toast.success("Notifikasi berhasil dikirim!");
      setNotifTitle("");
      setNotifMessage("");
      setNotifType("info");
      setNotifTarget("all");
      setNotifExpiry("0");
    } catch (e: any) {
      toast.error("Gagal: " + (e?.message || ""));
    } finally {
      setSendingNotif(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus notifikasi ini?")) return;
    try {
      await deleteNotification(id);
      toast.success("Dihapus.");
    } catch (e: any) {
      toast.error("Gagal hapus: " + (e?.message || ""));
    }
  }

  if (loading) {
    return <TerraPage maxWidth={900}><SkeletonStyles /><PageSkeleton cards={2} /></TerraPage>;
  }

  if (!isDeveloper) {
    return (
      <TerraPage maxWidth={600}>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="h1">Akses Ditolak</div>
          <div className="small" style={{ marginTop: 8 }}>Halaman ini hanya untuk Developer.</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => r.push("/dashboard")}>Kembali</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage maxWidth={900}>
      <style>{`
        .notif-page-header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
        }
        .notif-form-grid{
          display:grid;
          gap:14px;
          margin-top:16px;
        }
        .notif-form-row{
          display:grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap:10px;
        }
        @media(max-width:640px){
          .notif-form-row{ grid-template-columns:1fr; }
        }
        .notif-field label{
          display:block;
          font-size:11px;
          font-weight:800;
          color:var(--muted);
          text-transform:uppercase;
          letter-spacing:0.3px;
          margin-bottom:6px;
        }
        .notif-list{
          margin-top:20px;
          display:grid;
          gap:10px;
        }
        .notif-item{
          padding:14px 16px;
          border:1px solid var(--border);
          border-radius:14px;
          background:var(--panel);
          transition: box-shadow 0.15s ease;
        }
        .notif-item:hover{ box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .notif-item-header{
          display:flex;
          align-items:center;
          gap:10px;
        }
        .notif-item-icon{ font-size:20px; flex-shrink:0; }
        .notif-item-title{ font-weight:800; font-size:14px; color:var(--text); flex:1; }
        .notif-item-body{
          margin-top:6px;
          font-size:13px;
          color:var(--text);
          line-height:1.5;
          padding-left:30px;
        }
        .notif-item-meta{
          margin-top:8px;
          padding-left:30px;
          display:flex;
          gap:12px;
          flex-wrap:wrap;
          font-size:11px;
          color:var(--muted);
        }
        .notif-item-meta .tag{
          padding:3px 8px;
          border-radius:6px;
          background:var(--input-bg);
          border:1px solid var(--border);
          font-weight:700;
        }
        .notif-empty{
          text-align:center;
          padding:40px 20px;
          color:var(--muted);
          font-size:14px;
        }
        .notif-counter{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:6px 12px;
          border-radius:999px;
          background:var(--brandSoft);
          border:1px solid var(--brand2);
          font-size:12px;
          font-weight:800;
          color:var(--brand);
        }
      `}</style>

      {/* Header */}
      <div className="card">
        <div className="notif-page-header">
          <div>
            <div className="h1">Kirim Notifikasi</div>
            <div className="small" style={{ marginTop: 4 }}>Broadcast notifikasi in-app ke user. Tanpa Cloud Functions.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => r.push("/dev")}>Dev Console</button>
            <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
          </div>
        </div>
      </div>

      {/* Compose Form */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "var(--text)" }}>Compose Notifikasi</div>
        <div className="small" style={{ marginTop: 4 }}>Isi form di bawah untuk mengirim notifikasi ke semua user atau tenant tertentu.</div>

        <div className="notif-form-grid">
          <div className="notif-field">
            <label>Judul Notifikasi</label>
            <input
              className="input"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              placeholder="Contoh: Ada fitur baru!"
              maxLength={100}
            />
          </div>

          <div className="notif-field">
            <label>Pesan</label>
            <textarea
              className="input"
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              placeholder="Tulis pesan notifikasi di sini..."
              rows={3}
              maxLength={500}
              style={{ resize: "vertical", minHeight: 70 }}
            />
          </div>

          <div className="notif-form-row">
            <div className="notif-field">
              <label>Tipe</label>
              <select className="input" value={notifType} onChange={(e) => setNotifType(e.target.value as NotificationType)}>
                <option value="info">Info</option>
                <option value="warning">Peringatan</option>
                <option value="success">Sukses</option>
                <option value="promo">Promo</option>
              </select>
            </div>

            <div className="notif-field">
              <label>Target</label>
              <select className="input" value={notifTarget} onChange={(e) => setNotifTarget(e.target.value)}>
                <option value="all">Semua User</option>
                {tenants.map((t) => (
                  <option key={t.id} value={`tenant:${t.id}`}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="notif-field">
              <label>Kadaluarsa</label>
              <select className="input" value={notifExpiry} onChange={(e) => setNotifExpiry(e.target.value)}>
                <option value="0">Tidak kadaluarsa</option>
                <option value="1">1 jam</option>
                <option value="6">6 jam</option>
                <option value="12">12 jam</option>
                <option value="24">1 hari</option>
                <option value="72">3 hari</option>
                <option value="168">7 hari</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          {notifTitle.trim() && (
            <div style={{ padding: 14, borderRadius: 12, border: `2px solid ${getNotifTypeColor(notifType)}`, background: "var(--input-bg)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>PREVIEW</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{getNotifTypeIcon(notifType)}</span>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{notifTitle}</span>
              </div>
              {notifMessage.trim() && (
                <div style={{ marginTop: 4, fontSize: 13, color: "var(--text)", paddingLeft: 26, lineHeight: 1.5 }}>
                  {notifMessage}
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: 900 }}
            onClick={handleSend}
            disabled={sendingNotif}
          >
            {sendingNotif ? "Mengirim..." : "Kirim Notifikasi"}
          </button>
        </div>
      </div>

      {/* Active Notifications */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="notif-page-header">
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "var(--text)" }}>Notifikasi Aktif</div>
            <div className="small" style={{ marginTop: 4 }}>Semua notifikasi yang sedang tampil ke user.</div>
          </div>
          <span className="notif-counter">{notifications.length} aktif</span>
        </div>

        <div className="notif-list">
          {loadingNotifs ? (
            <div className="notif-empty">Memuat...</div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">Belum ada notifikasi. Kirim yang pertama!</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="notif-item" style={{ borderLeftColor: getNotifTypeColor(n.type), borderLeftWidth: 4 }}>
                <div className="notif-item-header">
                  <span className="notif-item-icon">{getNotifTypeIcon(n.type)}</span>
                  <span className="notif-item-title">{n.title}</span>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 11, padding: "5px 10px" }}
                    onClick={() => handleDelete(n.id)}
                  >
                    Hapus
                  </button>
                </div>
                <div className="notif-item-body">{n.message}</div>
                <div className="notif-item-meta">
                  <span className="tag">{n.target === "all" ? "Semua User" : n.target.replace("tenant:", "")}</span>
                  <span className="tag">{n.type}</span>
                  <span>{formatTimeAgo(n.createdAt)}</span>
                  <span>oleh {n.createdBy}</span>
                  {n.expiresAt && <span>Expire: {n.expiresAt.toLocaleDateString("id-ID")}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </TerraPage>
  );
}
