import { StatusBadge } from "@/components/StatusBadge";
import type { ApiError, TwinResult } from "@/lib/api";
import styles from "./ImpactSummaryPanel.module.css";

export function ImpactSummaryPanel({ result, error, loading }: { result: TwinResult | null; error: ApiError | null; loading: boolean }) {
  if (loading) {
    return (
      <div className={`${styles.wrap} card state-block`}>
        <div className="pulse state-block-title">Computing impact via the Digital Twin…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`${styles.wrap} card state-block state-block-error`}>
        <div className="state-block-title">Impact computation failed ({error.status || "network"})</div>
        <p className="secondary">{error.detail}</p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className={`${styles.wrap} card state-block`}>
        <p className="secondary">Set an active scenario to compute modeled impact.</p>
      </div>
    );
  }

  const headline = result.optimized_state ?? result.intervention_state ?? result.shocked_state ?? result.baseline_state;
  const headlineLabel =
    result.optimized_state ? "optimized intervention" : result.intervention_state ? "manual portfolio" : result.shocked_state ? "shock, no intervention" : "baseline (no shock)";
  const metrics = result.optimized_recovery_metrics ?? result.intervention_recovery_metrics ?? result.shock_recovery_metrics ?? null;

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Impact summary</div>
          <p className={styles.subnote}>Headline state: {headlineLabel} — the best-available modeled outcome for this scenario.</p>
        </div>
        <StatusBadge status={headline.truth_status} compact />
      </div>

      <div className={styles.grid}>
        <Metric label="Food availability effect" value={headline.food_availability_effect_proxy} format="signed" />
        <Metric label="Food loss effect" value={headline.food_loss_effect} format="signed" />
        <Metric label="Resilience" value={headline.resilience_score} format="plain" />
        <Metric label="Resilience gap" value={headline.resilience_gap} format="plain" />
        <Metric label="Cost" value={headline.cost} format="plain" />
        <Metric label="Water impact" value={headline.water_impact_m3} format="plain" unit="m³" />
        <Metric label="Carbon impact" value={headline.carbon_impact_tco2e} format="plain" unit="tCO2e" />
        <Metric label="Recovery time" value={metrics?.recovery_time_days ?? undefined} format="days" />
        <Metric label="Residual impact" value={metrics?.residual_impact} format="percent" />
      </div>

      <p className={styles.footnote}>
        Cost/water/carbon are only ever echoes of values you supplied when composing interventions in the
        Intervention Lab — where you didn&apos;t supply one, it reads &quot;Data unavailable,&quot; never zero.
      </p>
    </div>
  );
}

function Metric({ label, value, format, unit }: { label: string; value: number | null | undefined; format: "signed" | "plain" | "percent" | "days"; unit?: string }) {
  const display = formatMetric(value, format, unit);
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={display === null ? styles.metricUnavailable : styles.metricValue}>{display ?? "Data unavailable"}</div>
    </div>
  );
}

function formatMetric(value: number | null | undefined, format: "signed" | "plain" | "percent" | "days", unit?: string): string | null {
  if (value === null || value === undefined) return null;
  switch (format) {
    case "signed":
      return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "days":
      return `${value}d`;
    default:
      return unit ? `${value} ${unit}` : String(value);
  }
}
