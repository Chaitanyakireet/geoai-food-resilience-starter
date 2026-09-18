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

export const getHealth = () => getJson<HealthResponse>("/health");

export const getRiskState = (foodCategory = "all_food") =>
  getJson<RiskStateResponse>(`/risk/state?food_category=${encodeURIComponent(foodCategory)}`);

export const getGraphOverview = (foodCategory = "all_food") =>
  getJson<GraphOverviewResponse>(`/graph/overview?food_category=${encodeURIComponent(foodCategory)}`);

export const getDistricts = () => getJson<DistrictsFeatureCollection>("/gis/districts");

export const getInterventionCatalog = () => getJson<InterventionCatalog>("/interventions/catalog");

export const getTwinScenarios = () => getJson<TwinScenarioCatalog>("/twin/scenarios");
