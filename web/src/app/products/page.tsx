"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import PageHeader from "@/components/PageHeader";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, writeBatch
} from "firebase/firestore";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  isActive: boolean;
};

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}


// ===== ICONS (inline SVG) =====
function IconGrid() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
}
function IconList() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>;
}
function IconSearch() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function IconPlus() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconCheck() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconX() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}


export default function ProductsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Minuman");
  const [price, setPrice] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Edit state
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  // Bulk action state
  const [bulkBusy, setBulkBusy] = useState(false);


  // Firestore real-time listener
  useEffect(() => {
    if (!tenantId) return;
    const ref = collection(db, `tenants/${tenantId}/products`);
    const qy = query(ref, orderBy("category", "asc"), orderBy("name", "asc"));
    return onSnapshot(qy, (snap) => {
      const arr: Product[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || "",
          category: data.category || "Lainnya",
          price: Number(data.price || 0),
          isActive: data.isActive ?? true,
        };
      });
      setProducts(arr);
    }, (e) => setErr(e.message));
  }, [tenantId]);

  // Derived: unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ["all", ...Array.from(cats).sort()];
  }, [products]);

  // Filtered products
  const filtered = useMemo(() => {
    let result = products;
    if (selectedCategory !== "all") {
      result = result.filter((p) => p.category === selectedCategory);
    }
    const s = searchQuery.trim().toLowerCase();
    if (s) {
      result = result.filter(
        (p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)
      );
    }
    return result;
  }, [products, selectedCategory, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    inactive: products.filter((p) => !p.isActive).length,
    categories: new Set(products.map((p) => p.category)).size,
  }), [products]);


  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }, [filtered, selectedIds]);

  // CRUD handlers
  async function addProduct() {
    if (!tenantId) return;
    setErr(null);
    const n = name.trim();
    if (!n) return setErr("Nama wajib diisi.");
    if (Number(price) <= 0) return setErr("Harga harus > 0.");
    setBusy(true);
    try {
      await addDoc(collection(db, `tenants/${tenantId}/products`), {
        name: n,
        category: category.trim() || "Lainnya",
        price: Number(price),
        isActive: true,
        createdAt: serverTimestamp(),
      });
      setName(""); setPrice(0); setShowAddForm(false);
    } catch (e: any) {
      setErr(e?.message || "Gagal tambah produk");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditPrice(p.price);
    setEditErr(null);
  }

  function closeEdit() {
    setEditProduct(null);
    setEditErr(null);
  }


  async function saveEdit() {
    if (!tenantId || !editProduct) return;
    setEditErr(null);
    const n = editName.trim();
    if (!n) return setEditErr("Nama wajib diisi.");
    if (Number(editPrice) <= 0) return setEditErr("Harga harus > 0.");
    setEditBusy(true);
    try {
      await updateDoc(doc(db, `tenants/${tenantId}/products/${editProduct.id}`), {
        name: n,
        category: editCategory.trim() || "Lainnya",
        price: Number(editPrice),
        updatedAt: serverTimestamp(),
      });
      closeEdit();
    } catch (e: any) {
      setEditErr(e?.message || "Gagal update produk");
    } finally {
      setEditBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    if (!tenantId) return;
    await updateDoc(doc(db, `tenants/${tenantId}/products/${p.id}`), {
      isActive: !p.isActive, updatedAt: serverTimestamp(),
    });
  }

  async function removeProduct(p: Product) {
    if (!tenantId) return;
    if (!confirm(`Hapus "${p.name}"?`)) return;
    await deleteDoc(doc(db, `tenants/${tenantId}/products/${p.id}`));
  }

  // Bulk actions
  async function bulkToggleActive(active: boolean) {
    if (!tenantId || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.update(doc(db, `tenants/${tenantId}/products/${id}`), {
          isActive: active, updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (e: any) {
      setErr(e?.message || "Gagal bulk update");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (!tenantId || selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} produk yang dipilih?`)) return;
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.delete(doc(db, `tenants/${tenantId}/products/${id}`));
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (e: any) {
      setErr(e?.message || "Gagal bulk delete");
    } finally {
      setBulkBusy(false);
    }
  }


  // Loading & access check
  if (loading || loadingRole) return <TerraPage><div className="card"><div style={{padding:"40px 0",textAlign:"center",color:"var(--muted)"}}>Loading...</div></div></TerraPage>;

  if (role !== "owner" && role !== "admin" && role !== "developer") {
    return (
      <TerraPage>
        <div className="card" style={{textAlign:"center",padding:"40px 20px"}}>
          <div className="h1">Akses Ditolak</div>
          <div className="small" style={{marginTop:8}}>Halaman Products hanya untuk admin/owner.</div>
          <button className="btn" style={{marginTop:16}} onClick={() => r.push("/dashboard")}>Kembali ke Dashboard</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <style>{productsStyles}</style>

      {/* Edit Modal */}
      {editProduct && (
        <div className="prod-modal-overlay" onClick={closeEdit}>
          <div className="prod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="prod-modal-header">
              <div className="h1">Edit Produk</div>
              <button className="btn btn-ghost" onClick={closeEdit}><IconX /></button>
            </div>
            <div className="prod-form-group">
              <label className="prod-label">Nama Produk</label>
              <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama produk..." />
            </div>
            <div className="prod-form-group">
              <label className="prod-label">Kategori</label>
              <input className="input" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Kategori..." />
            </div>
            <div className="prod-form-group">
              <label className="prod-label">Harga (Rp)</label>
              <input className="input" type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value || 0))} />
            </div>
            {editErr && <div className="prod-error">{editErr}</div>}
            <div className="row" style={{marginTop:20,gap:10}}>
              <button className="btn btn-primary" style={{flex:1}} disabled={editBusy} onClick={saveEdit}>
                {editBusy ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
              <button className="btn" style={{flex:1}} onClick={closeEdit}>Batal</button>
            </div>
          </div>
        </div>
      )}


      {/* Add Product Modal */}
      {showAddForm && (
        <div className="prod-modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="prod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="prod-modal-header">
              <div className="h1">Tambah Produk Baru</div>
              <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}><IconX /></button>
            </div>
            <div className="prod-form-group">
              <label className="prod-label">Nama Produk</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Es Teh Manis" />
            </div>
            <div className="prod-form-group">
              <label className="prod-label">Kategori</label>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Contoh: Minuman" />
            </div>
            <div className="prod-form-group">
              <label className="prod-label">Harga (Rp)</label>
              <input className="input" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value || 0))} placeholder="0" />
            </div>
            {err && <div className="prod-error">{err}</div>}
            <button className="btn btn-primary" style={{width:"100%",marginTop:16}} disabled={busy} onClick={addProduct}>
              {busy ? "Menyimpan..." : "Tambah Produk"}
            </button>
          </div>
        </div>
      )}


      {/* Header */}
      <PageHeader title="Products" subtitle={`${stats.total} produk \u00B7 ${stats.categories} kategori`}>
        <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <IconPlus /> Tambah
        </button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="prod-stats">
        <div className="prod-stat-card">
          <div className="prod-stat-value">{stats.total}</div>
          <div className="prod-stat-label">Total Produk</div>
        </div>
        <div className="prod-stat-card">
          <div className="prod-stat-value" style={{color:"var(--success)"}}>{stats.active}</div>
          <div className="prod-stat-label">Aktif</div>
        </div>
        <div className="prod-stat-card">
          <div className="prod-stat-value" style={{color:"var(--danger)"}}>{stats.inactive}</div>
          <div className="prod-stat-label">Nonaktif</div>
        </div>
        <div className="prod-stat-card">
          <div className="prod-stat-value" style={{color:"var(--brand)"}}>{stats.categories}</div>
          <div className="prod-stat-label">Kategori</div>
        </div>
      </div>


      {/* Toolbar: Search + Filter + View Toggle */}
      <div className="prod-toolbar">
        <div className="prod-search-wrap">
          <IconSearch />
          <input
            className="prod-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari produk..."
          />
          {searchQuery && (
            <button className="prod-search-clear" onClick={() => setSearchQuery("")}><IconX /></button>
          )}
        </div>
        <div className="prod-view-toggle">
          <button className={`prod-view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")} title="Grid view">
            <IconGrid />
          </button>
          <button className={`prod-view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")} title="List view">
            <IconList />
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="prod-categories no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`prod-cat-btn ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat === "all" ? "Semua" : cat}
            {cat !== "all" && (
              <span className="prod-cat-count">
                {products.filter((p) => p.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>


      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="prod-bulk-bar">
          <span className="prod-bulk-count">{selectedIds.size} dipilih</span>
          <div className="prod-bulk-actions">
            <button className="btn" disabled={bulkBusy} onClick={() => bulkToggleActive(true)}>Aktifkan</button>
            <button className="btn" disabled={bulkBusy} onClick={() => bulkToggleActive(false)}>Nonaktifkan</button>
            <button className="btn btn-danger" disabled={bulkBusy} onClick={bulkDelete}>
              <IconTrash /> Hapus
            </button>
          </div>
          <button className="btn btn-ghost" onClick={() => setSelectedIds(new Set())}><IconX /></button>
        </div>
      )}

      {/* Select All */}
      {filtered.length > 0 && (
        <div className="prod-select-all">
          <label className="prod-checkbox-label" onClick={selectAll}>
            <span className={`prod-checkbox ${selectedIds.size === filtered.length ? "checked" : ""}`}>
              {selectedIds.size === filtered.length && <IconCheck />}
            </span>
            <span className="small">Pilih Semua ({filtered.length})</span>
          </label>
          <div className="small">{filtered.length} produk ditampilkan</div>
        </div>
      )}


      {/* Product Grid/List */}
      {filtered.length === 0 ? (
        <div className="prod-empty">
          <div style={{fontSize:40,marginBottom:12}}>📦</div>
          <div className="h1" style={{fontSize:16}}>Tidak ada produk</div>
          <div className="small" style={{marginTop:4}}>
            {searchQuery || selectedCategory !== "all" ? "Coba ubah filter atau kata kunci pencarian." : "Klik tombol Tambah untuk menambah produk baru."}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="prod-grid">
          {filtered.map((p) => (
            <div key={p.id} className={`prod-card ${!p.isActive ? "inactive" : ""} ${selectedIds.has(p.id) ? "selected" : ""}`}>
              <div className="prod-card-select" onClick={() => toggleSelect(p.id)}>
                <span className={`prod-checkbox ${selectedIds.has(p.id) ? "checked" : ""}`}>
                  {selectedIds.has(p.id) && <IconCheck />}
                </span>
              </div>
              <div className="prod-card-body">
                <div className="prod-card-cat">{p.category}</div>
                <div className="prod-card-name">{p.name}</div>
                <div className="prod-card-price">Rp {rupiah(p.price)}</div>
                <div className={`prod-card-status ${p.isActive ? "active" : ""}`}>
                  {p.isActive ? "Aktif" : "Nonaktif"}
                </div>
              </div>
              <div className="prod-card-actions">
                <button className="prod-action-btn" onClick={() => openEdit(p)} title="Edit"><IconEdit /></button>
                <button className="prod-action-btn" onClick={() => toggleActive(p)} title={p.isActive ? "Nonaktifkan" : "Aktifkan"}>
                  {p.isActive ? "⏸" : "▶"}
                </button>
                <button className="prod-action-btn danger" onClick={() => removeProduct(p)} title="Hapus"><IconTrash /></button>
              </div>
            </div>
          ))}
        </div>


      ) : (
        <div className="prod-list">
          {filtered.map((p) => (
            <div key={p.id} className={`prod-list-item ${!p.isActive ? "inactive" : ""} ${selectedIds.has(p.id) ? "selected" : ""}`}>
              <div className="prod-list-select" onClick={() => toggleSelect(p.id)}>
                <span className={`prod-checkbox ${selectedIds.has(p.id) ? "checked" : ""}`}>
                  {selectedIds.has(p.id) && <IconCheck />}
                </span>
              </div>
              <div className="prod-list-info">
                <div className="prod-list-name">{p.name}</div>
                <div className="prod-list-meta">
                  <span className="prod-list-cat">{p.category}</span>
                  <span className={`prod-list-status ${p.isActive ? "active" : ""}`}>
                    {p.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
              <div className="prod-list-price">Rp {rupiah(p.price)}</div>
              <div className="prod-list-actions">
                <button className="prod-action-btn" onClick={() => openEdit(p)} title="Edit"><IconEdit /></button>
                <button className="prod-action-btn" onClick={() => toggleActive(p)} title={p.isActive ? "Nonaktifkan" : "Aktifkan"}>
                  {p.isActive ? "⏸" : "▶"}
                </button>
                <button className="prod-action-btn danger" onClick={() => removeProduct(p)} title="Hapus"><IconTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </TerraPage>
  );
}


// ===== STYLES =====
const productsStyles = `
  .prod-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .prod-header-left { display: flex; flex-direction: column; gap: 2px; }
  .prod-header-actions { display: flex; gap: 8px; align-items: center; }

  .prod-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .prod-stat-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    text-align: center;
    transition: box-shadow 0.2s;
  }
  .prod-stat-card:hover { box-shadow: var(--shadow); }
  .prod-stat-value { font-size: 22px; font-weight: 900; line-height: 1.2; }
  .prod-stat-label { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

  .prod-toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .prod-search-wrap {
    flex: 1;
    min-width: 200px;
    position: relative;
    display: flex;
    align-items: center;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0 12px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .prod-search-wrap:focus-within {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px rgba(213,149,103,0.1);
  }
  .prod-search-wrap svg { color: var(--muted); flex-shrink: 0; }
  .prod-search-input {
    border: none;
    background: transparent;
    outline: none;
    padding: 11px 10px;
    width: 100%;
    font-size: 14px;
    color: var(--text);
  }
  .prod-search-input::placeholder { color: var(--muted); opacity: 0.7; }
  .prod-search-clear {
    background: none; border: none; cursor: pointer;
    color: var(--muted); padding: 4px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .prod-search-clear:hover { color: var(--text); background: var(--bg); }


  .prod-view-toggle {
    display: flex;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .prod-view-btn {
    background: none; border: none; cursor: pointer;
    padding: 10px 12px;
    color: var(--muted);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  .prod-view-btn:hover { background: var(--bg); }
  .prod-view-btn.active { background: var(--brandSoft); color: var(--brand); }

  .prod-categories {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 0;
  }
  .prod-cat-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .prod-cat-btn:hover { border-color: var(--brand2); background: var(--brandSoft); }
  .prod-cat-btn.active {
    background: var(--brand);
    color: white;
    border-color: var(--brand);
  }
  .prod-cat-count {
    background: rgba(255,255,255,0.25);
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
  }
  .prod-cat-btn:not(.active) .prod-cat-count {
    background: var(--bg);
    color: var(--muted);
  }


  .prod-bulk-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--brand);
    color: white;
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    animation: slideUp 0.2s ease-out;
  }
  .prod-bulk-count { font-weight: 800; font-size: 13px; }
  .prod-bulk-actions { display: flex; gap: 8px; flex: 1; }
  .prod-bulk-bar .btn { background: rgba(255,255,255,0.2); border: none; color: white; font-size: 12px; padding: 7px 12px; }
  .prod-bulk-bar .btn:hover { background: rgba(255,255,255,0.3); }
  .prod-bulk-bar .btn-danger { background: rgba(239,68,68,0.8); }
  .prod-bulk-bar .btn-ghost { color: white; }

  .prod-select-all {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }
  .prod-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
  .prod-checkbox {
    width: 20px; height: 20px;
    border-radius: 6px;
    border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
    color: white;
    flex-shrink: 0;
  }
  .prod-checkbox.checked {
    background: var(--brand);
    border-color: var(--brand);
  }


  .prod-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
  .prod-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    position: relative;
    transition: all 0.2s;
    animation: fadeIn 0.25s ease-out;
  }
  .prod-card:hover { box-shadow: var(--shadow); border-color: var(--border-hover); }
  .prod-card.selected { border-color: var(--brand); background: var(--brandSoft); }
  .prod-card.inactive { opacity: 0.6; }
  .prod-card-select {
    position: absolute;
    top: 12px; right: 12px;
    cursor: pointer;
  }
  .prod-card-body { padding-right: 30px; }
  .prod-card-cat {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--brand);
    margin-bottom: 4px;
  }
  .prod-card-name {
    font-size: 15px;
    font-weight: 800;
    line-height: 1.3;
    margin-bottom: 6px;
  }
  .prod-card-price {
    font-size: 16px;
    font-weight: 900;
    color: var(--text);
    font-family: var(--font-mono);
  }
  .prod-card-status {
    display: inline-block;
    margin-top: 8px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    background: #fee2e2;
    color: var(--danger);
  }
  .prod-card-status.active { background: #d1fae5; color: #065f46; }
  .prod-card-actions {
    display: flex;
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }


  .prod-action-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 10px;
    cursor: pointer;
    color: var(--muted);
    font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .prod-action-btn:hover { background: var(--brandSoft); color: var(--brand); border-color: var(--brand2); }
  .prod-action-btn.danger:hover { background: #fee2e2; color: var(--danger); border-color: #fca5a5; }

  .prod-list { display: flex; flex-direction: column; gap: 4px; }
  .prod-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    transition: all 0.15s;
  }
  .prod-list-item:hover { box-shadow: var(--shadow-card); border-color: var(--border-hover); }
  .prod-list-item.selected { border-color: var(--brand); background: var(--brandSoft); }
  .prod-list-item.inactive { opacity: 0.6; }
  .prod-list-select { cursor: pointer; flex-shrink: 0; }
  .prod-list-info { flex: 1; min-width: 0; }
  .prod-list-name { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prod-list-meta { display: flex; gap: 8px; align-items: center; margin-top: 2px; }
  .prod-list-cat { font-size: 12px; color: var(--brand); font-weight: 600; }
  .prod-list-status { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 999px; background: #fee2e2; color: var(--danger); }
  .prod-list-status.active { background: #d1fae5; color: #065f46; }
  .prod-list-price { font-weight: 900; font-family: var(--font-mono); font-size: 14px; white-space: nowrap; }
  .prod-list-actions { display: flex; gap: 6px; flex-shrink: 0; }


  .prod-empty {
    text-align: center;
    padding: 60px 20px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .prod-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 16px;
    animation: fadeIn 0.15s ease-out;
  }
  .prod-modal {
    background: var(--panel);
    border-radius: var(--radius-lg);
    padding: 24px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: scaleIn 0.2s ease-out;
  }
  .prod-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .prod-form-group { margin-bottom: 14px; }
  .prod-label { font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.3px; }
  .prod-error { color: var(--danger); font-weight: 800; font-size: 13px; margin-top: 8px; }

  @media (max-width: 768px) {
    .prod-stats { grid-template-columns: repeat(2, 1fr); }
    .prod-header { flex-direction: column; align-items: flex-start; }
    .prod-header-actions { width: 100%; }
    .prod-header-actions .btn { flex: 1; }
    .prod-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
    .prod-list-item { flex-wrap: wrap; }
    .prod-list-price { width: 100%; order: 3; margin-top: 4px; }
    .prod-list-actions { width: 100%; order: 4; margin-top: 8px; }
    .prod-toolbar { flex-direction: column; }
    .prod-search-wrap { width: 100%; }
  }
`;
