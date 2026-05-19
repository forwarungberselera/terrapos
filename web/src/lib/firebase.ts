import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

/**
 * ✅ PEMULA FRIENDLY
 * - Bisa pakai .env.local (disarankan)
 * - Kalau env kosong, kasih error yang jelas
 * - Offline persistence (cache) ON
 */

function must(v: string | undefined, name: string) {
  if (v && v.trim()) return v.trim();
  // Saat build/prerender, env mungkin belum tersedia - jangan crash
  if (typeof window === "undefined") return "PLACEHOLDER";
  // Di browser, kalau env kosong kasih error yang jelas
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

export const app = getApps().length ? getApps()[0] : initializeApp(safeConfig);

export const auth = getAuth(app);

// Paksa auth persist di IndexedDB/localStorage supaya tidak logout saat keluar app
if (typeof window !== "undefined") {
  // Untuk Capacitor WebView: browserLocalPersistence (localStorage) lebih stabil
  // daripada indexedDB yang bisa di-clear saat app di-kill di beberapa device
  const isCapacitor = typeof (window as any).Capacitor !== "undefined";
  const primaryPersistence = isCapacitor ? browserLocalPersistence : indexedDBLocalPersistence;
  const fallbackPersistence = isCapacitor ? indexedDBLocalPersistence : browserLocalPersistence;
  
  setPersistence(auth, primaryPersistence).catch(() => {
    setPersistence(auth, fallbackPersistence).catch(() => {});
  });

  // Simpan info user ke localStorage sebagai backup
  auth.onAuthStateChanged((user) => {
    if (user) {
      localStorage.setItem("terrapos_uid", user.uid);
      localStorage.setItem("terrapos_email", user.email || "");
    }
  });
}

export const functions = getFunctions(app);

// Firestore init (client/server aman)
// Menggunakan persistentLocalCache (pengganti enableIndexedDbPersistence yang deprecated)
export const db =
  typeof window === "undefined"
    ? getFirestore(app)
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });

// Emulator (client only)
if (typeof window !== "undefined") {
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocalhost && !(window as any).__terraposFunctionsEmulatorConnected) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    (window as any).__terraposFunctionsEmulatorConnected = true;
  }
}
