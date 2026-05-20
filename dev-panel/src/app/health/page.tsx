"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";


interface BuildInfo {
  marker: string;
  updatedAt: string;
}

interface ForceReload {
  triggeredAt: string;
  triggeredBy: string;
}

export default function HealthPage() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [forceReload, setForceReload] = useState<ForceReload | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    const unsubBuild = onSnapshot(doc(db, "system", "buildInfo"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBuildInfo({
          marker: data.marker || "—",
          updatedAt: data.updatedAt
            ? new Date(
                data.updatedAt.seconds
                  ? data.updatedAt.seconds * 1000
                  : data.updatedAt
              ).toLocaleString("id-ID")
            : "—",
        });
      }
      setLoading(false);
    });

    const unsubReload = onSnapshot(doc(db, "system", "forceReload"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setForceReload({
          triggeredAt: data.triggeredAt
            ? new Date(
                data.triggeredAt.seconds
                  ? data.triggeredAt.seconds * 1000
                  : data.triggeredAt
              ).toLocaleString("id-ID")
            : "—",
          triggeredBy: data.triggeredBy || "—",
        });
      }
    });

    return () => {
      unsubBuild();
      unsubReload();
    };
  }, []);


  const triggerForceReload = async () => {
    if (!confirm("Trigger a force reload for all clients?")) return;
    setTriggering(true);
    try {
      await setDoc(doc(db, "system", "forceReload"), {
        triggeredAt: serverTimestamp(),
        triggeredBy: "dev-panel",
      });
    } catch (e) {
      console.error("Failed to trigger force reload:", e);
      alert("Failed to trigger. Check console.");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">System Health</h1>
      <p className="page-sub">
        Build info, force reload trigger, and basic system status.
      </p>

      {loading ? (
        <p className="small">Loading system health...</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Build Marker</div>
              <div className="stat-value" style={{ fontSize: 14 }}>
                {buildInfo?.marker || "—"}
              </div>
              <div className="stat-note">system/buildInfo</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Build Updated</div>
              <div className="stat-value" style={{ fontSize: 14 }}>
                {buildInfo?.updatedAt || "—"}
              </div>
              <div className="stat-note">Last deploy timestamp</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Last Force Reload</div>
              <div className="stat-value" style={{ fontSize: 14 }}>
                {forceReload?.triggeredAt || "Never"}
              </div>
              <div className="stat-note">
                by {forceReload?.triggeredBy || "—"}
              </div>
            </div>
          </div>


          <div className="card">
            <div className="card-title">Force Reload</div>
            <div className="card-sub">
              Trigger all connected clients to reload. Writes to
              system/forceReload.
            </div>
            <button
              className="btn btn-danger"
              onClick={triggerForceReload}
              disabled={triggering}
            >
              {triggering ? "Triggering..." : "Trigger Force Reload"}
            </button>
          </div>

          <div className="card">
            <div className="card-title">System Information</div>
            <div className="card-sub">
              Basic environment info from the dev panel.
            </div>
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <th>Platform</th>
                    <td>Next.js (dev-panel)</td>
                  </tr>
                  <tr>
                    <th>Base Path</th>
                    <td className="mono">/dev-panel</td>
                  </tr>
                  <tr>
                    <th>Build Marker</th>
                    <td className="mono">{buildInfo?.marker || "—"}</td>
                  </tr>
                  <tr>
                    <th>Last Deploy</th>
                    <td>{buildInfo?.updatedAt || "—"}</td>
                  </tr>
                  <tr>
                    <th>Client Time</th>
                    <td>{new Date().toLocaleString("id-ID")}</td>
                  </tr>
                  <tr>
                    <th>Firestore Project</th>
                    <td className="mono">terrapos-app</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
