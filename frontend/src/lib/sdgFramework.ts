import type { ScenarioState } from "@/lib/api";
import { SDG_NAMES } from "@/lib/sdg";

export type SdgStatus = "directly_modeled" | "co_benefit" | "not_modeled";

export const SDG_STATUS_LABEL: Record<SdgStatus, string> = {
  directly_modeled: "Directly Modeled",
  co_benefit: "Indirect / Co-Benefit",
  not_modeled: "Not Modeled / Insufficient Evidence",
};

export type SdgEntry = {
  number: number;
  name: string;
  role: "primary" | "secondary";
  status: SdgStatus;
  relationship: string;
  relevantOutputs: string;
  relevantData: string;
  relevantMethod: string;
  evidenceProvenance: string;
  limitations: string;
};

// Every field here describes what this project's own backend modules
// actually compute or ingest -- never a numeric "SDG score" or achievement
// claim. Status is a coverage classification (does a real output touch
// this goal, even indirectly), not a confidence or risk-severity judgment.
export function buildSdgFramework(headline: ScenarioState | null): SdgEntry[] {
  return [
    {
      number: 2,
      name: SDG_NAMES[2],
      role: "primary",
      status: "directly_modeled",
      relationship:
        "This platform's entire modeling stack -- climate-stress risk scoring, the food-system dependency graph, shock propagation, intervention portfolios, multi-objective optimization, and Digital Twin recovery simulation -- exists to characterize and respond to food-availability risk for a chosen geography and food scope. Resilience score, resilience gap, and food-availability-effect proxies are direct, deterministic outputs for any valid scenario, and every disruption/recovery pathway the product models (Spatial Intelligence's risk drivers, the Food Network's shock propagation, Intervention Lab's portfolios, the Digital Twin's recovery trajectory) is in service of this one goal.",
      relevantOutputs: "risk_score, risk_class, resilience_gap, food_availability_effect_proxy, recovery trajectory (Digital Twin)",
      relevantData: "NASA POWER climate signals, Telangana district/mandal boundaries (OpenStreetMap), OpenStreetMap market locations, the modeled food-network graph",
      relevantMethod: "Deterministic risk scoring (backend/risk), food-network shock propagation (backend/graph), resilience and recovery modeling (backend/resilience, backend/recovery), portfolio optimization (backend/optimization)",
      evidenceProvenance: "/risk/provenance, /graph/provenance, /twin/provenance",
      limitations:
        "Risk is a transparent climate-stress PROXY, not a validated, ground-truthed hunger or food-insecurity measurement. The platform does not measure actual hunger prevalence, malnutrition, or household food consumption -- it models structural and climatic risk to food availability and the system's modeled capacity to recover from a shock.",
    },
    {
      number: 6,
      name: SDG_NAMES[6],
      role: "secondary",
      status: headline?.water_impact_m3 != null ? "co_benefit" : "not_modeled",
      relationship:
        "Where an intervention portfolio specifies a water_limit_m3 constraint, or a water_impact_m3 accounting figure for the active scenario, the optimizer and impact summary surface it alongside food-resilience outputs. This is a real constraint the optimizer respects, but the platform does not independently compute hydrological or water-stress impact.",
      relevantOutputs: headline?.water_impact_m3 != null ? `water_impact_m3 = ${headline.water_impact_m3} (this scenario)` : "water_impact_m3 (only when supplied for a scenario)",
      relevantData: "None ingested independently -- water figures are caller-supplied accounting inputs or optimizer constraints, not measured hydrological data.",
      relevantMethod: "Constraint pass-through and echo in backend/optimization and backend/intervention; no hydrological model exists.",
      evidenceProvenance: "/optimization/provenance, /interventions/provenance",
      limitations: "No groundwater, water-stress, or hydrological dataset is ingested anywhere in this platform. Any water figure shown is a caller-supplied number, not an independent estimate.",
    },
    {
      number: 7,
      name: SDG_NAMES[7],
      role: "secondary",
      status: "not_modeled",
      relationship: "Energy access and clean-energy transition are outside this platform's current scope. Listed here because it is one of the project's declared secondary SDGs, not because any output currently touches it.",
      relevantOutputs: "None.",
      relevantData: "None ingested.",
      relevantMethod: "Not applicable -- no energy model exists in this platform.",
      evidenceProvenance: "Not applicable.",
      limitations: "No energy-system data, cost model, or emissions-source model of any kind exists anywhere in this platform.",
    },
    {
      number: 8,
      name: SDG_NAMES[8],
      role: "secondary",
      status: "not_modeled",
      relationship: "Food-system resilience plausibly supports agricultural livelihoods and market continuity, but this platform does not model labor markets, employment, wages, or income.",
      relevantOutputs: "None.",
      relevantData: "None ingested -- no labor-market, employment, or livelihood dataset.",
      relevantMethod: "Not applicable.",
      evidenceProvenance: "Not applicable.",
      limitations: "No employment, wage, or livelihood data is ingested anywhere in this platform.",
    },
    {
      number: 9,
      name: SDG_NAMES[9],
      role: "secondary",
      status: "co_benefit",
      relationship:
        "The food-network graph's structural bottleneck diagnostics (articulation points and betweenness centrality across production, aggregation, storage, market, and demand nodes) are a structural proxy for logistics-infrastructure robustness. The GeoAI decision-support platform itself is also a form of digital infrastructure for food-system planning.",
      relevantOutputs: "bottlenecks list, is_articulation_point, betweenness_centrality, degree/weighted_degree",
      relevantData: "The modeled food-network graph, OpenStreetMap market locations, district adjacency (transport backbone)",
      relevantMethod: "Graph-theoretic structural analysis via NetworkX (backend/graph)",
      evidenceProvenance: "/graph/provenance",
      limitations: "Bottleneck flags are graph-theoretic structural candidates, not confirmed real-world infrastructure failures, investment priorities, or engineering assessments.",
    },
    {
      number: 11,
      name: SDG_NAMES[11],
      role: "secondary",
      status: "co_benefit",
      relationship:
        "Hyderabad is explicitly modeled as the platform's principal demand hub. Resilience and recovery outputs computed for Hyderabad and its urban mandals (Secunderabad, Quthbullapur, and others) speak to urban food-system stability for a major city, though no dedicated urban-livability, housing, or municipal-service metric is computed.",
      relevantOutputs: "is_principal_demand_hub flag on the Hyderabad demand node; district/mandal-level risk and resilience for Hyderabad-metro geographies",
      relevantData: "Telangana district/mandal GeoJSON, the food-network graph",
      relevantMethod: "The same risk/graph/resilience pipeline used statewide, applied to an urban geography -- not a distinct urban model",
      evidenceProvenance: "/gis/provenance, /risk/provenance, /graph/provenance",
      limitations: "No urban-specific livability, housing, or service-access indicator exists. This is the statewide model applied to a city, not bespoke urban modeling.",
    },
    {
      number: 12,
      name: SDG_NAMES[12],
      role: "secondary",
      status: headline?.food_loss_effect != null ? "co_benefit" : "not_modeled",
      relationship:
        "Where a scenario supplies a loss_reduction_pct for a storage or post-harvest intervention, the platform surfaces a food_loss_effect proxy -- a plausible link to reduced food waste -- but this is not a validated waste-stream measurement.",
      relevantOutputs: headline?.food_loss_effect != null ? `food_loss_effect = ${headline.food_loss_effect} (this scenario)` : "food_loss_effect (only when loss_reduction_pct is supplied)",
      relevantData: "Caller-supplied loss_reduction_pct parameter only -- no waste-stream or post-harvest-loss dataset is ingested.",
      relevantMethod: "Deterministic proxy calculation in backend/intervention",
      evidenceProvenance: "/interventions/provenance",
      limitations: "No independent food-loss or waste-stream measurement exists. The figure shown is a deterministic function of a caller-supplied assumption, not observed data.",
    },
    {
      number: 13,
      name: SDG_NAMES[13],
      role: "secondary",
      status: "directly_modeled",
      relationship:
        "The platform's core risk engine scores climate stress (rainfall deficit and heat-stress anomalies against a NASA POWER climatology baseline) for every district, always -- this is not scenario-dependent. Where a portfolio also supplies a carbon_impact_tco2e accounting figure, that is surfaced too, but the climate-stress modeling itself is always active.",
      relevantOutputs: `Risk drivers (rainfall_deficit, heat_stress anomaly %)${headline?.carbon_impact_tco2e != null ? `; carbon_impact_tco2e = ${headline.carbon_impact_tco2e} (this scenario)` : ""}`,
      relevantData: "NASA POWER daily climate signals (precipitation, T2M mean/max) against a multi-year climatology baseline",
      relevantMethod: "Deterministic anomaly-based risk scoring (backend/risk)",
      evidenceProvenance: "/risk/provenance",
      limitations: "This is a transparent climate-STRESS proxy, not a climate-change attribution study or an emissions/carbon-accounting model. Carbon figures, when shown, are caller-supplied inputs, not independently estimated.",
    },
    {
      number: 15,
      name: SDG_NAMES[15],
      role: "secondary",
      status: "not_modeled",
      relationship: "Ecosystem and biodiversity considerations are outside this platform's current scope, though land-based agricultural production is the starting point of the modeled food network.",
      relevantOutputs: "None -- production nodes are geography-level placeholders, not land-use or ecosystem data.",
      relevantData: "None ingested -- no NDVI, vegetation, or biodiversity dataset.",
      relevantMethod: "Not applicable.",
      evidenceProvenance: "Not applicable.",
      limitations: "No land-use, biodiversity, or ecosystem-health data exists anywhere in this platform. Vegetation/water-stress fields shown elsewhere in the product (Spatial Intelligence) are explicitly disclosed there as unavailable.",
    },
    {
      number: 17,
      name: SDG_NAMES[17],
      role: "secondary",
      status: "not_modeled",
      relationship:
        "The platform integrates several independent data domains (climate, GIS, food-network structure, intervention economics, simulation) behind one evidence and provenance framework, and its AI Copilot cites only this project's own disclosed methodology. That is a form of transparent, auditable system design -- but cross-sector partnership is a process-level goal that a per-scenario simulation cannot itself produce as an output.",
      relevantOutputs: "None as a per-scenario output.",
      relevantData: "Not applicable.",
      relevantMethod: "Not applicable.",
      evidenceProvenance: "/ai/provenance (evidence-corpus and tool-approval disclosure)",
      limitations: "A cross-sector partnership indicator cannot be computed by a simulation platform. Listed here to acknowledge the project's declared secondary SDGs honestly, not because any numeric output exists for it.",
    },
  ];
}
