"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";

type Product = { id: string; name: string; category: string; price: number; isActive: boolean };

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function ProductsPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Minuman");
  const [price, setPrice] = useState<number>(0);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) => p.name.toLowerCase().includes(s) || (p.category || "").toLowerCase().includes(s));
  }, [products, q]);

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
        category: category.trim(),
        price: Number(price),
        isActive: true,
        createdAt: serverTimestamp(),
      });
      setName(""); setPrice(0);
    } catch (e: any) {
      setErr(e?.message || "Gagal tambah produk");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    if (!tenantId) return;
    await updateDoc(doc(db, `tenants/${tenantId}/products/${p.id}`), { isActive: !p.isActive, updatedAt: serverTimestamp() });
  }

  async function removeProduct(p: Product) {
    if (!tenantId) return;
    if (!confirm(`Hapus "${p.name}"?`)) return;
    await deleteDoc(doc(db, `tenants/${tenantId}/products/${p.id}`));
  }

  if (loading || loadingRole) return <TerraPage><div className="card">Loading...</div></TerraPage>;

  if (role !== "owner") {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman Products hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/pos")}>Kembali ke POS</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Products</div>
            <div className="small">Tenant: {tenantId}</div>
            <div className="small">User: {email} | Role: <b>{role}</b></div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/pos")}>POS</button>
          <button className="btn" onClick={() => r.push("/orders")}>Orders</button>
          <button className="btn" onClick={() => r.push("/staff")}>Staff</button>
          <button className="btn" onClick={() => r.push("/setup")}>Ganti Tenant</button>
          <button className="btn btn-danger" onClick={() => signOut(auth).then(() => r.push("/login"))}>Logout</button>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="h1">Tambah Produk</div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Nama</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="small">Kategori</div>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="small">Harga</div>
            <input className="input" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value || 0))} />
          </div>

          {err && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 800 }}>{err}</div>}

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={addProduct}>
            {busy ? "Menyimpan..." : "Tambah"}
          </button>
        </div>

        <div className="card">
          <div className="row">
            <div className="h1">Daftar Produk</div>
            <div className="spacer" />
            <input className="input" style={{ maxWidth: 360 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari..." />
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {filtered.map((p) => (
              <div key={p.id} className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>{p.name}</div>
                <div className="small">{p.category}</div>
                <div style={{ marginTop: 6, fontWeight: 900, color: "var(--brand)" }}>Rp {rupiah(p.price)}</div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className={"btn " + (p.isActive ? "btn-primary" : "")} onClick={() => toggleActive(p)}>
                    {p.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                  <button className="btn btn-danger" onClick={() => removeProduct(p)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && <div className="small" style={{ marginTop: 12 }}>Tidak ada produk.</div>}
        </div>
      </div>
    </TerraPage>
  );
}