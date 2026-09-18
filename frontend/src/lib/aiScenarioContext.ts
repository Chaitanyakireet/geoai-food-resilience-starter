import type { AiScenarioContext, CandidateIntervention, TwinScenarioRequest } from "@/lib/api";
import type { ScenarioHandoff } from "@/components/interventions/types";
import { buildGraphShockInput, type GraphShockField } from "@/lib/shockMapping";

export const AI_SCENARIO_CONTEXT_KEY = "ai.scenarioContext";

export function scenarioHandoffToAiContext(handoff: ScenarioHandoff): AiScenarioContext {
  return {
    geo_id: handoff.geo_id,
    food_category: handoff.food_category,
    shock_field: handoff.shock_field,
    severity: handoff.severity,
    max_hops: handoff.max_hops,
    heat_change_c: handoff.heat_change_c,
    rainfall_change_pct: handoff.rainfall_change_pct,
    intervention_types: handoff.draft_interventions.map((d) => d.intervention_type),
    constraints: handoff.constraints,
    optimization_selected_types: handoff.optimization_result_summary?.selected_intervention_types ?? undefined,
  };
}

// Reconstructs a TwinScenarioRequest from an AiScenarioContext -- reuses
// the same buildGraphShockInput mapping the Intervention Lab and Digital
// Twin already use, so /twin/run and /twin/compare results computed here
// are identical to what those pages would show for the same context.
// Returns null if there's no geography (nothing to run against).
export function aiContextToTwinScenario(context: AiScenarioContext, scenarioIdPrefix = "impact"): TwinScenarioRequest | null {
  if (!context.geo_id) return null;

  const candidates: CandidateIntervention[] | undefined = context.intervention_types && context.intervention_types.length > 0 ? context.intervention_types.map((t) => ({ intervention_type: t })) : undefined;

  return {
    scenario_id: `${scenarioIdPrefix}-${Date.now()}`,
    geo_id: context.geo_id,
    food_category: context.food_category,
    shock: context.shock_field && context.severity !== undefined ? buildGraphShockInput(context.geo_id, context.shock_field as GraphShockField, context.severity, context.max_hops ?? 5) : undefined,
    heat_change_c: context.heat_change_c,
    rainfall_change_pct: context.rainfall_change_pct,
    intervention_portfolio: candidates,
    optimize_candidates: context.optimization_selected_types && candidates ? candidates : undefined,
    constraints: context.constraints,
  };
}

export function persistAiScenarioContext(context: AiScenarioContext): void {
  try {
    sessionStorage.setItem(AI_SCENARIO_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // sessionStorage unavailable -- not fatal, the AI Brief page just won't have context
  }
}
