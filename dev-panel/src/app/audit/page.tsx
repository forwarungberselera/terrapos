"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

interface Tenant {
  id: string;
  name: string;
}

interface AuditEntry {
  id: string;
  action: string;
  user: string;
  description: string;
  timestamp: string;
}

export default function AuditPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "tenants"));
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setTenants(list);
        if (list.length > 0) setSelectedTenant(list[0].id);
      } catch (e) {
        console.error("Failed to load tenants:", e);
      } finally {
        setLoadingTenants(false);
      }
    })();
  }, []);

  const loadAuditLogs = async (tenantId: string) => {
    if (!tenantId) return;
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, "tenants", tenantId, "auditLogs"),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      const entries: AuditEntry[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          action: data.action || "—",
          user: data.user || data.uid || "—",
          description: data.description || data.details || "—",
          timestamp: data.timestamp
            ? new Date(data.timestamp.seconds ? data.timestamp.seconds * 1000 : data.timestamp).toLocaleString("id-ID")
            : "—",
        };
      });
      setLogs(entries);
    } catch (e) {
      console.error("Failed to load audit logs:", e);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (selectedTenant) {
      loadAuditLogs(selectedTenant);
    }
  }, [selectedTenant]);

  return (
    <div>
      <h1 className="page-title">Audit Log Viewer</h1>
      <p className="page-sub">View audit trail entries for any tenant.</p>

      <div className="card">
        <div className="card-title">Select Tenant</div>
        <div className="card-sub">Choose a tenant to view their audit logs.</div>

        {loadingTenants ? (
          <p className="small">Loading tenants...</p>
        ) : (
          <div className="row">
            <select
              className="input"
              style={{ maxWidth: 300 }}
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id})
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => loadAuditLogs(selectedTenant)}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Audit Logs</div>
        <div className="card-sub">
          {logs.length} entries loaded {selectedTenant && `for tenant: ${selectedTenant}`}
        </div>

        {loadingLogs ? (
          <p className="small">Loading audit logs...</p>
        ) : logs.length === 0 ? (
          <p className="small">No audit logs found for this tenant.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="small">{entry.timestamp}</td>
                    <td>
                      <span className="badge">{entry.action}</span>
                    </td>
                    <td className="mono small">{entry.user}</td>
                    <td className="small">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
