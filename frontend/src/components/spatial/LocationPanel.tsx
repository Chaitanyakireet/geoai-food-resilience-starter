"use client";

import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { buildWhyHereExplanation } from "@/lib/whyHere";
import type { BottleneckEntry, RiskResult } from "@/lib/api";
import styles from "./LocationPanel.module.css";

type Selection =
  | { kind: "district"; districtId: string; name: string }
  | { kind: "mandal"; mandalId: string; name: string; districtId: string; districtName: string };

export function LocationPanel({
  selection,
  risk,
  riskLoading,
  bottlenecks,
  onClose,
  onOpenProvenance,
}: {
  selection: Selection;
  risk: RiskResult | null | undefined; // undefined = loading, null = unavailable
  riskLoading: boolean;
  bottlenecks: BottleneckEntry[] | null;
  onClose: () => void;
  onOpenProvenance: () => void;
}) {
  const localBottlenecks = bottlenecks?.filter((b) => b.geo_id === selection.districtId) ?? null;

  const inherited = risk?.resolved_via?.startsWith("inherited_from_parent_district") ?? false;
  const explanation = risk ? buildWhyHereExplanation(risk) : null;

  return (
    <aside className={`${styles.panel} card`}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{selection.kind === "district" ? "District" : "Mandal"}</div>
          <h2 className={styles.title}>{selection.name}</h2>
          {selection.kind === "mandal" ? <div className={styles.subtitle}>{selection.districtName} district</div> : null}
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      {inherited ? (
        <div className={styles.notice}>
          The risk engine is district-centroid based. This mandal has no independently computed risk — it
          inherits its parent district&apos;s ({selection.kind === "mandal" ? selection.districtName : ""}) result.
        </div>
      ) : null}

      {riskLoading ? (
        <div className={styles.loading}>Loading risk data…</div>
      ) : risk ? (
        <>
          <Section title="Modeled Risk">
            <div className={styles.riskRow}>
              <RiskBadge riskClass={risk.risk_class} />
              <span className={styles.riskScore}>
                {risk.risk_score !== null ? risk.risk_score.toFixed(2) : "n/a"}
              </span>
            </div>
          </Section>

          <Section title="Confidence">
            <span className="secondary">{risk.confidence}</span>
            {risk.uncertainty_interval ? (
              <span className="muted" style={{ marginLeft: 8, fontSize: 11.5 }}>
                interval [{risk.uncertainty_interval[0].toFixed(2)}, {risk.uncertainty_interval[1].toFixed(2)}]
              </span>
            ) : null}
          </Section>

          <Section title="Data Coverage">
            <span className="secondary">
              {risk.data_coverage.available_days}/{risk.data_coverage.requested_days} days (
              {Math.round(risk.data_coverage.coverage_ratio * 100)}%) · {risk.data_coverage.spatial_resolution}
            </span>
          </Section>

          <Section title="Truth Status">
            <StatusBadge status={risk.truth_status} />
            {inherited ? <span className={styles.inlineNote}>resolved via: {risk.resolved_via}</span> : null}
          </Section>

          <Section title="Food Categories Affected">
            <span className="secondary">{risk.food_scope.replace(/_/g, " ")}</span>
          </Section>

          <Section title="Risk-Driver Decomposition">
            <DriverTable risk={risk} />
          </Section>

          <Section title="Network Dependency">
            {localBottlenecks === null ? (
              <span className="muted">Network data unavailable.</span>
            ) : localBottlenecks.length > 0 ? (
              <ul className={styles.bottleneckList}>
                {localBottlenecks.map((b) => (
                  <li key={b.node_id}>
                    {b.node_id} ({b.node_type}) — betweenness {b.betweenness_centrality.toFixed(3)}
                    {b.is_articulation_point ? ", articulation point" : ""}
                  </li>
                ))}
                <li className="muted" style={{ fontSize: 11 }}>
                  Structural graph properties, not confirmed real-world dependency. District-level granularity
                  only — not independently modeled per mandal.
                </li>
              </ul>
            ) : (
              <span className="muted">No flagged structural bottleneck nodes in this district.</span>
            )}
          </Section>

          <Section title="Vegetation & Water Stress">
            <span className="muted">
              Data unavailable — no remote-sensing NDVI or water-stress dataset was ingested this sprint.
            </span>
          </Section>

          {explanation ? (
            <Section title="Location Intelligence">
              <ul className={styles.whyList}>
                {explanation.used.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              {explanation.excluded.length > 0 ? (
                <ul className={styles.whyExcluded}>
                  {explanation.excluded.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </Section>
          ) : null}

          <Section title="Evidence & Provenance">
            <ul className={styles.sourceList}>
              {risk.provenance_refs.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
            <button type="button" className={styles.provenanceBtn} onClick={onOpenProvenance}>
              Open full provenance record →
            </button>
          </Section>
        </>
      ) : (
        <div className={styles.notice}>Risk data unavailable for this geography.</div>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

const DRIVER_LABELS: Record<string, string> = {
  rainfall_deficit: "Rainfall anomaly",
  heat_stress: "Heat stress",
  heat_stress_t2m_max_context: "Heat stress (context, excluded)",
};

function DriverTable({ risk }: { risk: RiskResult }) {
  if (risk.major_drivers.length === 0) {
    return <span className="muted">No driver data available.</span>;
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Driver</th>
          <th>Anomaly</th>
          <th>Contribution</th>
        </tr>
      </thead>
      <tbody>
        {risk.major_drivers.map((d) => (
          <tr key={d.feature}>
            <td>{DRIVER_LABELS[d.feature] ?? d.feature.replace(/_/g, " ")}</td>
            <td className="secondary">{d.anomaly_pct !== null ? `${d.anomaly_pct.toFixed(1)}%` : "n/a"}</td>
            <td className="secondary">
              {d.used_in_score ? (d.contribution_to_score?.toFixed(3) ?? "n/a") : "not used"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type { Selection };
