import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  enableIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";

/**
 * ✅ PEMULA FRIENDLY
 * - Bisa pakai .env.local (disarankan)
 * - Kalau env kosong, kasih error yang jelas
 * - Offline persistence (cache) ON
 */

function must(v: string | undefined, name: string) {
  if (v && v.trim()) return v.trim();
  // bikin error yang gampang dimengerti
  throw new Error(
    `Firebase config missing: ${name}. Cek file .env.local di folder web (Terra POS/web).`
  );
}

// Ambil dari .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};

// Validasi biar jelas kalau ada yang kosong
const safeConfig = {
  apiKey: must(firebaseConfig.apiKey, "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: must(firebaseConfig.authDomain, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: must(firebaseConfig.projectId, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: must(firebaseConfig.storageBucket, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: must(firebaseConfig.messagingSenderId, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: must(firebaseConfig.appId, "NEXT_PUBLIC_FIREBASE_APP_ID"),
};

const app = getApps().length ? getApps()[0] : initializeApp(safeConfig);

export const auth = getAuth(app);

// Firestore init (client/server aman)
export const db =
  typeof window === "undefined"
    ? getFirestore(app)
    : initializeFirestore(app, {});

// Offline cache (client only)
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch(() => {
    // kalau multiple tab, bisa gagal. itu normal.
  });
}