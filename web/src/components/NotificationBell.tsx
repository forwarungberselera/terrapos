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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const uid = auth.currentUser?.uid || "";

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--brandSoft)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--brand2)";
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--panel)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
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

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxHeight: 440,
            overflowY: "auto",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
            zIndex: 9999,
            padding: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "sticky",
              top: 0,
              background: "var(--panel)",
              zIndex: 1,
              borderRadius: "16px 16px 0 0",
            }}
          >
            <span style={{ fontWeight: 900, fontSize: 14, color: "var(--text)" }}>
              Notifikasi
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--brand)",
                  fontSize: 11,
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
          <div style={{ padding: "6px 0" }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "30px 16px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
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
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: isRead ? "transparent" : "var(--brandSoft)",
                      borderLeft: `3px solid ${isRead ? "transparent" : getNotifTypeColor(n.type)}`,
                      transition: "background 0.15s ease",
                    }}
                    onMouseOver={(e) => {
                      if (isRead) (e.currentTarget as HTMLElement).style.background = "var(--input-bg)";
                    }}
                    onMouseOut={(e) => {
                      if (isRead) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                        {getNotifTypeIcon(n.type)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: isRead ? 600 : 800,
                            fontSize: 13,
                            color: "var(--text)",
                            lineHeight: 1.3,
                          }}
                        >
                          {n.title}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            color: "var(--muted)",
                            lineHeight: 1.4,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {n.message}
                        </div>
                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 10,
                            color: "var(--muted)",
                          }}
                        >
                          {formatTimeAgo(n.createdAt)}
                        </div>
                      </div>
                      {!isRead && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
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
        </div>
      )}
    </div>
  );
}
