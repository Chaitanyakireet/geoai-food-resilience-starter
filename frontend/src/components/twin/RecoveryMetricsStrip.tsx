import type { RecoveryMetrics } from "@/lib/api";
import styles from "./RecoveryMetricsStrip.module.css";

export function RecoveryMetricsStrip({ metrics }: { metrics: RecoveryMetrics | null }) {
  if (!metrics) {
    return <p className="muted" style={{ fontSize: 12, padding: "8px 0" }}>No recovery trajectory for this world (baseline has no shock to recover from).</p>;
  }

  return (
    <div className={styles.strip}>
      <Metric label="Peak disruption" value={`${(metrics.peak_disruption * 100).toFixed(1)}%`} def={metrics.definitions.peak_disruption} />
      <Metric
        label="Recovery time"
        value={metrics.recovery_time_days != null ? `${metrics.recovery_time_days}d` : "not reached in horizon"}
        def={metrics.definitions.recovery_time_days}
      />
      <Metric label="Recovery fraction" value={`${(metrics.recovery_fraction * 100).toFixed(0)}%`} def={metrics.definitions.recovery_fraction} />
      <Metric label="Residual impact" value={`${(metrics.residual_impact * 100).toFixed(1)}%`} def={metrics.definitions.residual_impact} />
      <Metric label="Resilience gap (start)" value={metrics.resilience_gap_before.toFixed(2)} def={metrics.definitions.resilience_gap_before} />
      <Metric label="Resilience gap (end)" value={metrics.resilience_gap_after.toFixed(2)} def={metrics.definitions.resilience_gap_after} />
    </div>
  );
}

function Metric({ label, value, def }: { label: string; value: string; def: string }) {
  return (
    <div className={styles.metric} title={def}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
