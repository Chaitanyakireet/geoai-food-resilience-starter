import { StatusBadge } from "@/components/StatusBadge";
import type { ApiError, CompareWorldsResult } from "@/lib/api";
import { RecoveryChart } from "./RecoveryChart";
import styles from "./CompareWorldsPanel.module.css";

// Polarity mirrors backend/twin/compare.py's own disclosed convention:
// demand_impact/residual_impact/recovery_time deltas are WORLD B - WORLD A,
// negative = improvement; resilience_score positive = improvement (closing
// the gap). Cost/water/carbon are resource-spend accounting, not a
// good/bad axis -- an active intervention spending more than the
// zero-cost "do nothing" baseline is expected, not a sign of a poor
// choice, so they render neutral (no up=bad/down=good coloring).
const DELTA_DEFINITIONS: Record<string, { label: string; unit?: string; improvementIsNegative?: boolean; neutral?: boolean }> = {
  demand_impact_fraction: { label: "Demand impact", unit: "%", improvementIsNegative: true },
  resilience_score: { label: "Resilience score" },
  resilience_gap: { label: "Resilience gap", improvementIsNegative: true },
  food_availability_effect_proxy: { label: "Food availability effect" },
  food_loss_effect: { label: "Food loss effect" },
  cost: { label: "Cost", neutral: true },
  water_impact_m3: { label: "Water impact", unit: "m³", neutral: true },
  carbon_impact_tco2e: { label: "Carbon impact", unit: "tCO2e", neutral: true },
  recovery_time_days: { label: "Recovery time", unit: "d", improvementIsNegative: true },
  residual_impact: { label: "Residual impact", improvementIsNegative: true },
};

export function CompareWorldsPanel({ result, error, loading }: { result: CompareWorldsResult | null; error: ApiError | null; loading: boolean }) {
  if (loading) {
    return (
      <div className={`${styles.wrap} card state-block`}>
        <div className="pulse state-block-title">Comparing worlds…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`${styles.wrap} card state-block state-block-error`}>
        <div className="state-block-title">Compare Worlds unavailable ({error.status || "network"})</div>
        <p className="secondary">{error.detail}</p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className={`${styles.wrap} card state-block`}>
        <p className="secondary">Run COMPARE WORLDS to see World A vs World B side by side.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Compare Worlds</div>
          <p className={styles.subnote}>What changes under this modeled intervention scenario — not a claim of a universal &quot;best world.&quot;</p>
        </div>
        <StatusBadge status="SIMULATED" compact />
      </div>

      <div className={styles.worldHeaders}>
        <div className={styles.worldHeader}>
          <span className={styles.worldDot} style={{ background: "var(--cat-blue)" }} />
          World A — {result.world_a_label.replace(/_/g, " ")}
        </div>
        <div className={styles.worldHeader}>
          <span className={styles.worldDot} style={{ background: "var(--cat-aqua)" }} />
          World B — {result.world_b_label.replace(/_/g, " ")}
        </div>
      </div>

      <RecoveryChart
        series={[
          { key: "a", label: "World A (no intervention)", points: result.world_a_recovery.points, colorVar: "var(--cat-blue)" },
          { key: "b", label: "World B (intervention)", points: result.world_b_recovery.points, colorVar: "var(--cat-aqua)", emphasize: true },
        ]}
      />

      <div className={styles.deltaGrid}>
        {Object.entries(result.deltas)
          .filter(([, v]) => v !== null)
          .map(([key, value]) => (
            <DeltaTile key={key} deltaKey={key} value={value as number} />
          ))}
      </div>

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

function DeltaTile({ deltaKey, value }: { deltaKey: string; value: number }) {
  const def = DELTA_DEFINITIONS[deltaKey] ?? { label: deltaKey.replace(/_/g, " ") };
  const isZero = value === 0;
  const isNeutral = def.neutral || isZero;
  const positive = def.improvementIsNegative ? value < 0 : value > 0;
  const arrow = isZero ? "→" : value > 0 ? "↑" : "↓";
  const displayValue = def.unit === "%" ? `${(value * 100).toFixed(1)}%` : `${value >= 0 ? "+" : ""}${value.toFixed(3)}${def.unit ? ` ${def.unit}` : ""}`;

  return (
    <div className={styles.deltaTile}>
      <div className={styles.deltaLabel}>{def.label}</div>
      <div className={`${styles.deltaValue} ${isNeutral ? styles.deltaNeutral : positive ? styles.deltaGood : styles.deltaBad}`}>
        {arrow} {displayValue}
      </div>
    </div>
  );
}
