"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

interface MaintenanceState {
  enabled: boolean;
  message: string;
  enabledAt: string;
  enabledBy: string;
}

export default function MaintenancePage() {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "maintenance"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setState({
          enabled: data.enabled || false,
          message: data.message || "",
          enabledAt: data.enabledAt
            ? new Date(data.enabledAt.seconds ? data.enabledAt.seconds * 1000 : data.enabledAt).toLocaleString("id-ID")
            : "—",
          enabledBy: data.enabledBy || "—",
        });
        setMessage(data.message || "");
      } else {
        setState({ enabled: false, message: "", enabledAt: "—", enabledBy: "—" });
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const toggleMaintenance = async () => {
    if (!state) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "system", "maintenance"), {
        enabled: !state.enabled,
        message: message,
        enabledAt: serverTimestamp(),
        enabledBy: "dev-panel",
      });
    } catch (e) {
      console.error("Failed to toggle maintenance:", e);
      alert("Failed to update maintenance mode.");
    } finally {
      setSaving(false);
    }
  };

  const updateMessage = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "system", "maintenance"),
        { message },
        { merge: true }
      );
    } catch (e) {
      console.error("Failed to update message:", e);
      alert("Failed to update message.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Maintenance Control</h1>
      <p className="page-sub">Toggle maintenance mode for the entire TerraPOS system.</p>

      {loading ? (
        <p className="small">Loading maintenance status...</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Status</div>
              <div className="stat-value">
                {state?.enabled ? (
                  <span style={{ color: "var(--danger)" }}>● MAINTENANCE ON</span>
                ) : (
                  <span style={{ color: "var(--success)" }}>● SYSTEM ONLINE</span>
                )}
              </div>
              <div className="stat-note">
                {state?.enabled ? "Users see maintenance page" : "Normal operation"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Last Changed</div>
              <div className="stat-value" style={{ fontSize: 14 }}>
                {state?.enabledAt}
              </div>
              <div className="stat-note">by {state?.enabledBy}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Toggle Maintenance</div>
            <div className="card-sub">
              {state?.enabled
                ? "System is in maintenance mode. Click to bring it back online."
                : "System is online. Click to enable maintenance mode."}
            </div>
            <button
              className={`btn ${state?.enabled ? "btn-primary" : "btn-danger"}`}
              onClick={toggleMaintenance}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : state?.enabled
                ? "Disable Maintenance (Go Online)"
                : "Enable Maintenance Mode"}
            </button>
          </div>

          <div className="card">
            <div className="card-title">Maintenance Message</div>
            <div className="card-sub">
              This message is shown to users during maintenance.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. Sistem sedang dalam maintenance. Silakan coba lagi nanti."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ resize: "vertical" }}
              />
              <div>
                <button
                  className="btn btn-primary"
                  onClick={updateMessage}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Update Message"}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Current Document</div>
            <div className="card-sub">Raw data from system/maintenance (realtime).</div>
            <pre className="mono small" style={{ background: "var(--input-bg)", padding: 12, borderRadius: 8, overflow: "auto" }}>
              {JSON.stringify(state, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
