import { StatusBadge } from "@/components/StatusBadge";
import type { ApiError, PortfolioResult, ShockResult } from "@/lib/api";
import styles from "./SimulationResultPanel.module.css";

export function SimulationResultPanel({
  shockResult,
  result,
  error,
  loading,
}: {
  shockResult: ShockResult | null;
  result: PortfolioResult | null;
  error: ApiError | null;
  loading: boolean;
}) {
  if (loading) return <div className={`${styles.wrap} card`}>Simulating portfolio…</div>;
  if (error) {
    return (
      <div className={`${styles.wrap} card ${styles.errorWrap}`}>
        <div className={styles.errorTitle}>Simulation failed ({error.status || "network"})</div>
        <div className="secondary">{error.detail}</div>
      </div>
    );
  }
  if (!result) return <div className={`${styles.wrap} card ${styles.empty}`}>Run Simulate to see the portfolio&apos;s modeled effect.</div>;

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>
        Simulation result <StatusBadge status="SIMULATED" compact />
      </div>

      {shockResult ? (
        <div className={styles.compareStrip}>
          <Metric label="Baseline resilience" value={shockResult.baseline_resilience.current_resilience_score.toFixed(2)} />
          <Metric label="Shocked resilience" value={shockResult.shocked_resilience.current_resilience_score.toFixed(2)} />
          <Metric
            label="Resilience effect (portfolio)"
            value={result.combined_resilience_effect != null ? signed(result.combined_resilience_effect) : "n/a"}
            accent
          />
          <Metric
            label="Food availability effect"
            value={result.combined_food_availability_effect_proxy != null ? signed(result.combined_food_availability_effect_proxy) : "n/a"}
            accent
          />
        </div>
      ) : null}

      <div className={styles.totalsRow}>
        <Metric label="Total cost" value={result.total_cost_estimate != null ? String(result.total_cost_estimate) : "unknown"} />
        <Metric label="Total water" value={result.total_water_impact_m3 != null ? `${result.total_water_impact_m3} m³` : "unknown"} />
        <Metric label="Total carbon" value={result.total_carbon_impact_tco2e != null ? `${result.total_carbon_impact_tco2e} tCO2e` : "unknown"} />
      </div>

      <div className={styles.groupTitle}>Constraint check</div>
      {Object.keys(result.constraint_check).length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>
          No constraints set.
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Constraint</th>
              <th>Limit</th>
              <th>Total</th>
              <th>Within limit</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(result.constraint_check).map(([key, c]) => (
              <tr key={key}>
                <td>{key.replace(/_/g, " ")}</td>
                <td className="secondary">{c.limit ?? "—"}</td>
                <td className="secondary">{c.total ?? "unknown"}</td>
                <td className="secondary">{c.within_limit === null ? "unknown" : c.within_limit ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.groupTitle} style={{ marginTop: 14 }}>
        Per-intervention effect ({result.combined_effect_composition_method})
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Intervention</th>
            <th>Effectiveness</th>
            <th>Food availability</th>
            <th>Resilience effect</th>
          </tr>
        </thead>
        <tbody>
          {result.interventions.map((i) => (
            <tr key={i.intervention_type}>
              <td style={{ textTransform: "capitalize" }}>{i.intervention_type.replace(/_/g, " ")}</td>
              <td className="secondary">
                {Math.round(i.effectiveness_used * 100)}% ({i.effectiveness_source === "user_override" ? "override" : "default"})
              </td>
              <td className="secondary">{signed(i.modeled_change.food_availability_effect_proxy)}</td>
              <td className="secondary">{signed(i.modeled_change.resilience_effect)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className={styles.details}>
        <summary>Assumptions &amp; limitations ({result.limitations.length})</summary>
        <ul className={styles.list}>
          {result.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={accent ? styles.metricValueAccent : styles.metricValue}>{value}</div>
    </div>
  );
}

function signed(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
}
