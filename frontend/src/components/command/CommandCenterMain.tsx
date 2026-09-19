"use client";

import { useState } from "react";
import Link from "next/link";
import { MiniRiskMap } from "@/components/MiniRiskMap";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { DriverBars } from "@/components/DriverBars";
import { RiskSummaryDonut, type DonutSegment } from "@/components/RiskSummaryDonut";
import { ProvenanceDrawer } from "@/components/spatial/ProvenanceDrawer";
import type { BottleneckEntry, DistrictsFeatureCollection, GraphOverviewResponse, RiskResult, RiskStateResponse } from "@/lib/api";
import styles from "./CommandCenterMain.module.css";

const FLOW_STEPS: { href: string; label: string; caption: string }[] = [
  { href: "/spatial", label: "Spatial Intelligence", caption: "Diagnose where and why climate-stress risk concentrates." },
  { href: "/network", label: "Food Network", caption: "Trace production-to-demand dependencies and structural bottlenecks." },
  { href: "/interventions", label: "Intervention Lab", caption: "Compose a shock, then build and optimize a response portfolio." },
  { href: "/twin", label: "Digital Twin", caption: "Simulate recovery with and without the intervention portfolio." },
  { href: "/ai-brief", label: "AI Decision Brief", caption: "Get a grounded, evidence-linked explanation of the scenario." },
];

export function CommandCenterMain({
  districts,
  riskState,
  graphOverview,
}: {
  districts: DistrictsFeatureCollection;
  riskState: RiskStateResponse | null;
  graphOverview: GraphOverviewResponse | null;
}) {
  const riskByDistrict = new Map<string, RiskResult>();
  riskState?.districts.forEach((d) => riskByDistrict.set(d.region_id, d));

  const topHotspots = [...(riskState?.districts ?? [])]
    .filter((d): d is RiskResult & { risk_score: number } => d.risk_score !== null)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  const [selectedId, setSelectedId] = useState<string | null>(topHotspots[0]?.region_id ?? null);
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  const selectedRisk = selectedId ? (riskByDistrict.get(selectedId) ?? null) : null;
  const selectedBottlenecks: BottleneckEntry[] = selectedId ? (graphOverview?.bottlenecks.filter((b) => b.geo_id === selectedId) ?? []) : [];

  const riskCounts: Record<string, number> = { low: 0, moderate: 0, high: 0, severe: 0, insufficient_data: 0 };
  riskState?.districts.forEach((d) => {
    riskCounts[d.risk_class] = (riskCounts[d.risk_class] ?? 0) + 1;
  });
  const donutSegments: DonutSegment[] = [
    { key: "severe", label: "Severe", count: riskCounts.severe, colorVar: "var(--status-critical)" },
    { key: "high", label: "High", count: riskCounts.high, colorVar: "var(--status-serious)" },
    { key: "moderate", label: "Moderate", count: riskCounts.moderate, colorVar: "var(--status-warning)" },
    { key: "low", label: "Low", count: riskCounts.low, colorVar: "var(--status-good)" },
    { key: "insufficient_data", label: "Insufficient Data", count: riskCounts.insufficient_data, colorVar: "var(--status-neutral)" },
  ];

  const sampleRisk = riskState?.districts[0];

  return (
    <div className={styles.page}>
      <div className={styles.heroGrid}>
        <MiniRiskMap
          districts={districts}
          riskByDistrict={riskByDistrict}
          highlightDistrictId={selectedId ?? undefined}
          onSelectDistrict={setSelectedId}
          title="Statewide Risk Preview"
          subtitle="Click a district for its current situation below, or open the full GIS workspace."
          height={480}
        />

        <div className={`${styles.situationCard} card`}>
          <div className={styles.situationTitle}>Current Situation</div>

          {!riskState ? (
            <p className="secondary" style={{ fontSize: 12.5 }}>Risk service unavailable — no situation data to show.</p>
          ) : selectedRisk ? (
            <>
              <div className={styles.situationHeader}>
                <span className={styles.situationName}>{selectedRisk.region_id.replace(/_/g, " ")}</span>
                <RiskBadge riskClass={selectedRisk.risk_class} />
              </div>

              <div className={styles.situationMetrics}>
                <div className={styles.situationMetric}>
                  <span className={styles.situationMetricValue}>{selectedRisk.risk_score?.toFixed(2) ?? "n/a"}</span>
                  <span className={styles.situationMetricLabel}>Risk Score</span>
                </div>
                <div className={styles.situationMetric}>
                  <span className={styles.situationMetricValue}>{selectedRisk.confidence}</span>
                  <span className={styles.situationMetricLabel}>Confidence</span>
                </div>
                <div className={styles.situationMetric}>
                  <StatusBadge status={selectedRisk.truth_status} compact />
                  <span className={styles.situationMetricLabel}>Truth Status</span>
                </div>
              </div>

              <div className={styles.situationSectionTitle}>Key Drivers</div>
              <DriverBars risk={selectedRisk} compact allDistrictRisks={riskState?.districts ?? []} />

              <div className={styles.situationSectionTitle}>Network Dependency</div>
              <p className={styles.situationNote}>
                {selectedBottlenecks.length > 0
                  ? `${selectedBottlenecks.length} graph-theoretic bottleneck node${selectedBottlenecks.length > 1 ? "s" : ""} in this district — structural, not a confirmed operational failure.`
                  : "No flagged structural bottleneck nodes in this district."}
              </p>

              <div className={styles.situationSectionTitle}>Vegetation & Water Stress</div>
              {(() => {
                const vegetation = selectedRisk.major_drivers.find((d) => d.feature === "vegetation_condition");
                if (!vegetation) {
                  return (
                    <p className={styles.situationNote}>
                      Vegetation: no quality-passing satellite composite available for this district. Water stress: no
                      dataset ingested this sprint.
                    </p>
                  );
                }
                return (
                  <p className={styles.situationNote}>
                    NDVI {vegetation.observed_value?.toFixed(3)} vs. seasonal norm {vegetation.baseline_value?.toFixed(3)}
                    {vegetation.anomaly_pct !== null
                      ? ` (${vegetation.anomaly_pct >= 0 ? "+" : ""}${vegetation.anomaly_pct.toFixed(1)}% ${vegetation.anomaly_pct >= 0 ? "above" : "below"} normal)`
                      : ""}{" "}
                    — context only, not used in risk score. Water stress: no dataset ingested this sprint.
                  </p>
                );
              })()}

              <Link href="/spatial" className={styles.situationLink}>
                Open full analysis in Spatial Intelligence →
              </Link>
            </>
          ) : (
            <p className="secondary" style={{ fontSize: 12.5 }}>Select a district on the map or a hotspot below.</p>
          )}
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={`${styles.bottomCard} card`}>
          <div className={styles.bottomCardTitle}>State Risk Summary</div>
          <div className={styles.donutRow}>
            <RiskSummaryDonut
              segments={donutSegments}
              centerValue={riskState?.mean_risk_score != null ? riskState.mean_risk_score.toFixed(2) : "—"}
              centerLabel="Mean Risk"
            />
            <ul className={styles.donutLegend}>
              {donutSegments.map((s) => (
                <li key={s.key}>
                  <span className={styles.donutLegendDot} style={{ background: s.colorVar }} />
                  <span className={styles.donutLegendCount}>{s.count}</span>
                  <span className={styles.donutLegendLabel}>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className={styles.bottomCardFootnote}>
            Distribution of modeled climate-stress risk classes — not a measured food-insecurity level.
          </p>
        </div>

        <div className={`${styles.bottomCard} card`}>
          <div className={styles.bottomCardTitle}>Top Risk Districts</div>
          {topHotspots.length > 0 ? (
            <ol className={styles.rankList}>
              {topHotspots.map((d, i) => (
                <li key={d.region_id}>
                  <button type="button" className={styles.rankButton} onClick={() => setSelectedId(d.region_id)}>
                    <span className={styles.rankNumber}>{i + 1}</span>
                    <span className={styles.rankName}>{d.region_id.replace(/_/g, " ")}</span>
                    <RiskBadge riskClass={d.risk_class} />
                    <span className={styles.rankScore}>{d.risk_score?.toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="secondary">No scored districts available.</p>
          )}
        </div>

        <div className={`${styles.bottomCard} card`}>
          <div className={styles.bottomCardTitle}>Network State</div>
          {graphOverview ? (
            <ul className={styles.factList}>
              <li>
                <span className="muted">Nodes / edges</span>
                <span className={styles.factValue}>
                  {graphOverview.summary.node_count} / {graphOverview.summary.edge_count}
                </span>
              </li>
              <li>
                <span className="muted">Bottlenecks</span>
                <span className={styles.factValue}>{graphOverview.bottlenecks.length}</span>
              </li>
              <li>
                <span className="muted">Connectivity</span>
                <span className={styles.factValue}>
                  {graphOverview.summary.connectivity.is_weakly_connected
                    ? "Connected"
                    : `${graphOverview.summary.connectivity.weakly_connected_component_count} components`}
                </span>
              </li>
              <li>
                <span className="muted">Isolated nodes</span>
                <span className={styles.factValue}>{graphOverview.summary.connectivity.isolated_node_count}</span>
              </li>
            </ul>
          ) : (
            <p className="secondary">Graph service unavailable.</p>
          )}
          <Link href="/network" className={styles.situationLink}>
            Open Food-System Network →
          </Link>
        </div>

        <div className={`${styles.bottomCard} card`}>
          <div className={styles.bottomCardTitle}>Data & Provenance</div>
          <ul className={styles.factList}>
            <li>
              <span className="muted">Climate data</span>
              <span className={styles.factValue}>NASA POWER</span>
            </li>
            <li>
              <span className="muted">Boundaries</span>
              <span className={styles.factValue}>OpenStreetMap</span>
            </li>
            <li>
              <span className="muted">Analysis window</span>
              <span className={styles.factValue}>
                {sampleRisk ? `${sampleRisk.data_coverage.available_days}/${sampleRisk.data_coverage.requested_days} days` : "n/a"}
              </span>
            </li>
            <li>
              <span className="muted">Risk method</span>
              <span className={styles.factValue}>{riskState?.method ?? "n/a"}</span>
            </li>
          </ul>
          <button type="button" className={styles.situationLinkBtn} onClick={() => setProvenanceOpen(true)}>
            View Full Evidence & Provenance →
          </button>
        </div>
      </div>

      <div className={`${styles.flowCard} card`}>
        <div className={styles.bottomCardTitle}>Scenario Readiness</div>
        <p className={styles.bottomCardFootnote} style={{ marginBottom: 14 }}>
          Every workspace below reads and writes the same scenario context — a finding in one carries forward into the
          next without re-entry.
        </p>
        <div className={styles.flowRow}>
          {FLOW_STEPS.map((step, i) => (
            <div key={step.href} className={styles.flowStepWrap}>
              <Link href={step.href} className={styles.flowStep}>
                <span className={styles.flowStepNumber}>{i + 1}</span>
                <span className={styles.flowStepLabel}>{step.label}</span>
                <span className={styles.flowStepCaption}>{step.caption}</span>
              </Link>
              {i < FLOW_STEPS.length - 1 ? <span className={styles.flowArrow}>→</span> : null}
            </div>
          ))}
        </div>
      </div>

      <ProvenanceDrawer open={provenanceOpen} onClose={() => setProvenanceOpen(false)} />
    </div>
  );
}
