import type { AiScenarioContext } from "@/lib/api";
import type { ScenarioHandoff } from "@/components/interventions/types";

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

export function persistAiScenarioContext(context: AiScenarioContext): void {
  try {
    sessionStorage.setItem(AI_SCENARIO_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // sessionStorage unavailable -- not fatal, the AI Brief page just won't have context
  }
}
