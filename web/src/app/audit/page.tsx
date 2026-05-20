"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TerraPage from "@/components/TerraPage";
import { useTenant } from "@/hooks/useTenant";
import { useRole } from "@/hooks/useRole";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, limit, startAfter, DocumentSnapshot } from "firebase/firestore";
import { PageSkeleton, SkeletonStyles } from "@/components/Skeleton";

type AuditLog = {
  id: string;
  action: string;
  userEmail: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: any;
};

const ACTION_COLORS: Record<string, string> = {
  SHIFT_OPEN: "#22c55e",
  SHIFT_CLOSE: "#6b7280",
  ORDER_CREATE: "#3b82f6",
  ORDER_PAID: "#22c55e",
  ORDER_CANCEL: "#ef4444",
  ORDER_REFUND: "#f59e0b",
  ORDER_UPDATE: "#8b5cf6",
  PRODUCT_CREATE: "#3b82f6",
  PRODUCT_UPDATE: "#8b5cf6",
  PRODUCT_DELETE: "#ef4444",
  PROMO_CREATE: "#e6739d",
  PROMO_UPDATE: "#e6739d",
  PROMO_DELETE: "#ef4444",
  SETTINGS_UPDATE: "#6b7280",
  STAFF_ADD: "#22c55e",
  STAFF_REMOVE: "#ef4444",
  LOGIN: "#3b82f6",
  LOGOUT: "#6b7280",
};

function formatTime(ts: any): string {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 30;

export default function AuditPage() {
  const r = useRouter();
  const { tenantId, loading, email } = useTenant();
  const { role, loadingRole } = useRole();

  const canAccess = ["owner", "developer"].includes((role || "").toString().toLowerCase());

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [fetching, setFetching] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("ALL");

  async function fetchLogs(reset = false) {
    if (!tenantId) return;
    setFetching(true);

    try {
      const ref = collection(db, `tenants/${tenantId}/auditLogs`);
      let qy;

      if (reset || !lastDoc) {
        qy = query(ref, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      } else {
        qy = query(ref, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE));
      }

      const snap = await getDocs(qy);
      const arr: AuditLog[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          action: data.action || "",
          userEmail: data.userEmail || "",
          description: data.description || "",
          metadata: data.metadata || {},
          createdAt: data.createdAt,
        };
      });

      if (reset) {
        setLogs(arr);
      } else {
        setLogs((prev) => [...prev, ...arr]);
      }

      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e: any) {
      console.error("Audit fetch error:", e);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (tenantId && canAccess) {
      fetchLogs(true);
    }
  }, [tenantId, canAccess]);

  const filtered = filterAction === "ALL" ? logs : logs.filter((l) => l.action === filterAction);

  const allActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  if (loading || loadingRole) {
    return <TerraPage><SkeletonStyles /><PageSkeleton cards={3} /></TerraPage>;
  }

  if (!canAccess) {
    return (
      <TerraPage>
        <div className="card">
          <div className="h1">Akses ditolak</div>
          <div className="small">Halaman audit hanya untuk owner.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => r.push("/dashboard")}>Kembali ke Dashboard</button>
        </div>
      </TerraPage>
    );
  }

  return (
    <TerraPage>
      <style>{`
        .audit-item{
          padding:12px 0;
          border-bottom:1px solid var(--border);
          display:flex;
          gap:12px;
          align-items:flex-start;
        }
        .audit-badge{
          display:inline-block;
          padding:3px 8px;
          border-radius:6px;
          font-size:10px;
          font-weight:800;
          color:white;
          white-space:nowrap;
        }
        .audit-desc{ font-size:13px; font-weight:600; }
        .audit-meta{ font-size:11px; color:var(--muted); margin-top:2px; }
      `}</style>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Audit Log</div>
            <div className="small">Riwayat semua aktivitas di tenant ini</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => r.push("/dashboard")}>Dashboard</button>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <select
            className="input"
            style={{ width: 200 }}
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="ALL">Semua Aktivitas</option>
            {allActions.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button className="btn" onClick={() => fetchLogs(true)}>Refresh</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {fetching && logs.length === 0 ? (
          <div><SkeletonStyles /><PageSkeleton cards={2} /></div>
        ) : filtered.length === 0 ? (
          <div className="small">Belum ada log aktivitas.</div>
        ) : (
          <>
            {filtered.map((log) => (
              <div key={log.id} className="audit-item">
                <div>
                  <span
                    className="audit-badge"
                    style={{ background: ACTION_COLORS[log.action] || "#6b7280" }}
                  >
                    {log.action.replace(/_/g, " ")}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="audit-desc">{log.description}</div>
                  <div className="audit-meta">
                    {log.userEmail} &bull; {formatTime(log.createdAt)}
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="audit-meta" style={{ marginTop: 4 }}>
                      {Object.entries(log.metadata).map(([k, v]) => (
                        <span key={k} style={{ marginRight: 10 }}>{k}: <b>{String(v)}</b></span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                className="btn"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => fetchLogs(false)}
                disabled={fetching}
              >
                {fetching ? "Memuat..." : "Muat Lebih Banyak"}
              </button>
            )}
          </>
        )}
      </div>
    </TerraPage>
  );
}
