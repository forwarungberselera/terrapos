"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import {
  collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc,
} from "firebase/firestore";
import { useToast } from "@/components/Toast";

export default function CategoryOrderPage() {
  const router = useRouter();
  const { tenantId, loading } = useTenant();
  const { role, loadingRole } = useRole();
  const toast = useToast();

  const canView = ["owner", "admin", "developer"].includes((role || "").toString().toLowerCase());

  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [orderedCategories, setOrderedCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Load products to get all categories
  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/products`);
    const q = query(ref, orderBy("name"));
    return onSnapshot(q, (snap) => {
      const cats = new Set<string>();
      snap.docs.forEach((d) => {
        const cat = (d.data().category || "Lainnya").toString();
        if (d.data().isActive !== false) cats.add(cat);
      });
      setAllCategories(Array.from(cats).sort());
    });
  }, [tenantId]);

  // Load saved category order
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `tenants/${tenantId}/settings/main`));
        if (snap.exists()) {
          const d = snap.data() as any;
          if (Array.isArray(d.categoryOrder) && d.categoryOrder.length > 0) {
            setOrderedCategories(d.categoryOrder);
            return;
          }
        }
      } catch {}
      // Fallback: use alphabetical
      setOrderedCategories([]);
    })();
  }, [tenantId]);

  // Merge: show saved order first, then any new categories at the end
  const displayCategories = React.useMemo(() => {
    if (orderedCategories.length === 0) return allCategories;
    const result = [...orderedCategories.filter((c) => allCategories.includes(c))];
    allCategories.forEach((c) => {
      if (!result.includes(c)) result.push(c);
    });
    return result;
  }, [allCategories, orderedCategories]);

  // Drag handlers
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newOrder = [...displayCategories];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    setOrderedCategories(newOrder);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  // Move up/down (mobile-friendly alternative to drag)
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const newOrder = [...displayCategories];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    setOrderedCategories(newOrder);
  };
  const moveDown = (idx: number) => {
    if (idx >= displayCategories.length - 1) return;
    const newOrder = [...displayCategories];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    setOrderedCategories(newOrder);
  };

  async function handleSave() {
    if (!tenantId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, `tenants/${tenantId}/settings/main`), {
        categoryOrder: displayCategories,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success("Urutan kategori tersimpan!");
    } catch (e: any) {
      toast.error("Gagal: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingRole) return <TerraPage><div className="card">Loading...</div></TerraPage>;
  if (!canView) {
    return <TerraPage><div className="card"><div className="h1">Akses ditolak</div></div></TerraPage>;
  }

  return (
    <TerraPage>
      <style>{`
        .cat-item {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; background: var(--panel); border: 1px solid var(--border);
          border-radius: 12px; margin-bottom: 8px; cursor: grab;
          transition: background 0.15s, transform 0.1s;
        }
        .cat-item:active { cursor: grabbing; transform: scale(0.98); }
        .cat-item.dragging { opacity: 0.5; background: var(--brandSoft); }
        .cat-num { width: 28px; height: 28px; border-radius: 8px; background: var(--brandSoft);
          color: var(--brand); display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 900; flex-shrink: 0; }
        .cat-name { flex: 1; font-weight: 700; font-size: 14px; }
        .cat-arrows { display: flex; gap: 4px; }
        .cat-arrows button {
          width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--panel); cursor: pointer; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
        }
        .cat-arrows button:active { background: var(--brandSoft); }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Urutan Kategori Menu</div>
            <div className="small">Drag atau gunakan panah untuk mengatur urutan kategori di menu customer.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => router.push("/products")}>Products</button>
          <button className="btn" onClick={() => router.push("/dashboard")}>Dashboard</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {displayCategories.length === 0 ? (
          <div className="small" style={{ textAlign: "center", padding: 20 }}>Belum ada kategori. Tambah produk dulu.</div>
        ) : (
          displayCategories.map((cat, idx) => (
            <div
              key={cat}
              className={`cat-item ${dragIdx === idx ? "dragging" : ""}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
            >
              <div className="cat-num">{idx + 1}</div>
              <div className="cat-name">{cat}</div>
              <div className="cat-arrows">
                <button onClick={() => moveUp(idx)} disabled={idx === 0}>↑</button>
                <button onClick={() => moveDown(idx)} disabled={idx === displayCategories.length - 1}>↓</button>
              </div>
            </div>
          ))
        )}

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 16 }}
          disabled={saving || displayCategories.length === 0}
          onClick={handleSave}
        >
          {saving ? "Menyimpan..." : "Simpan Urutan"}
        </button>
      </div>
    </TerraPage>
  );
}
