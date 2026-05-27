"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { auth, db, authReadyPromise } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { checkIsDeveloper } from "@/lib/developer";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

type UserOption = { uid: string; email: string; name: string };

export default function DevCreateTenantPage() {
  const r = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [devUid, setDevUid] = useState("");

  // Form state
  const [tenantName, setTenantName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [address, setAddress] = useState("");
  const [footer, setFooter] = useState("Terima kasih.");
  const [ownerMode, setOwnerMode] = useState<"self" | "pick" | "none">("self");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [creating, setCreating] = useState(false);

  // Users for owner picker
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { await authReadyPromise; if (!auth.currentUser) { r.push("/login"); return; } return; }
      setDevEmail(user.email || "");
      setDevUid(user.uid);
      const dev = await checkIsDeveloper(user.uid, user.email || "");
      if (!dev) { r.push("/dev"); return; }
      setIsDev(true);
      setLoading(false);
    });
    return () => unsub();
  }, [r]);

  useEffect(() => {
    if (!isDev) return;
    loadUsers();
  }, [isDev]);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => {
        const data = d.data() as any;
        return { uid: d.id, email: data.email || "-", name: data.name || "-" };
      }));
    } catch {}
    finally { setLoadingUsers(false); }
  }

  // Auto-generate tenant ID from name
  function generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
  }

  function handleNameChange(val: string) {
    setTenantName(val);
    // Auto-generate ID hanya jika user belum edit manual
    if (!tenantId || tenantId === generateId(tenantName)) {
      setTenantId(generateId(val));
    }
  }

  async function handleCreate() {
    if (!tenantName.trim()) { toast.error("Nama outlet wajib diisi."); return; }
    if (!tenantId.trim()) { toast.error("Tenant ID wajib diisi."); return; }
    if (!/^[a-z0-9-]+$/.test(tenantId)) { toast.error("Tenant ID hanya boleh huruf kecil, angka, dan dash."); return; }

    setCreating(true);
    try {
      // Determine owner
      let ownerUid = "";
      let ownerEmail = "";
      if (ownerMode === "self") {
        ownerUid = devUid;
        ownerEmail = devEmail;
      } else if (ownerMode === "pick" && selectedOwner) {
        const u = users.find((x) => x.uid === selectedOwner);
        ownerUid = u?.uid || "";
        ownerEmail = u?.email || "";
      }

      // 1. Create tenant document
      await setDoc(doc(db, `tenants/${tenantId}`), {
        name: tenantName.trim(),
        ownerUid,
        ownerEmail,
        createdAt: serverTimestamp(),
        createdBy: devEmail,
        updatedAt: serverTimestamp(),
      });

      // 2. Create settings/main
      await setDoc(doc(db, `tenants/${tenantId}/settings/main`), {
        storeName: tenantName.trim(),
        address: address.trim(),
        footer: footer.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Assign owner to tenant (if owner is set)
      if (ownerUid) {
        // Add to tenantMemberships
        await setDoc(doc(db, `users/${ownerUid}/tenantMemberships/${tenantId}`), {
          tenantId,
          name: tenantName.trim(),
          role: "owner",
          assignedBy: devEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Add to tenant staff
        await setDoc(doc(db, `tenants/${tenantId}/staff/${ownerUid}`), {
          uid: ownerUid,
          email: ownerEmail,
          name: ownerMode === "self" ? "Developer" : (users.find((x) => x.uid === ownerUid)?.name || ""),
          role: "owner",
          assignedBy: devEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      toast.success(`Tenant "${tenantName}" berhasil dibuat!`);

      // Reset form
      setTenantName("");
      setTenantId("");
      setAddress("");
      setFooter("Terima kasih.");
      setOwnerMode("self");
      setSelectedOwner("");

    } catch (e: any) {
      toast.error("Gagal buat tenant: " + (e?.message || ""));
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <TerraPage maxWidth={700}><SkeletonStyles /><PageSkeleton cards={2} /></TerraPage>;

  return (
    <TerraPage maxWidth={700}>
      <style>{`
        .ct-field{margin-top:14px;}
        .ct-field label{display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.3px;}
        .ct-field .input{width:100%;}
        .ct-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .ct-mode{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
        .ct-mode button{padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid var(--border);background:var(--panel);cursor:pointer;transition:all 0.15s;}
        .ct-mode button.active{background:var(--brand);color:#fff;border-color:var(--brand);}
        .ct-preview{margin-top:16px;padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--input-bg);}
        .ct-preview-title{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;margin-bottom:8px;}
        @media(max-width:640px){
          .ct-row{grid-template-columns:1fr;}
          .ct-mode{flex-direction:column;}
          .ct-mode button{width:100%;text-align:center;}
        }
      `}</style>

      {/* HEADER */}
      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="h1">Buat Tenant Baru</div>
            <div className="small">Buat outlet/warung baru dan assign ke owner.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dev/tenants")}>Tenant List</button>
          <button className="btn" onClick={() => r.push("/dev")}>← Dev</button>
        </div>
      </div>

      {/* FORM */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>Detail Outlet</div>

        <div className="ct-field">
          <label>Nama Outlet / Warung</label>
          <input className="input" value={tenantName} onChange={(e) => handleNameChange(e.target.value)} placeholder="Contoh: Warung Kopi Pak Budi" />
        </div>

        <div className="ct-field">
          <label>Tenant ID (auto-generated, bisa diedit)</label>
          <input className="input" value={tenantId} onChange={(e) => setTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="warung-kopi-pak-budi" style={{ fontFamily: "monospace" }} />
          <div className="small" style={{ marginTop: 4 }}>Hanya huruf kecil, angka, dan dash (-). Tidak bisa diubah setelah dibuat.</div>
        </div>

        <div className="ct-row">
          <div className="ct-field">
            <label>Alamat (opsional)</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Contoh No. 123" />
          </div>
          <div className="ct-field">
            <label>Footer Struk</label>
            <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Terima kasih." />
          </div>
        </div>
      </div>

      {/* OWNER ASSIGNMENT */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>Owner</div>
        <div className="small" style={{ marginTop: 4 }}>Siapa yang jadi pemilik outlet ini?</div>

        <div className="ct-mode">
          <button className={ownerMode === "self" ? "active" : ""} onClick={() => setOwnerMode("self")}>Saya (Developer)</button>
          <button className={ownerMode === "pick" ? "active" : ""} onClick={() => setOwnerMode("pick")}>Pilih User Lain</button>
          <button className={ownerMode === "none" ? "active" : ""} onClick={() => setOwnerMode("none")}>Tanpa Owner</button>
        </div>

        {ownerMode === "self" && (
          <div className="small" style={{ marginTop: 10, padding: 10, background: "var(--input-bg)", borderRadius: 8 }}>
            Owner: <b>{devEmail}</b> (akun developer saat ini)
          </div>
        )}

        {ownerMode === "pick" && (
          <div className="ct-field">
            <label>Pilih User sebagai Owner</label>
            {loadingUsers ? (
              <div className="small">Memuat users...</div>
            ) : (
              <select className="input" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- Pilih user --</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>{u.name} ({u.email})</option>
                ))}
              </select>
            )}
          </div>
        )}

        {ownerMode === "none" && (
          <div className="small" style={{ marginTop: 10, padding: 10, background: "var(--input-bg)", borderRadius: 8 }}>
            Tenant dibuat tanpa owner. Assign owner nanti di halaman User Management.
          </div>
        )}
      </div>

      {/* PREVIEW */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="ct-preview">
          <div className="ct-preview-title">Preview</div>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 6, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: "var(--muted)" }}>Nama</div>
            <div style={{ fontWeight: 800 }}>{tenantName || "—"}</div>
            <div style={{ fontWeight: 700, color: "var(--muted)" }}>ID</div>
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>{tenantId || "—"}</div>
            <div style={{ fontWeight: 700, color: "var(--muted)" }}>Alamat</div>
            <div>{address || "—"}</div>
            <div style={{ fontWeight: 700, color: "var(--muted)" }}>Footer</div>
            <div>{footer || "—"}</div>
            <div style={{ fontWeight: 700, color: "var(--muted)" }}>Owner</div>
            <div>{ownerMode === "self" ? devEmail : ownerMode === "pick" ? (users.find((x) => x.uid === selectedOwner)?.email || "—") : "Tanpa owner"}</div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 16, padding: "14px", fontSize: 14, fontWeight: 900 }}
          onClick={handleCreate}
          disabled={creating || !tenantName.trim() || !tenantId.trim()}
        >
          {creating ? "Membuat Tenant..." : "Buat Tenant"}
        </button>
      </div>
    </TerraPage>
  );
}
