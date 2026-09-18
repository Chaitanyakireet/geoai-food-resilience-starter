// Typed server-side client for the GeoAI Food-Resilience backend.
// Every function returns `null` on failure instead of throwing, so pages can
// render an explicit "data unavailable" state rather than crashing -- the
// backend is authoritative for all numeric/scientific values, this layer
// only fetches and types what it returns.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type TruthStatus = "OBSERVED" | "DERIVED" | "ESTIMATED" | "COUNTERFACTUAL" | "SIMULATED";
export type RiskClass = "low" | "moderate" | "high" | "severe" | "insufficient_data";
export type Confidence = "low" | "medium" | "high";

export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
  python_version: string;
  project: {
    name: string;
    region: string;
    product_type: string;
    food_scope: string;
    primary_sdg: string;
    secondary_sdgs: number[];
  };
  loop_stages: string[];
  modules: string[];
  truth_status_labels: TruthStatus[];
};

export type DataCoverage = {
  requested_days: number;
  available_days: number;
  coverage_ratio: number;
  spatial_resolution: string;
};

export type Driver = {
  feature: string;
  observed_value: number | null;
  baseline_value: number | null;
  unit: string;
  anomaly_pct: number | null;
  contribution_to_score: number | null;
  used_in_score: boolean;
  truth_status: TruthStatus;
  note: string | null;
};

export type RiskResult = {
  region_id: string;
  geo_level: "district" | "mandal" | "state";
  food_scope: string;
  horizon: string;
  date: string;
  risk_score: number | null;
  risk_class: RiskClass;
  confidence: Confidence;
  uncertainty_interval: [number, number] | null;
  major_drivers: Driver[];
  data_coverage: DataCoverage;
  model_version: string;
  run_id: string;
  truth_status: TruthStatus;
  resolved_via: string;
  provenance_refs: string[];
  limitations: string[];
};

export type RiskStateResponse = {
  food_scope: string;
  district_count: number;
  district_count_scored: number;
  mean_risk_score: number | null;
  truth_status: TruthStatus;
  method: string;
  districts: RiskResult[];
};

export type GraphOverviewSummary = {
  food_category: string;
  geo_id_filter: string | null;
  layers: string[];
  node_count: number;
  edge_count: number;
  node_truth_status_counts: Record<string, number>;
  edge_truth_status_counts: Record<string, number>;
  connectivity: {
    is_weakly_connected: boolean;
    weakly_connected_component_count: number;
    component_sizes: number[];
    isolated_node_count: number;
  };
};

export type BottleneckEntry = {
  node_id: string;
  node_type: string;
  geo_id: string;
  degree: number;
  weighted_degree: number | null;
  betweenness_centrality: number;
  is_articulation_point: boolean;
  note: string;
};

export type GraphOverviewResponse = {
  summary: GraphOverviewSummary;
  bottlenecks: BottleneckEntry[];
  impacted_geographies: string[];
  impacted_food_categories: string[];
  truth_status: string;
  limitations: string[];
};

export type DistrictFeature = {
  type: "Feature";
  id: string;
  properties: {
    district_id: string;
    name: string;
    osm_id: string;
    area_sq_km: number;
    centroid_lon: number;
    centroid_lat: number;
    truth_status: TruthStatus;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  bbox: [number, number, number, number];
};

export type DistrictsFeatureCollection = {
  type: "FeatureCollection";
  features: DistrictFeature[];
};

export type MandalFeature = {
  type: "Feature";
  properties: {
    mandal_id: string;
    name: string;
    osm_id: number;
    district_id: string;
    district_name: string;
    area_sq_km: number;
    centroid_lon: number;
    centroid_lat: number;
    truth_status: TruthStatus;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  bbox?: [number, number, number, number];
};

export type MandalsFeatureCollection = {
  type: "FeatureCollection";
  features: MandalFeature[];
};

export type StateBoundaryFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { state_id: string; name: string; area_sq_km: number; district_count: number; truth_status: TruthStatus };
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
    bbox: [number, number, number, number];
  }[];
};

export type LocationLookupResponse = {
  query: { lon: number; lat: number };
  district: {
    district_id: string;
    name: string;
    osm_id: number;
    area_sq_km: number;
    centroid_lon: number;
    centroid_lat: number;
    truth_status: TruthStatus;
  } | null;
  mandal: {
    mandal_id: string;
    name: string;
    osm_id: number;
    district_id: string;
    district_name: string;
    area_sq_km: number;
    centroid_lon: number;
    centroid_lat: number;
    truth_status: TruthStatus;
  } | null;
  resolved: boolean;
};

export type ProvenanceDataset = {
  dataset_name: string;
  publisher: string;
  source_url: string;
  access_date: string;
  license?: string;
  geographic_level?: string;
  crs?: string;
  processing: string;
  truth_status: TruthStatus;
  feature_count?: number;
  limitations: string;
};

export type ProvenanceResponse = {
  generated_at: string;
  datasets: ProvenanceDataset[];
  [key: string]: unknown;
};

export type MarketNode = {
  node_id: string;
  node_type: string;
  geo_id: string;
  geo_level: string;
  name: string;
  food_categories: string[];
  truth_status: TruthStatus;
  provenance: string;
  lon: number;
  lat: number;
};

export type ResilienceComponent = { name: string; value: number; weight: number; contribution: number; note: string };

export type ResilienceResult = {
  region_id: string;
  geo_level: string;
  food_scope: string;
  current_resilience_score: number;
  target_resilience_score: number;
  resilience_gap: number;
  components: ResilienceComponent[];
  model_version: string;
  truth_status: TruthStatus;
  provenance_refs: string[];
  limitations: string[];
};

export type GraphShockType = "production_reduction" | "storage_capacity_reduction" | "transport_capacity_reduction" | "market_disruption";

export type ShockInput = { target_node_id: string; shock_type: GraphShockType; severity: number; max_hops: number };

export type PropagationStep = { node_id: string; node_type: string; geo_id: string; hop_distance: number; impact_fraction: number; truth_status: TruthStatus };

export type PropagationResult = {
  shock: ShockInput;
  steps: PropagationStep[];
  impacted_geographies: string[];
  impacted_food_categories: string[];
  truth_status: TruthStatus;
  method: string;
  limitations: string[];
};

export type ShockComposerRequest = {
  geo_id: string;
  food_category?: string;
  heat_change_c?: number;
  rainfall_change_pct?: number;
  transport_capacity_reduction?: number;
  storage_capacity_reduction?: number;
  production_disruption?: number;
  market_demand_disruption?: number;
  max_hops?: number;
};

export type ShockResult = {
  shock_input: ShockComposerRequest;
  geo_id: string;
  food_category: string;
  baseline_risk: RiskResult | null;
  shocked_risk: RiskResult | null;
  baseline_resilience: ResilienceResult;
  shocked_resilience: ResilienceResult;
  graph_propagations: PropagationResult[];
  truth_status: TruthStatus;
  provenance_refs: string[];
  limitations: string[];
};

export type CandidateIntervention = {
  intervention_type: string;
  effectiveness_override?: number;
  cost_estimate?: number;
  cost_note?: string;
  water_impact_m3?: number;
  carbon_impact_tco2e?: number;
  loss_reduction_pct?: number;
  assumption_note?: string;
};

export type InterventionInputRequest = CandidateIntervention & { shock: ShockInput };

export type ModeledChange = {
  target_node_impact_reduction: number;
  food_availability_effect_proxy: number;
  resilience_effect: number;
  note: string;
};

export type InterventionResult = {
  intervention_type: string;
  intervention_label: string;
  mechanism: string;
  affected_geo_id: string;
  affected_food_categories: string[];
  effectiveness_used: number;
  effectiveness_source: "config_default" | "user_override";
  baseline_resilience: ResilienceResult;
  shock_propagation: PropagationResult;
  shock_resilience: ResilienceResult;
  intervention_propagation: PropagationResult;
  intervention_resilience: ResilienceResult;
  modeled_change: ModeledChange;
  food_loss_effect: number | null;
  water_impact_m3: number | null;
  carbon_impact_tco2e: number | null;
  cost_estimate: number | null;
  truth_status: TruthStatus;
  provenance_refs: string[];
  limitations: string[];
};

export type Constraints = { budget?: number; water_limit_m3?: number; carbon_target_tco2e?: number };

export type ConstraintCheckEntry = { limit: number | null; total: number | null; within_limit: boolean | null };

export type PortfolioInputRequest = { interventions: InterventionInputRequest[]; constraints?: Constraints };

export type PortfolioResult = {
  interventions: InterventionResult[];
  combined_effect_composition_method: string;
  combined_food_availability_effect_proxy: number | null;
  combined_resilience_effect: number | null;
  total_cost_estimate: number | null;
  total_water_impact_m3: number | null;
  total_carbon_impact_tco2e: number | null;
  constraint_check: Record<string, ConstraintCheckEntry>;
  truth_status: TruthStatus;
  provenance_refs: string[];
  limitations: string[];
};

export type OptimizationInputRequest = {
  shock: ShockInput;
  candidate_interventions: CandidateIntervention[];
  constraints?: Constraints;
  objective_weights?: Record<string, number>;
};

export type ObjectiveValues = {
  food_availability_effect_proxy: number | null;
  resilience_effect: number | null;
  food_loss_effect: number | null;
  cost: number | null;
  water_impact_m3: number | null;
  carbon_impact_tco2e: number | null;
};

export type FeasibilityStatus = "feasible" | "infeasible" | "unconstrained";

export type PortfolioCandidate = {
  intervention_types: string[];
  portfolio: PortfolioResult;
  objective_values: ObjectiveValues;
  feasibility_status: FeasibilityStatus;
  feasibility_note: string;
  normalized_score: number | null;
  is_pareto_optimal: boolean;
};

export type BaselineState = {
  risk_score: number | null;
  risk_truth_status: TruthStatus | null;
  resilience_score: number;
  resilience_gap: number;
  demand_impact_fraction: number;
  truth_status: TruthStatus;
};

export type OptimizationExplanation = {
  selected_intervention_types: string[];
  why_feasible: string;
  binding_constraints: string[];
  objectives_improved: string[];
  objectives_worsened: string[];
  assumptions_influencing_result: string[];
};

export type OptimizationResult = {
  objective_weights_used: Record<string, number>;
  normalization_method: string;
  baseline_state: BaselineState;
  candidates: PortfolioCandidate[];
  feasible_candidate_count: number;
  infeasible_candidate_count: number;
  selected_candidate: PortfolioCandidate | null;
  explanation: OptimizationExplanation | null;
  truth_status: TruthStatus;
  provenance_refs: string[];
  limitations: string[];
};

export type RiskConfig = { food_categories: string[]; [key: string]: unknown };

// --- Digital Twin ---

export type TwinScenarioRequest = {
  scenario_id: string;
  geo_id: string;
  food_category?: string;
  shock?: ShockInput;
  heat_change_c?: number;
  rainfall_change_pct?: number;
  intervention_portfolio?: CandidateIntervention[];
  optimize_candidates?: CandidateIntervention[];
  constraints?: Constraints;
  objective_weights?: Record<string, number>;
  simulation_horizon_days?: number;
  recovery_rate_override?: number;
};

export type ScenarioState = {
  label: string;
  risk_score: number | null;
  risk_truth_status: TruthStatus | null;
  resilience_score: number;
  resilience_gap: number;
  demand_impact_fraction: number;
  food_availability_effect_proxy: number | null;
  food_loss_effect: number | null;
  cost: number | null;
  water_impact_m3: number | null;
  carbon_impact_tco2e: number | null;
  intervention_types: string[];
  truth_status: TruthStatus;
};

export type RecoveryPoint = { day: number; demand_impact_fraction: number; resilience_score: number; resilience_gap: number };

export type RecoveryTrajectory = {
  starting_label: string;
  points: RecoveryPoint[];
  recovery_rate_used: number;
  recovery_rate_source: "config_default" | "user_override";
  timestep_days: number;
  horizon_days: number;
  truth_status: TruthStatus;
  method: string;
  limitations: string[];
};

export type RecoveryMetrics = {
  peak_disruption: number;
  final_disruption: number;
  recovery_time_days: number | null;
  recovery_fraction: number;
  resilience_gap_before: number;
  resilience_gap_after: number;
  residual_impact: number;
  definitions: Record<string, string>;
};

export type TwinResult = {
  scenario_id: string;
  geo_id: string;
  geo_level: string;
  food_category: string;
  baseline_state: ScenarioState;
  shocked_state: ScenarioState | null;
  intervention_state: ScenarioState | null;
  optimized_state: ScenarioState | null;
  shock_recovery: RecoveryTrajectory | null;
  intervention_recovery: RecoveryTrajectory | null;
  optimized_recovery: RecoveryTrajectory | null;
  shock_recovery_metrics: RecoveryMetrics | null;
  intervention_recovery_metrics: RecoveryMetrics | null;
  optimized_recovery_metrics: RecoveryMetrics | null;
  affected_geographies: string[];
  affected_food_categories: string[];
  truth_status: TruthStatus;
  provenance_refs: string[];
  limitations: string[];
};

export type CompareWorldsResult = {
  scenario_id: string;
  world_a_label: string;
  world_b_label: string;
  world_a_state: ScenarioState;
  world_b_state: ScenarioState;
  world_a_recovery: RecoveryTrajectory;
  world_b_recovery: RecoveryTrajectory;
  world_a_metrics: RecoveryMetrics;
  world_b_metrics: RecoveryMetrics;
  deltas: Record<string, number | null>;
  affected_geographies: string[];
  affected_food_categories: string[];
  truth_status: TruthStatus;
  provenance_refs: string[];
  limitations: string[];
};

// --- AI Decision Brief / Copilot ---

export type EvidenceItem = {
  provenance_id: string;
  source_name: string;
  source_url: string | null;
  access_date: string | null;
  truth_status: TruthStatus;
  excerpt: string;
  relevance_score: number;
  matched_terms: string[];
};

export type AiScenarioContext = {
  geo_id?: string;
  food_category?: string;
  shock_field?: string;
  severity?: number;
  max_hops?: number;
  heat_change_c?: number;
  rainfall_change_pct?: number;
  intervention_types?: string[];
  constraints?: Constraints;
  optimization_selected_types?: string[];
};

export type AiToolCallRecord = {
  tool_name: string;
  purpose: string;
  arguments: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  status: "ok" | "error";
  error?: string | null;
  source_refs: string[];
};

export type AiMode = "llm" | "deterministic_fallback";

export type AiQueryOutput = {
  answer: string;
  mode: AiMode;
  tool_trace: AiToolCallRecord[];
  citations: EvidenceItem[];
  truth_statuses_referenced: TruthStatus[];
  limitations: string[];
  provider_status: string;
};

export type DecisionBriefSection = {
  title: string;
  content: string;
  truth_status?: TruthStatus | null;
  source_refs: string[];
};

export type DecisionBriefOutput = {
  mode: AiMode;
  sections: DecisionBriefSection[];
  tool_trace: AiToolCallRecord[];
  citations: EvidenceItem[];
  limitations: string[];
  provider_status: string;
};

export const postAiQuery = (question: string, scenario_context?: AiScenarioContext) =>
  postJson<AiQueryOutput>("/ai/query", { question, scenario_context });

export const postAiDecisionBrief = (scenario_context: AiScenarioContext) =>
  postJson<DecisionBriefOutput>("/ai/decision-brief", { scenario_context });

export const getAiProvenance = () =>
  getJson<{ provider: { name: string; configured: boolean }; approved_tools: string[]; evidence_corpus: { document_count: number }; truth_status_discipline: string[]; limitations: string[] }>(
    "/ai/provenance",
  );

export const postTwinRun = (input: TwinScenarioRequest) => postJson<TwinResult>("/twin/run", input);

export const postTwinCompare = (input: TwinScenarioRequest) => postJson<CompareWorldsResult>("/twin/compare", input);

export const getTwinConfig = () => getJson<{ recovery_model: Record<string, number>; [key: string]: unknown }>("/twin/config");

// Disclosure-style ({nature, assumption_disclosure, ...}), not the
// dataset-registry shape gis/risk/graph use.
export const getTwinProvenance = () => getJson<Record<string, unknown>>("/twin/provenance");

export type InterventionCatalog = {
  intervention_types: Record<
    string,
    {
      label: string;
      mechanism: string;
      applicable_shock_types: string[];
      default_effectiveness: number;
    }
  >;
  [key: string]: unknown;
};

export type TwinScenarioCatalog = {
  scenario_types: Record<
    string,
    { label: string; description: string; how_to_construct: string }
  >;
  note: string;
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type ApiError = { status: number; detail: string };

// FastAPI's own validation errors (422) return `detail` as an array of
// {msg, loc, ...} objects; the app's own HTTPException(detail=str(...))
// returns a plain string. Normalize both into one displayable string so
// every error panel can just render `error.detail` as text.
function normalizeErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : JSON.stringify(d)))
      .join("; ");
  }
  if (detail != null) return JSON.stringify(detail);
  return undefined;
}

// POST calls surface the backend's error detail (400/404) rather than
// collapsing every failure to null -- the Intervention Lab needs to show
// *why* a shock/portfolio/optimization call was rejected (invalid shock,
// infeasible portfolio, etc.), not just "unavailable".
async function postJson<T>(path: string, body: unknown): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const parsed = await res.json();
        detail = normalizeErrorDetail(parsed?.detail) ?? detail;
      } catch {
        // non-JSON error body; keep statusText
      }
      return { data: null, error: { status: res.status, detail } };
    }
    return { data: (await res.json()) as T, error: null };
  } catch {
    return { data: null, error: { status: 0, detail: "Backend unreachable" } };
  }
}

export const getHealth = () => getJson<HealthResponse>("/health");

export const getRiskState = (foodCategory = "all_food") =>
  getJson<RiskStateResponse>(`/risk/state?food_category=${encodeURIComponent(foodCategory)}`);

export const getGraphOverview = (foodCategory = "all_food") =>
  getJson<GraphOverviewResponse>(`/graph/overview?food_category=${encodeURIComponent(foodCategory)}`);

export const getDistricts = () => getJson<DistrictsFeatureCollection>("/gis/districts");

export const getTelangana = () => getJson<StateBoundaryFeatureCollection>("/gis/telangana");

export const getMandals = (districtId: string) =>
  getJson<MandalsFeatureCollection>(`/gis/mandals?district_id=${encodeURIComponent(districtId)}`);

export const getLocationLookup = (lon: number, lat: number) =>
  getJson<LocationLookupResponse>(`/gis/location?lon=${lon}&lat=${lat}`);

export const getGisProvenance = () => getJson<ProvenanceResponse>("/gis/provenance");

export const getRiskProvenance = () => getJson<ProvenanceResponse>("/risk/provenance");

export const getGraphProvenance = () => getJson<ProvenanceResponse>("/graph/provenance");

// Intervention/optimization provenance are "assumption disclosure" style
// (nature + assumption_disclosure list), not the dataset-registry shape
// gis/risk/graph use -- typed loosely, the Impact page reads known fields.
export const getInterventionProvenance = () => getJson<Record<string, unknown>>("/interventions/provenance");

export const getOptimizationProvenance = () => getJson<Record<string, unknown>>("/optimization/provenance");

export const getRiskForGeo = (geoId: string, foodCategory = "all_food") =>
  getJson<RiskResult>(`/risk?geo_id=${encodeURIComponent(geoId)}&food_category=${encodeURIComponent(foodCategory)}`);

export const getMarketNodes = async (): Promise<MarketNode[] | null> => {
  const nodes = await getJson<MarketNode[]>("/graph/nodes");
  if (!nodes) return null;
  return nodes.filter((n) => n.node_type === "market");
};

export const getInterventionCatalog = () => getJson<InterventionCatalog>("/interventions/catalog");

export const getTwinScenarios = () => getJson<TwinScenarioCatalog>("/twin/scenarios");

export const getRiskConfig = () => getJson<RiskConfig>("/risk/config");

export const getOptimizationConfig = () => getJson<{ objective_weights: Record<string, number>; max_candidates: number; [key: string]: unknown }>("/optimization/config");

export const postShock = (input: ShockComposerRequest) => postJson<ShockResult>("/interventions/shock", input);

export const postPortfolio = (input: PortfolioInputRequest) => postJson<PortfolioResult>("/interventions/portfolio", input);

export const postOptimizationRun = (input: OptimizationInputRequest) => postJson<OptimizationResult>("/optimization/run", input);
