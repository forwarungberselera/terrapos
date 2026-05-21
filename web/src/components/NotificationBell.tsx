"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  filterNotificationsForUser,
  formatTimeAgo,
  getNotifTypeColor,
  getNotifTypeIcon,
  getReadNotifIds,
  markAllNotifsAsRead,
  markNotifAsRead,
  NotificationItem,
  subscribeNotifications,
} from "@/lib/notifications";

type Props = {
  tenantId: string;
};

export default function NotificationBell({ tenantId }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const uid = auth.currentUser?.uid || "";

  // Detect mobile
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 640);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Subscribe to notifications
  useEffect(() => {
    const unsub = subscribeNotifications((items) => {
      setNotifications(items);
    });
    return () => unsub();
  }, []);

  // Load read status
  useEffect(() => {
    if (uid) {
      setReadIds(getReadNotifIds(uid));
    }
  }, [uid]);

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    if (!open || isMobile) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, isMobile]);

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, open]);

  // Filter notifications for this user's tenant
  const filtered = useMemo(
    () => filterNotificationsForUser(notifications, tenantId),
    [notifications, tenantId]
  );

  // Count unread
  const unreadCount = useMemo(
    () => filtered.filter((n) => !readIds.includes(n.id)).length,
    [filtered, readIds]
  );

  function handleOpen() {
    setOpen((prev) => !prev);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleMarkRead(notifId: string) {
    if (!uid) return;
    markNotifAsRead(uid, notifId);
    setReadIds((prev) => [...prev, notifId]);
  }

  function handleMarkAllRead() {
    if (!uid) return;
    const ids = filtered.map((n) => n.id);
    markAllNotifsAsRead(uid, ids);
    setReadIds((prev) => Array.from(new Set([...prev, ...ids])));
  }

  // Notification list content (shared between mobile and desktop)
  const notifContent = (
    <>
      {/* Header */}
      <div
        style={{
          padding: isMobile ? "16px 20px 12px" : "14px 16px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: "var(--panel)",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isMobile && (
            <button
              onClick={handleClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: "var(--text)",
                padding: "4px",
                lineHeight: 1,
              }}
            >
              &larr;
            </button>
          )}
          <span style={{ fontWeight: 900, fontSize: isMobile ? 18 : 14, color: "var(--text)" }}>
            Notifikasi
          </span>
          {unreadCount > 0 && (
            <span style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              background: "none",
              border: "none",
              color: "var(--brand)",
              fontSize: isMobile ? 13 : 11,
              fontWeight: 700,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ padding: "4px 0", overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: isMobile ? "60px 20px" : "30px 16px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: isMobile ? 15 : 13,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            Tidak ada notifikasi.
          </div>
        ) : (
          filtered.map((n) => {
            const isRead = readIds.includes(n.id);
            return (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n.id)}
                style={{
                  padding: isMobile ? "14px 20px" : "12px 16px",
                  cursor: "pointer",
                  background: isRead ? "transparent" : "var(--brandSoft)",
                  borderLeft: `3px solid ${isRead ? "transparent" : getNotifTypeColor(n.type)}`,
                  transition: "background 0.15s ease",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: isMobile ? 12 : 10 }}>
                  <span style={{ fontSize: isMobile ? 22 : 16, flexShrink: 0, marginTop: 1 }}>
                    {getNotifTypeIcon(n.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: isRead ? 600 : 800,
                        fontSize: isMobile ? 15 : 13,
                        color: "var(--text)",
                        lineHeight: 1.3,
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: isMobile ? 14 : 12,
                        color: "var(--muted)",
                        lineHeight: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: isMobile ? 3 : 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {n.message}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: isMobile ? 12 : 10,
                        color: "var(--muted)",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span>{formatTimeAgo(n.createdAt)}</span>
                      {n.target !== "all" && (
                        <span style={{
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "var(--input-bg)",
                          border: "1px solid var(--border)",
                          fontSize: isMobile ? 10 : 9,
                          fontWeight: 700,
                        }}>
                          {n.target.replace("tenant:", "")}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isRead && (
                    <span
                      style={{
                        width: isMobile ? 10 : 8,
                        height: isMobile ? 10 : 8,
                        borderRadius: "50%",
                        background: "var(--brand)",
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        aria-label="Notifikasi"
        style={{
          position: "relative",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: 42,
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background 0.15s ease, border-color 0.15s ease, transform 0.1s ease",
          touchAction: "manipulation",
        }}
      >
        {/* Bell SVG Icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 900,
              borderRadius: 999,
              minWidth: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
              border: "2px solid var(--panel)",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* MOBILE: Full-screen overlay */}
      {open && isMobile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "var(--panel)",
            display: "flex",
            flexDirection: "column",
            animation: "notifSlideUp 0.25s ease",
          }}
        >
          <style>{`
            @keyframes notifSlideUp {
              from { transform: translateY(100%); opacity: 0.8; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          {notifContent}
        </div>
      )}

      {/* DESKTOP/TABLET: Dropdown */}
      {open && !isMobile && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 380,
            maxHeight: 480,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "notifFadeIn 0.15s ease",
          }}
        >
          <style>{`
            @keyframes notifFadeIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div style={{ overflowY: "auto", maxHeight: 480, display: "flex", flexDirection: "column" }}>
            {notifContent}
          </div>
        </div>
      )}
    </div>
  );
}
