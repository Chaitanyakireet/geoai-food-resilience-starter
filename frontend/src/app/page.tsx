import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { MiniRiskMap } from "@/components/MiniRiskMap";
import { getDistricts, getGraphOverview, getHealth, getRiskState, type RiskResult } from "@/lib/api";
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

  const hotspots = [...(riskState?.districts ?? [])]
    .filter((d): d is RiskResult & { risk_score: number } => d.risk_score !== null)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  const riskByDistrict = new Map(riskState?.districts.map((d) => [d.region_id, d]) ?? []);

  return (
    <div>
      <PageHeader
        eyebrow="Command Center"
        title="Hyderabad–Telangana food system, at a glance"
        subtitle={`${health.project.food_scope.replace(/_/g, " ")} · primary ${health.project.primary_sdg} · as of ${riskState?.districts[0]?.date ?? "—"}`}
      />

      <div className={styles.statRow}>
        <StatTile
          label="Mean climate-stress risk"
          value={riskState?.mean_risk_score != null ? riskState.mean_risk_score.toFixed(2) : "—"}
          helpText={
            riskState
              ? `Unweighted mean, ${riskState.district_count_scored}/${riskState.district_count} districts scored`
              : "Risk service unavailable"
          }
          tone="accent"
        />
        <StatTile
          label="Food network nodes"
          value={graphOverview ? String(graphOverview.summary.node_count) : "—"}
          helpText={graphOverview ? `${graphOverview.summary.edge_count} edges, all districts` : "Graph service unavailable"}
        />
        <StatTile
          label="Structural bottlenecks"
          value={graphOverview ? String(graphOverview.bottlenecks.length) : "—"}
          helpText="Graph-theoretic candidates, not confirmed real-world importance"
        />
        <StatTile
          label="Network connectivity"
          value={
            graphOverview
              ? graphOverview.summary.connectivity.is_weakly_connected
                ? "Connected"
                : `${graphOverview.summary.connectivity.weakly_connected_component_count} components`
              : "—"
          }
          helpText={graphOverview ? `${graphOverview.summary.connectivity.isolated_node_count} isolated nodes` : undefined}
        />
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.mainCol}>
          {districts && riskState ? (
            <MiniRiskMap districts={districts} riskByDistrict={riskByDistrict} />
          ) : (
            <div className={`${styles.emptyState} card`}>
              Map preview unavailable — GIS or risk data did not load. Full interactive Spatial Intelligence
              workspace is built in the next phase regardless.
            </div>
          )}
        </div>

        <div className={styles.sideCol}>
          <div className={`${styles.panel} card`}>
            <div className={styles.panelTitle}>Top risk hotspots</div>
            {hotspots.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Risk</th>
                    <th>Confidence</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((d) => (
                    <tr key={d.region_id}>
                      <td>{d.region_id.replace(/_/g, " ")}</td>
                      <td>
                        <RiskBadge riskClass={d.risk_class} />
                      </td>
                      <td className="secondary">{d.confidence}</td>
                      <td className="secondary">{Math.round(d.data_coverage.coverage_ratio * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="secondary">No scored districts available.</p>
            )}
          </div>

          <div className={`${styles.panel} card`}>
            <div className={styles.panelTitle}>Data provenance & truth status</div>
            <p className={styles.panelText}>
              Risk baseline: <StatusBadge status="ESTIMATED" /> transparent climate-stress proxy over NASA POWER —
              not a fitted, validated model.
            </p>
            <p className={styles.panelText}>
              Food network: <StatusBadge status="OBSERVED" /> market locations (OpenStreetMap),{" "}
              <StatusBadge status="SIMULATED" /> production/aggregation/storage placeholders where no source
              dataset exists.
            </p>
            <p className={styles.panelText}>
              District mean risk aggregation method: <span className="secondary">{riskState?.method ?? "n/a"}</span>
            </p>
          </div>
        </div>
      </div>

      <div className={`${styles.disclosure} card`}>
        <div className={styles.panelTitle}>Core loop</div>
        <p className="secondary">{health.loop_stages.join(" → ")}</p>
        <div className={styles.disclosureFooter}>
          <span className="muted">Backend service: {health.service}</span>
          <span className="muted">Truth-status framework: {health.truth_status_labels.join(", ")}</span>
        </div>
      </div>
    </div>
  );
}
