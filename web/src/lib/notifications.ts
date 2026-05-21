/**
 * TerraPOS In-App Notifications
 *
 * Sistem notifikasi berbasis Firestore (tanpa Cloud Functions / Spark plan).
 * Developer kirim notifikasi dari /dev console.
 * User melihat notifikasi via tombol lonceng di dashboard.
 *
 * Firestore structure:
 *   system/notifications/items/{notifId}
 *     - title: string
 *     - message: string
 *     - type: "info" | "warning" | "success" | "promo"
 *     - createdAt: Timestamp
 *     - createdBy: string (email developer)
 *     - target: "all" | "tenant:{tenantId}" (siapa yang bisa lihat)
 *     - expiresAt: Timestamp | null (kapan notif hilang otomatis)
 *
 * Read status disimpan di localStorage per-user:
 *   terrapos_notif_read_{uid} = ["notifId1", "notifId2", ...]
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ============ TYPES ============

export type NotificationType = "info" | "warning" | "success" | "promo";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: Date | null;
  createdBy: string;
  target: string; // "all" or "tenant:{tenantId}"
  expiresAt: Date | null;
};

// ============ CONSTANTS ============

const NOTIF_COLLECTION = "notifications";
const NOTIF_READ_KEY_PREFIX = "terrapos_notif_read_";
const MAX_NOTIFICATIONS = 50;

// ============ READ STATUS (localStorage) ============

export function getReadNotifIds(uid: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIF_READ_KEY_PREFIX + uid);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function markNotifAsRead(uid: string, notifId: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getReadNotifIds(uid);
    if (!existing.includes(notifId)) {
      existing.push(notifId);
      // Keep only last 200 read IDs to prevent localStorage bloat
      const trimmed = existing.slice(-200);
      localStorage.setItem(NOTIF_READ_KEY_PREFIX + uid, JSON.stringify(trimmed));
    }
  } catch {}
}

export function markAllNotifsAsRead(uid: string, notifIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    const existing = getReadNotifIds(uid);
    const merged = Array.from(new Set([...existing, ...notifIds])).slice(-200);
    localStorage.setItem(NOTIF_READ_KEY_PREFIX + uid, JSON.stringify(merged));
  } catch {}
}

// ============ SUBSCRIBE NOTIFICATIONS ============

/**
 * Subscribe ke notifikasi real-time.
 * Filter berdasarkan target: "all" atau "tenant:{tenantId}"
 */
export function subscribeNotifications(
  callback: (notifications: NotificationItem[]) => void
): () => void {
  const ref = collection(db, NOTIF_COLLECTION);
  const q = query(ref, orderBy("createdAt", "desc"), limit(MAX_NOTIFICATIONS));

  return onSnapshot(
    q,
    (snap) => {
      const now = new Date();
      const items: NotificationItem[] = [];

      for (const d of snap.docs) {
        const data = d.data() as any;

        // Parse dates
        const createdAt: Date | null = data.createdAt?.toDate?.() ?? null;
        const expiresAt: Date | null = data.expiresAt?.toDate?.() ?? null;

        // Skip expired notifications
        if (expiresAt && expiresAt < now) continue;

        items.push({
          id: d.id,
          title: (data.title || "").toString(),
          message: (data.message || "").toString(),
          type: (data.type || "info") as NotificationType,
          createdAt,
          createdBy: (data.createdBy || "").toString(),
          target: (data.target || "all").toString(),
          expiresAt,
        });
      }

      callback(items);
    },
    () => {
      // On error, return empty
      callback([]);
    }
  );
}

/**
 * Filter notifikasi berdasarkan target user
 */
export function filterNotificationsForUser(
  notifications: NotificationItem[],
  tenantId: string
): NotificationItem[] {
  return notifications.filter((n) => {
    if (n.target === "all") return true;
    if (n.target === `tenant:${tenantId}`) return true;
    return false;
  });
}

// ============ SEND NOTIFICATION (Developer only) ============

export type SendNotificationPayload = {
  title: string;
  message: string;
  type: NotificationType;
  target: string; // "all" or "tenant:{tenantId}"
  expiresInHours?: number; // optional: auto-expire after N hours
  createdBy: string; // developer email
};

/**
 * Kirim notifikasi baru (developer only - protected by Firestore rules)
 */
export async function sendNotification(payload: SendNotificationPayload): Promise<string> {
  const ref = collection(db, NOTIF_COLLECTION);

  const docData: any = {
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type,
    target: payload.target,
    createdBy: payload.createdBy,
    createdAt: serverTimestamp(),
    expiresAt: null,
  };

  // Set expiry if specified
  if (payload.expiresInHours && payload.expiresInHours > 0) {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + payload.expiresInHours);
    docData.expiresAt = Timestamp.fromDate(expiryDate);
  }

  const docRef = await addDoc(ref, docData);
  return docRef.id;
}

/**
 * Hapus notifikasi (developer only)
 */
export async function deleteNotification(notifId: string): Promise<void> {
  await deleteDoc(doc(db, NOTIF_COLLECTION, notifId));
}

// ============ HELPERS ============

export function getNotifTypeLabel(type: NotificationType): string {
  switch (type) {
    case "info": return "Info";
    case "warning": return "Peringatan";
    case "success": return "Sukses";
    case "promo": return "Promo";
    default: return "Info";
  }
}

export function getNotifTypeColor(type: NotificationType): string {
  switch (type) {
    case "info": return "var(--brand)";
    case "warning": return "var(--warning)";
    case "success": return "var(--success)";
    case "promo": return "#8b5cf6";
    default: return "var(--brand)";
  }
}

export function getNotifTypeIcon(type: NotificationType): string {
  switch (type) {
    case "info": return "ℹ️";
    case "warning": return "⚠️";
    case "success": return "✅";
    case "promo": return "🎉";
    default: return "ℹ️";
  }
}

export function formatTimeAgo(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
