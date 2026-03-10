import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function getActiveTenantId(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, `users/${uid}`));
  return (snap.exists() ? (snap.data() as any).activeTenantId : null) ?? null;
}

