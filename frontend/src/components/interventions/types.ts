import type { CandidateIntervention, OptimizationResult, PortfolioResult, ShockResult } from "@/lib/api";
import type { GraphShockField } from "@/lib/shockMapping";

export type DraftIntervention = CandidateIntervention;

export type ScenarioHandoff = {
  source: "intervention-lab" | "food-network";
  geo_id: string;
  food_category: string;
  shock_field: GraphShockField;
  severity: number;
  max_hops: number;
  heat_change_c?: number;
  rainfall_change_pct?: number;
  draft_interventions: DraftIntervention[];
  constraints?: { budget?: number; water_limit_m3?: number; carbon_target_tco2e?: number };
  shock_result_summary: { risk_class?: string; resilience_gap?: number } | null;
  portfolio_result_summary: { food_availability_effect_proxy: number | null; total_cost_estimate: number | null } | null;
  optimization_result_summary: { selected_intervention_types: string[] | null; feasible_candidate_count: number } | null;
  created_at: string;
};

export type { ShockResult, PortfolioResult, OptimizationResult };
