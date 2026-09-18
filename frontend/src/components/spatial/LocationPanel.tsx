"use client";

import { useState } from "react";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { buildWhyHereExplanation } from "@/lib/whyHere";
import type { BottleneckEntry, Driver, RiskResult } from "@/lib/api";
import styles from "./LocationPanel.module.css";

type Selection =
  | { kind: "district"; districtId: string; name: string }
  | { kind: "mandal"; mandalId: string; name: string; districtId: string; districtName: string };

type TabId = "overview" | "drivers" | "food" | "evidence";
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "drivers", label: "Drivers" },
  { id: "food", label: "Food System" },
  { id: "evidence", label: "Evidence" },
];

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
  const [tab, setTab] = useState<TabId>("overview");
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

      {risk ? (
        <div className={styles.headlineRow}>
          <RiskBadge riskClass={risk.risk_class} />
          <div className={styles.headlineMetric}>
            <span className={styles.headlineValue}>{risk.risk_score !== null ? risk.risk_score.toFixed(2) : "n/a"}</span>
            <span className={styles.headlineLabel}>Risk Score</span>
          </div>
          <div className={styles.headlineMetric}>
            <span className={styles.headlineValue}>{risk.confidence}</span>
            <span className={styles.headlineLabel}>Confidence</span>
          </div>
          <div className={styles.headlineMetric}>
            <StatusBadge status={risk.truth_status} compact />
            <span className={styles.headlineLabel}>Truth Status</span>
          </div>
        </div>
      ) : null}

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
          <div className={styles.tabBar} role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <>
              <Section title="Resilience">
                <p className={styles.bridgeNote}>
                  Resilience score and resilience gap are scenario outputs, computed alongside a modeled shock — open{" "}
                  <span className={styles.bridgeAccent}>Intervention Lab</span> or{" "}
                  <span className={styles.bridgeAccent}>Digital Twin</span> to compute them for this geography.
                </p>
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
            </>
          ) : null}

          {tab === "drivers" ? (
            <Section title="Spatial Drivers">
              <DriverBars risk={risk} />
            </Section>
          ) : null}

          {tab === "food" ? (
            <>
              <Section title="Food Categories Affected">
                <span className="secondary">{risk.food_scope.replace(/_/g, " ")}</span>
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
            </>
          ) : null}

          {tab === "evidence" ? (
            <>
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
          ) : null}
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
  rainfall_deficit: "Rainfall Anomaly",
  heat_stress: "Heat Stress",
  heat_stress_t2m_max_context: "Heat Stress (Context, Excluded)",
};

function DriverIcon({ feature }: { feature: string }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (feature.startsWith("rainfall")) {
    return (
      <svg {...common}>
        <path d="M7 15a5 5 0 0 1 1-9.9A6 6 0 0 1 19 9a4.5 4.5 0 0 1-1 8.9H7z" />
        <path d="M9 19v2M13 19v2M17 17v2" />
      </svg>
    );
  }
  if (feature.startsWith("heat")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  );
}

// contribution_to_score values sum to risk_score for used_in_score drivers,
// so this percentage is a real, deterministic share of the actual score --
// not an invented weighting.
function DriverBars({ risk }: { risk: RiskResult }) {
  const used = [...risk.major_drivers]
    .filter((d): d is Driver & { contribution_to_score: number } => d.used_in_score && d.contribution_to_score !== null)
    .sort((a, b) => b.contribution_to_score - a.contribution_to_score);
  const excluded = risk.major_drivers.filter((d) => !d.used_in_score);

  if (used.length === 0) {
    return <span className="muted">No driver data available.</span>;
  }

  return (
    <div className={styles.driverBars}>
      {used.map((d) => {
        const share = risk.risk_score ? Math.max(0, Math.min(100, (d.contribution_to_score / risk.risk_score) * 100)) : 0;
        return (
          <div key={d.feature} className={styles.driverRow}>
            <span className={styles.driverIcon}>
              <DriverIcon feature={d.feature} />
            </span>
            <div className={styles.driverBody}>
              <div className={styles.driverHeadline}>
                <span className={styles.driverName}>{DRIVER_LABELS[d.feature] ?? d.feature.replace(/_/g, " ")}</span>
                <span className={styles.driverPct}>{share.toFixed(0)}%</span>
              </div>
              <div className={styles.driverTrack}>
                <div className={styles.driverFill} style={{ width: `${share}%` }} />
              </div>
              <div className={styles.driverMeta}>
                {d.anomaly_pct !== null ? `${d.anomaly_pct >= 0 ? "+" : ""}${d.anomaly_pct.toFixed(1)}% vs. normal` : "anomaly n/a"} ·
                contributes {d.contribution_to_score.toFixed(3)} of risk score
              </div>
            </div>
          </div>
        );
      })}
      {excluded.length > 0 ? (
        <div className={styles.driverExcludedNote}>
          {excluded.length} additional factor{excluded.length > 1 ? "s" : ""} reported for context only, excluded
          from the score — see Evidence tab.
        </div>
      ) : null}
    </div>
  );
}

export type { Selection };
