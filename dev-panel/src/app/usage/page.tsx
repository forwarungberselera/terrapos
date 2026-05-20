"use client";

import { useState } from "react";

export default function UsagePage() {
  const [reads, setReads] = useState("");
  const [writes, setWrites] = useState("");
  const [deletes, setDeletes] = useState("");

  const LIMITS = { reads: 50000, writes: 20000, deletes: 20000 };

  const pct = (val: string, limit: number) => {
    const n = parseInt(val) || 0;
    return Math.min((n / limit) * 100, 100).toFixed(1);
  };

  const getBarColor = (percent: number) => {
    if (percent >= 90) return "var(--danger)";
    if (percent >= 70) return "var(--warning)";
    return "var(--brand)";
  };

  const readsPct = parseFloat(pct(reads, LIMITS.reads));
  const writesPct = parseFloat(pct(writes, LIMITS.writes));
  const deletesPct = parseFloat(pct(deletes, LIMITS.deletes));

  return (
    <div>
      <h1 className="page-title">Firestore Usage Estimator</h1>
      <p className="page-sub">
        Manually track estimated daily Firestore usage against Spark plan limits.
        Firebase does not expose usage metrics client-side.
      </p>

      <div className="card">
        <div className="card-title">Daily Limits (Spark Plan)</div>
        <div className="card-sub">Quota resets at midnight Pacific Time (~14:00 WIB).</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Reads</div>
            <div className="stat-value">50,000</div>
            <div className="stat-note">per day</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Writes</div>
            <div className="stat-value">20,000</div>
            <div className="stat-note">per day</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Deletes</div>
            <div className="stat-value">20,000</div>
            <div className="stat-note">per day</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Estimate Your Usage</div>
        <div className="card-sub">Enter estimated daily operations to see quota percentage.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>
              Estimated Reads Today
            </label>
            <input
              className="input"
              type="number"
              placeholder="e.g. 5000"
              value={reads}
              onChange={(e) => setReads(e.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <div style={{
                height: 8,
                borderRadius: 4,
                background: "var(--border)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${readsPct}%`,
                  height: "100%",
                  background: getBarColor(readsPct),
                  borderRadius: 4,
                  transition: "width 0.3s",
                }} />
              </div>
              <span className="small">{pct(reads, LIMITS.reads)}% of 50K limit ({parseInt(reads) || 0} reads)</span>
            </div>
          </div>

          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>
              Estimated Writes Today
            </label>
            <input
              className="input"
              type="number"
              placeholder="e.g. 2000"
              value={writes}
              onChange={(e) => setWrites(e.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <div style={{
                height: 8,
                borderRadius: 4,
                background: "var(--border)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${writesPct}%`,
                  height: "100%",
                  background: getBarColor(writesPct),
                  borderRadius: 4,
                  transition: "width 0.3s",
                }} />
              </div>
              <span className="small">{pct(writes, LIMITS.writes)}% of 20K limit ({parseInt(writes) || 0} writes)</span>
            </div>
          </div>

          <div>
            <label className="small" style={{ display: "block", marginBottom: 4 }}>
              Estimated Deletes Today
            </label>
            <input
              className="input"
              type="number"
              placeholder="e.g. 500"
              value={deletes}
              onChange={(e) => setDeletes(e.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <div style={{
                height: 8,
                borderRadius: 4,
                background: "var(--border)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${deletesPct}%`,
                  height: "100%",
                  background: getBarColor(deletesPct),
                  borderRadius: 4,
                  transition: "width 0.3s",
                }} />
              </div>
              <span className="small">{pct(deletes, LIMITS.deletes)}% of 20K limit ({parseInt(deletes) || 0} deletes)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Tips</div>
        <div className="card-sub">Keep usage low on Spark plan.</div>
        <ul style={{ paddingLeft: 18, fontSize: 13, color: "var(--muted)", lineHeight: 2 }}>
          <li>Each <code>onSnapshot</code> listener counts as 1 read per doc returned.</li>
          <li>Avoid large collection reads — use pagination or limit queries.</li>
          <li>Batch writes count individually (10 docs in a batch = 10 writes).</li>
          <li>Use <code>getCountFromServer</code> for counts instead of reading all docs.</li>
          <li>Monitor the Firebase console for real usage stats.</li>
        </ul>
      </div>
    </div>
  );
}
