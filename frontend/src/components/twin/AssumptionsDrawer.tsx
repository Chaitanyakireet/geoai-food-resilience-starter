"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { getTwinConfig, getTwinProvenance, type TwinResult } from "@/lib/api";
import styles from "./AssumptionsDrawer.module.css";

// /twin/provenance is "assumption disclosure" style ({nature,
// assumption_disclosure, upstream_provenance_endpoints}), not the
// dataset-registry shape gis/risk/graph use -- read loosely.
type TwinProvenance = { nature?: string; assumption_disclosure?: string[]; upstream_provenance_endpoints?: string[] };

export function AssumptionsDrawer({ open, onClose, result }: { open: boolean; onClose: () => void; result: TwinResult | null }) {
  const [provenance, setProvenance] = useState<TwinProvenance | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const loading = open && provenance === null;

  useEffect(() => {
    if (!open || provenance !== null) return;
    let cancelled = false;
    Promise.all([getTwinProvenance(), getTwinConfig()]).then(([prov, cfg]) => {
      if (cancelled) return;
      setProvenance((prov as TwinProvenance) ?? {});
      setConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, [open, provenance]);

  if (!open) return null;

  const recoveryModel = config?.recovery_model as Record<string, number> | undefined;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Assumptions &amp; provenance</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Truth-Status Framework</div>
          <div className={styles.badgeRow}>
            <StatusBadge status="OBSERVED" compact />
            <StatusBadge status="DERIVED" compact />
            <StatusBadge status="ESTIMATED" compact />
            <StatusBadge status="COUNTERFACTUAL" compact />
            <StatusBadge status="SIMULATED" compact />
          </div>
          <p className={styles.note}>
            The Digital Twin is a deterministic scenario/decision-support simulation — not a live operational
            twin. Scenario states are SIMULATED; a climate-adjusted risk recompute (if heat/rainfall fields are
            set) is COUNTERFACTUAL. Recovery trajectories are SIMULATED and not a validated real-world forecast.
          </p>
        </div>

        {recoveryModel ? (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Recovery Model Assumptions</div>
            <div className={styles.configGrid}>
              <ConfigRow label="Recovery rate (assumed daily closure)" value={`${(recoveryModel.recovery_rate * 100).toFixed(1)}%`} />
              <ConfigRow label="Timestep" value={`${recoveryModel.timestep_days} days`} />
              <ConfigRow label="Default horizon" value={`${recoveryModel.default_horizon_days} days`} />
              <ConfigRow label="Recovery threshold" value={`${(recoveryModel.recovery_threshold * 100).toFixed(1)}%`} />
            </div>
            <p className={styles.note}>
              recovery_rate is an ESTIMATED illustrative default (config/twin.yaml), not fit to any observed
              Telangana recovery event — no such historical dataset exists this sprint.
            </p>
          </div>
        ) : null}

        {result ? (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>This run&apos;s limitations ({result.limitations.length})</div>
            <ul className={styles.list}>
              {result.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {loading ? <p className="secondary">Loading provenance…</p> : null}

        {provenance?.assumption_disclosure && provenance.assumption_disclosure.length > 0 ? (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Assumption disclosure</div>
            {provenance.nature ? <p className={styles.note}>{provenance.nature}</p> : null}
            <ul className={styles.list}>
              {provenance.assumption_disclosure.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {provenance.upstream_provenance_endpoints && provenance.upstream_provenance_endpoints.length > 0 ? (
              <p className={styles.note}>Upstream provenance: {provenance.upstream_provenance_endpoints.join(", ")}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.configRow}>
      <span className="muted">{label}</span>
      <span className={styles.configValue}>{value}</span>
    </div>
  );
}
