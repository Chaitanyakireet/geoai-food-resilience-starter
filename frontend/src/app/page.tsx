import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { CommandCenterMain } from "@/components/command/CommandCenterMain";
import { SDG_NAMES } from "@/lib/sdg";
import { getDistricts, getGraphOverview, getHealth, getRiskState } from "@/lib/api";
import styles from "./page.module.css";

export default async function CommandCenter() {
  const [health, riskState, graphOverview, districts] = await Promise.all([
    getHealth(),
    getRiskState(),
    getGraphOverview(),
    getDistricts(),
  ]);

  if (!health) {
    return (
      <div>
        <PageHeader eyebrow="Command Center" title="Command Center" />
        <div className={`${styles.offline} card`}>
          <p className={styles.offlineTitle}>Backend unreachable</p>
          <p className="secondary">
            Start it with{" "}
            <code className={styles.code}>.venv\Scripts\python -m uvicorn backend.api.main:app --reload</code> and
            reload this page. No section below can render without it — nothing here is a fake placeholder value.
          </p>
        </div>
      </div>
    );
  }

  const scoredDistricts = riskState?.districts.filter((d) => d.risk_score !== null) ?? [];
  const meanCoverage =
    scoredDistricts.length > 0
      ? scoredDistricts.reduce((sum, d) => sum + d.data_coverage.coverage_ratio, 0) / scoredDistricts.length
      : null;

  return (
    <div>
      <PageHeader
        eyebrow="Command Center"
        title="Hyderabad–Telangana food system, at a glance"
        subtitle={`${health.project.food_scope.replace(/_/g, " ")} · primary ${health.project.primary_sdg} (${SDG_NAMES[2]}) · as of ${riskState?.districts[0]?.date ?? "—"}`}
      />

      <div className={`${styles.statusStrip} card`}>
        <StatusField label="System Status" value={health.status === "ok" ? "Operational" : health.status} dotClass={styles.dotGood} />
        <StatusField label="Backend Status" value="Connected" dotClass={styles.dotGood} />
        <StatusField label="Data Status" value={riskState ? "Risk service live" : "Risk service down"} dotClass={riskState ? styles.dotGood : styles.dotCritical} />
        <StatusField
          label="Active Analysis Window"
          value={riskState?.districts[0] ? `${riskState.districts[0].data_coverage.available_days}/${riskState.districts[0].data_coverage.requested_days} days` : "n/a"}
        />
        <StatusField label="Geographic Coverage" value={districts ? `${districts.features.length} districts` : "n/a"} />
        <StatusField label="Food Scope" value={health.project.food_scope.replace(/_/g, " ")} />
      </div>

      <div className={styles.statRow}>
        <StatTile
          label="Statewide Risk"
          value={riskState?.mean_risk_score != null ? riskState.mean_risk_score.toFixed(2) : "—"}
          helpText={
            riskState
              ? `Unweighted mean, ${riskState.district_count_scored}/${riskState.district_count} districts scored`
              : "Risk service unavailable"
          }
          tone="accent"
        />
        <StatTile
          label="Network Size"
          value={graphOverview ? `${graphOverview.summary.node_count} / ${graphOverview.summary.edge_count}` : "—"}
          helpText={graphOverview ? "Nodes / edges across all districts" : "Graph service unavailable"}
        />
        <StatTile
          label="Structural Bottlenecks"
          value={graphOverview ? String(graphOverview.bottlenecks.length) : "—"}
          helpText="Graph-theoretic candidates, not confirmed real-world importance"
        />
        <StatTile
          label="Data Coverage"
          value={meanCoverage != null ? `${Math.round(meanCoverage * 100)}%` : "—"}
          helpText={riskState ? "Mean requested-vs-available days, scored districts" : "Risk service unavailable"}
        />
      </div>

      {districts ? (
        <CommandCenterMain districts={districts} riskState={riskState} graphOverview={graphOverview} />
      ) : (
        <div className={`${styles.emptyState} card`}>
          GIS service unavailable — the Command Center needs <code>/gis/districts</code> to render its map and
          situation panel.
        </div>
      )}

      <div className={`${styles.disclosure} card`}>
        <div className={styles.panelTitle}>Core Loop</div>
        <div className={styles.loopRow}>
          {health.loop_stages.map((stage, i) => (
            <span key={stage} className={styles.loopStage}>
              {stage.replace(/_/g, " ")}
              {i < health.loop_stages.length - 1 ? <span className={styles.loopArrow}>→</span> : null}
            </span>
          ))}
        </div>

        <div className={styles.sdgRow}>
          <span className={`${styles.sdgChip} ${styles.sdgChipPrimary}`}>
            SDG 2 · {SDG_NAMES[2]} (Primary)
          </span>
          {health.project.secondary_sdgs.map((n) => (
            <span key={n} className={styles.sdgChip}>
              SDG {n} · {SDG_NAMES[n] ?? "—"}
            </span>
          ))}
        </div>

        <div className={styles.disclosureFooter}>
          <span className="muted">Backend service: {health.service}</span>
          <span className="muted">Truth-status framework: {health.truth_status_labels.join(", ")}</span>
        </div>
      </div>
    </div>
  );
}

function StatusField({ label, value, dotClass }: { label: string; value: string; dotClass?: string }) {
  return (
    <div className={styles.statusField}>
      <div className={styles.statusFieldLabel}>
        {dotClass ? <span className={`${styles.statusDot} ${dotClass}`} aria-hidden /> : null}
        {label}
      </div>
      <div className={styles.statusFieldValue}>{value}</div>
    </div>
  );
}
