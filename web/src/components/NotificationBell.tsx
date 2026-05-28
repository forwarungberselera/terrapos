"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  dismissNotif,
  filterNotificationsForUser,
  formatTimeAgo,
  getNotifTypeColor,
  getNotifTypeIcon,
  markAllNotifsAsRead,
  markNotifAsRead,
  NotificationItem,
  NotifReadStatus,
  subscribeNotifStatuses,
  subscribeNotifications,
  getPriorityColor,
} from "@/lib/notifications";
import { playOrderNotificationSound } from "@/lib/order-notification";

type Props = {
  tenantId: string;
};

export default function NotificationBell({ tenantId }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, NotifReadStatus>>({});
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bannerNotif, setBannerNotif] = useState<NotificationItem | null>(null);
  const [toastNotif, setToastNotif] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevNotifIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const uid = auth.currentUser?.uid || "";

  // Detect mobile
  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth < 640); }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Subscribe to notifications
  useEffect(() => {
    const unsub = subscribeNotifications((items) => setNotifications(items));
    return () => unsub();
  }, []);

  // Subscribe to read/dismiss statuses
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeNotifStatuses(uid, (s) => setStatuses(s));
    return () => unsub();
  }, [uid]);

  // Close on click outside
  useEffect(() => {
    if (!open || isMobile) return;
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, isMobile]);

  // Lock body scroll mobile
  useEffect(() => {
    if (isMobile && open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, open]);

  // Filter for this user
  const filtered = useMemo(
    () => filterNotificationsForUser(notifications, tenantId, uid)
      .filter((n) => !statuses[n.id]?.dismissed),
    [notifications, tenantId, uid, statuses]
  );

  // Unread count
  const unreadCount = useMemo(
    () => filtered.filter((n) => !statuses[n.id]?.read).length,
    [filtered, statuses]
  );

  // Detect new notifications → trigger toast/banner/sound
  useEffect(() => {
    const currentIds = new Set(filtered.map((n) => n.id));

    if (isFirstLoadRef.current) {
      prevNotifIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }

    for (const n of filtered) {
      if (!prevNotifIdsRef.current.has(n.id)) {
        // New notification!
        if (n.display === "toast") {
          setToastNotif(n);
          setTimeout(() => setToastNotif(null), 6000);
        }
        if (n.display === "banner") {
          setBannerNotif(n);
        }
        if (n.priority === "high") {
          playOrderNotificationSound();
        }
      }
    }

    prevNotifIdsRef.current = currentIds;
  }, [filtered]);

  // Handlers
  function handleRead(notifId: string) {
    if (!uid) return;
    markNotifAsRead(uid, notifId);
  }

  function handleMarkAllRead() {
    if (!uid) return;
    markAllNotifsAsRead(uid, filtered.map((n) => n.id));
  }

  function handleDismiss(notifId: string) {
    if (!uid) return;
    dismissNotif(uid, notifId);
  }

  function handleAction(n: NotificationItem) {
    if (!n.action) return;
    handleRead(n.id);
    if (n.action.type === "link" && n.action.url) {
      router.push(n.action.url);
      setOpen(false);
    } else if (n.action.type === "external" && n.action.url) {
      window.open(n.action.url, "_blank");
    } else if (n.action.type === "dismiss") {
      handleDismiss(n.id);
    }
  }

  // Render notification list
  const notifContent = (
    <>
      {/* Header */}
      <div style={{
        padding: isMobile ? "16px 20px 12px" : "14px 16px 10px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, background: "var(--panel)", zIndex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isMobile && (
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text)", padding: "4px", lineHeight: 1 }}>
              &larr;
            </button>
          )}
          <span style={{ fontWeight: 900, fontSize: isMobile ? 18 : 14, color: "var(--text)" }}>Notifikasi</span>
          {unreadCount > 0 && (
            <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--danger)", color: "#fff", fontSize: 11, fontWeight: 800 }}>{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} style={{ background: "none", border: "none", color: "var(--brand)", fontSize: isMobile ? 13 : 11, fontWeight: 700, cursor: "pointer" }}>
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ padding: "4px 0", overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: isMobile ? "60px 20px" : "30px 16px", textAlign: "center", color: "var(--muted)", fontSize: isMobile ? 15 : 13 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            Tidak ada notifikasi.
          </div>
        ) : (
          filtered.map((n) => {
            const isRead = statuses[n.id]?.read ?? false;
            return (
              <div key={n.id} onClick={() => handleRead(n.id)} style={{
                padding: isMobile ? "14px 20px" : "12px 16px",
                cursor: "pointer",
                background: isRead ? "transparent" : "var(--brandSoft)",
                borderLeft: `3px solid ${isRead ? "transparent" : getNotifTypeColor(n.type)}`,
                borderBottom: "1px solid var(--border)",
                position: "relative",
              }}>
                {/* Priority indicator for high */}
                {n.priority === "high" && !isRead && (
                  <div style={{ position: "absolute", top: 6, right: 8, width: 6, height: 6, borderRadius: "50%", background: "var(--danger)", animation: "pulse 1.5s infinite" }} />
                )}
                {/* Pinned indicator */}
                {n.pinned && (
                  <div style={{ position: "absolute", top: 6, right: n.priority === "high" ? 20 : 8, fontSize: 10 }}>📌</div>
                )}

                <div style={{ display: "flex", alignItems: "flex-start", gap: isMobile ? 12 : 10 }}>
                  <span style={{ fontSize: isMobile ? 22 : 16, flexShrink: 0, marginTop: 1 }}>
                    {n.icon || getNotifTypeIcon(n.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isRead ? 600 : 800, fontSize: isMobile ? 15 : 13, color: "var(--text)", lineHeight: 1.3 }}>
                      {n.title}
                    </div>
                    <div style={{ marginTop: 4, fontSize: isMobile ? 14 : 12, color: "var(--muted)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any }}>
                      {n.message}
                    </div>

                    {/* Action button */}
                    {n.action && n.action.label && (
                      <button onClick={(e) => { e.stopPropagation(); handleAction(n); }} style={{
                        marginTop: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                        borderRadius: 8, border: `1px solid ${getNotifTypeColor(n.type)}`,
                        background: "transparent", color: getNotifTypeColor(n.type),
                        cursor: "pointer",
                      }}>
                        {n.action.label}
                      </button>
                    )}

                    <div style={{ marginTop: 6, fontSize: isMobile ? 12 : 10, color: "var(--muted)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{formatTimeAgo(n.createdAt)}</span>
                      {n.target !== "all" && (
                        <span style={{ padding: "1px 6px", borderRadius: 4, background: "var(--input-bg)", border: "1px solid var(--border)", fontSize: 9, fontWeight: 700 }}>
                          {n.target.replace("tenant:", "").replace("user:", "")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dismiss button */}
                  <button onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }} style={{
                    background: "none", border: "none", color: "var(--muted)", fontSize: 14,
                    cursor: "pointer", padding: 4, opacity: 0.6, flexShrink: 0,
                  }} title="Sembunyikan">
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Banner notification (sticky top) */}
      {bannerNotif && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 99998,
          padding: "12px 16px", background: getNotifTypeColor(bannerNotif.type),
          color: "#fff", display: "flex", alignItems: "center", gap: 10,
          animation: "slideDown 0.3s ease",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          <style>{`@keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }`}</style>
          <span style={{ fontSize: 18 }}>{bannerNotif.icon || getNotifTypeIcon(bannerNotif.type)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{bannerNotif.title}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{bannerNotif.message}</div>
          </div>
          {bannerNotif.action?.label && (
            <button onClick={() => { handleAction(bannerNotif!); setBannerNotif(null); }} style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.5)",
              background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              {bannerNotif.action.label}
            </button>
          )}
          <button onClick={() => setBannerNotif(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", padding: 4 }}>✕</button>
        </div>
      )}

      {/* Toast notification (bottom-right) */}
      {toastNotif && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 99997,
          padding: "14px 18px", background: "var(--panel)", border: `2px solid ${getNotifTypeColor(toastNotif.type)}`,
          borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          maxWidth: 360, animation: "slideUp 0.3s ease",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>{toastNotif.icon || getNotifTypeIcon(toastNotif.type)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{toastNotif.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{toastNotif.message}</div>
            {toastNotif.action?.label && (
              <button onClick={() => { handleAction(toastNotif!); setToastNotif(null); }} style={{
                marginTop: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700,
                borderRadius: 6, border: `1px solid ${getNotifTypeColor(toastNotif.type)}`,
                background: "transparent", color: getNotifTypeColor(toastNotif.type), cursor: "pointer",
              }}>
                {toastNotif.action.label}
              </button>
            )}
          </div>
          <button onClick={() => setToastNotif(null)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer", padding: 2 }}>✕</button>
        </div>
      )}

      {/* Bell button */}
      <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
        <button onClick={() => setOpen((prev) => !prev)} aria-label="Notifikasi" style={{
          position: "relative", background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: 12, width: 42, height: 42, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", transition: "all 0.15s", touchAction: "manipulation",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 900, borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", border: "2px solid var(--panel)" }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Mobile fullscreen */}
        {open && isMobile && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "var(--panel)", display: "flex", flexDirection: "column", animation: "notifSlideUp 0.25s ease" }}>
            <style>{`@keyframes notifSlideUp { from { transform: translateY(100%); opacity: 0.8; } to { transform: translateY(0); opacity: 1; } }`}</style>
            {notifContent}
          </div>
        )}

        {/* Desktop dropdown */}
        {open && !isMobile && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 400, maxHeight: 500, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.12)", zIndex: 9999, display: "flex", flexDirection: "column", overflow: "hidden", animation: "notifFadeIn 0.15s ease" }}>
            <style>{`@keyframes notifFadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div style={{ overflowY: "auto", maxHeight: 500, display: "flex", flexDirection: "column" }}>
              {notifContent}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
