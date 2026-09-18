import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import type { ApiError, ShockResult } from "@/lib/api";
import styles from "./ShockResultPanel.module.css";

export function ShockResultPanel({ result, error, loading }: { result: ShockResult | null; error: ApiError | null; loading: boolean }) {
  if (loading) return <div className={`${styles.wrap} card`}>Running shock composer…</div>;
  if (error) {
    return (
      <div className={`${styles.wrap} card ${styles.errorWrap}`}>
        <div className={styles.errorTitle}>Shock composition failed ({error.status || "network"})</div>
        <div className="secondary">{error.detail}</div>
      </div>
    );
  }
  if (!result) {
    return <div className={`${styles.wrap} card ${styles.empty}`}>Compose a shock to see modeled impact here.</div>;
  }

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Modeled impact</div>

      <div className={styles.compareGrid}>
        <div>
          <div className={styles.compareLabel}>Baseline risk</div>
          {result.baseline_risk ? (
            <RiskBadge riskClass={result.baseline_risk.risk_class} />
          ) : (
            <span className="muted">n/a</span>
          )}
        </div>
        <div>
          <div className={styles.compareLabel}>
            Shocked risk <StatusBadge status="COUNTERFACTUAL" compact />
          </div>
          {result.shocked_risk ? <RiskBadge riskClass={result.shocked_risk.risk_class} /> : <span className="muted">not computed (no climate fields set)</span>}
        </div>
        <div>
          <div className={styles.compareLabel}>Baseline resilience</div>
          <span className={styles.num}>{result.baseline_resilience.current_resilience_score.toFixed(2)}</span>
          <span className="muted"> gap {result.baseline_resilience.resilience_gap.toFixed(2)}</span>
        </div>
        <div>
          <div className={styles.compareLabel}>
            Shocked resilience <StatusBadge status="SIMULATED" compact />
          </div>
          <span className={styles.num}>{result.shocked_resilience.current_resilience_score.toFixed(2)}</span>
          <span className="muted"> gap {result.shocked_resilience.resilience_gap.toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.groupTitle}>Graph propagation</div>
      {result.graph_propagations.length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>
          No graph field set (climate-only shock).
        </p>
      ) : (
        result.graph_propagations.map((p) => (
          <div key={p.shock.target_node_id} className={styles.propagation}>
            <div className={styles.propHeader}>
              <span>
                {p.shock.target_node_id} — {p.shock.shock_type.replace(/_/g, " ")} @ {(p.shock.severity * 100).toFixed(0)}%
              </span>
              <StatusBadge status="SIMULATED" compact />
            </div>
            <div className="secondary" style={{ fontSize: 12 }}>
              {p.steps.length} nodes affected across {p.impacted_geographies.length} geographies, {p.impacted_food_categories.length} food categories
            </div>
          </div>
        ))
      )}

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
