"use client";

import { useState } from "react";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { DriverBars } from "@/components/DriverBars";
import { buildWhyHereExplanation } from "@/lib/whyHere";
import type { BottleneckEntry, RiskResult } from "@/lib/api";
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
          <div className={styles.headlineMetric}>
            <span className={styles.headlineValue}>{inherited ? "District-scale" : "Native"}</span>
            <span className={styles.headlineLabel}>Risk Resolution</span>
          </div>
        </div>
      ) : null}

      {inherited ? (
        <div className={styles.notice}>
          <div className={styles.resolutionRow}>
            <span className={styles.resolutionLabel}>Risk Resolution</span>
            <span>District-scale estimate</span>
          </div>
          <div className={styles.resolutionRow}>
            <span className={styles.resolutionLabel}>Resolved Via</span>
            <span>Parent district ({selection.kind === "mandal" ? selection.districtName : ""})</span>
          </div>
          <p className={styles.resolutionNote}>
            The risk engine is district-centroid based — this mandal has no independently computed risk and inherits
            its parent district&apos;s result rather than implying mandal-level precision that doesn&apos;t exist.
          </p>
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

export type { Selection };
