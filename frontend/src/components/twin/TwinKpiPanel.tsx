import { StatusBadge } from "@/components/StatusBadge";
import type { ScenarioState } from "@/lib/api";
import { WORLD_LABELS, type WorldKey } from "./types";
import styles from "./TwinKpiPanel.module.css";

export function TwinKpiPanel({ world, state }: { world: WorldKey; state: ScenarioState | null }) {
  if (!state) {
    return (
      <div className={`${styles.wrap} card`}>
        <div className={styles.title}>{WORLD_LABELS[world]}</div>
        <p className="muted" style={{ fontSize: 12.5, padding: "12px 0" }}>
          Not modeled for this scenario.
        </p>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>
        {WORLD_LABELS[world]} <StatusBadge status={state.truth_status} compact />
      </div>
      <div className={styles.grid}>
        <Metric label="Risk" value={state.risk_score != null ? state.risk_score.toFixed(2) : "Data unavailable"} />
        <Metric label="Resilience" value={state.resilience_score.toFixed(2)} />
        <Metric label="Resilience gap" value={state.resilience_gap.toFixed(2)} />
        <Metric label="Demand impact" value={`${(state.demand_impact_fraction * 100).toFixed(1)}%`} />
        <Metric
          label="Food availability effect"
          value={state.food_availability_effect_proxy != null ? signed(state.food_availability_effect_proxy) : "Not modeled"}
        />
        <Metric label="Food loss effect" value={state.food_loss_effect != null ? signed(state.food_loss_effect) : "Not modeled"} />
        <Metric label="Cost" value={state.cost != null ? String(state.cost) : "Data unavailable"} />
        <Metric label="Water" value={state.water_impact_m3 != null ? `${state.water_impact_m3} m³` : "Data unavailable"} />
        <Metric label="Carbon" value={state.carbon_impact_tco2e != null ? `${state.carbon_impact_tco2e} tCO2e` : "Data unavailable"} />
      </div>
      {state.intervention_types.length > 0 ? (
        <div className={styles.interventions}>Interventions: {state.intervention_types.join(", ").replace(/_/g, " ")}</div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

function signed(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
}
