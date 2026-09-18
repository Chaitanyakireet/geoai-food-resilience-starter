import type { AiScenarioContext } from "@/lib/api";
import type { ScenarioHandoff } from "@/components/interventions/types";
import type { GraphShockField } from "@/lib/shockMapping";

// One-shot prefill channel from the Food Network workspace to the
// Intervention Lab -- reuses the existing AiScenarioContext shape (same
// field names already used everywhere else) instead of inventing a second
// geography/scenario schema. Consumed once on mount, then cleared.
export const NETWORK_INTERVENTION_HANDOFF_KEY = "network.interventionHandoff";

export function buildNetworkScenarioContext(params: {
  geoId: string;
  foodCategory: string;
  shockField: GraphShockField;
  severity: number;
  maxHops: number;
}): AiScenarioContext {
  return {
    geo_id: params.geoId,
    food_category: params.foodCategory,
    shock_field: params.shockField,
    severity: params.severity,
    max_hops: params.maxHops,
  };
}

export function writeNetworkInterventionHandoff(context: AiScenarioContext): void {
  try {
    sessionStorage.setItem(NETWORK_INTERVENTION_HANDOFF_KEY, JSON.stringify(context));
  } catch {
    // sessionStorage unavailable -- the Intervention Lab just opens with its own defaults
  }
}

export function readAndClearNetworkInterventionHandoff(): AiScenarioContext | null {
  try {
    const raw = sessionStorage.getItem(NETWORK_INTERVENTION_HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(NETWORK_INTERVENTION_HANDOFF_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.geo_id !== "string") return null;
    return parsed as AiScenarioContext;
  } catch {
    return null;
  }
}

// Builds a full ScenarioHandoff for "Simulate in Digital Twin" from the
// Food Network -- reuses the exact same sessionStorage key and shape the
// Intervention Lab already writes, so the Digital Twin's useScenarioHandoff
// hook needs no changes at all.
export function buildNetworkTwinHandoff(params: {
  geoId: string;
  foodCategory: string;
  shockField: GraphShockField;
  severity: number;
  maxHops: number;
}): ScenarioHandoff {
  return {
    source: "food-network",
    geo_id: params.geoId,
    food_category: params.foodCategory,
    shock_field: params.shockField,
    severity: params.severity,
    max_hops: params.maxHops,
    draft_interventions: [],
    shock_result_summary: null,
    portfolio_result_summary: null,
    optimization_result_summary: null,
    created_at: new Date().toISOString(),
  };
}
