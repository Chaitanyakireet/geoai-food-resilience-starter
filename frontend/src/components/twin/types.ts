import type { CandidateIntervention, Constraints, RecoveryMetrics, RecoveryTrajectory, ScenarioState, TwinScenarioRequest } from "@/lib/api";
import { buildGraphShockInput } from "@/lib/shockMapping";
import type { ScenarioHandoff } from "@/components/interventions/types";

export type WorldKey = "baseline" | "shock" | "intervention" | "optimized";

export const WORLD_LABELS: Record<WorldKey, string> = {
  baseline: "Baseline",
  shock: "World A — Shock, no intervention",
  intervention: "Manual portfolio",
  optimized: "World B — Optimized intervention",
};

export function buildTwinScenarioFromHandoff(handoff: ScenarioHandoff): TwinScenarioRequest {
  const shock = buildGraphShockInput(handoff.geo_id, handoff.shock_field, handoff.severity, handoff.max_hops);
  const candidates: CandidateIntervention[] = handoff.draft_interventions;
  const hasOptimization = handoff.optimization_result_summary !== null;

  return {
    scenario_id: `twin-${Date.now()}`,
    geo_id: handoff.geo_id,
    food_category: handoff.food_category,
    shock,
    heat_change_c: handoff.heat_change_c,
    rainfall_change_pct: handoff.rainfall_change_pct,
    intervention_portfolio: candidates.length > 0 ? candidates : undefined,
    optimize_candidates: hasOptimization && candidates.length > 0 ? candidates : undefined,
    constraints: handoff.constraints as Constraints | undefined,
  };
}

export function buildBaselineScenario(geoId: string, foodCategory: string): TwinScenarioRequest {
  return {
    scenario_id: `twin-baseline-${Date.now()}`,
    geo_id: geoId,
    food_category: foodCategory,
  };
}

export function stateForWorld(result: { baseline_state: ScenarioState; shocked_state: ScenarioState | null; intervention_state: ScenarioState | null; optimized_state: ScenarioState | null }, world: WorldKey): ScenarioState | null {
  switch (world) {
    case "baseline":
      return result.baseline_state;
    case "shock":
      return result.shocked_state;
    case "intervention":
      return result.intervention_state;
    case "optimized":
      return result.optimized_state;
  }
}

export function recoveryForWorld(
  result: { shock_recovery: RecoveryTrajectory | null; intervention_recovery: RecoveryTrajectory | null; optimized_recovery: RecoveryTrajectory | null },
  world: WorldKey,
): RecoveryTrajectory | null {
  switch (world) {
    case "shock":
      return result.shock_recovery;
    case "intervention":
      return result.intervention_recovery;
    case "optimized":
      return result.optimized_recovery;
    default:
      return null;
  }
}

export function metricsForWorld(
  result: { shock_recovery_metrics: RecoveryMetrics | null; intervention_recovery_metrics: RecoveryMetrics | null; optimized_recovery_metrics: RecoveryMetrics | null },
  world: WorldKey,
): RecoveryMetrics | null {
  switch (world) {
    case "shock":
      return result.shock_recovery_metrics;
    case "intervention":
      return result.intervention_recovery_metrics;
    case "optimized":
      return result.optimized_recovery_metrics;
    default:
      return null;
  }
}
