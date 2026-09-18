import type { GraphShockType, ShockComposerRequest, ShockInput } from "@/lib/api";

// Mirrors backend/intervention/shock_composer.py's GRAPH_SHOCK_FIELD_MAP.
// ShockComposerInput (used for /interventions/shock, the impact preview)
// can carry several simultaneous graph fields; InterventionInput/
// PortfolioInput/OptimizationInput take exactly ONE graph ShockInput, so the
// Intervention Lab restricts the user to one graph shock field at a time --
// the same one that drives interventions, portfolio, and optimization.
export type GraphShockField =
  | "production_disruption"
  | "storage_capacity_reduction"
  | "transport_capacity_reduction"
  | "market_demand_disruption";

export const GRAPH_SHOCK_FIELD_MAP: Record<GraphShockField, { targetPrefix: string; shockType: GraphShockType; label: string }> = {
  production_disruption: { targetPrefix: "production", shockType: "production_reduction", label: "Production disruption" },
  storage_capacity_reduction: { targetPrefix: "storage", shockType: "storage_capacity_reduction", label: "Storage capacity reduction" },
  transport_capacity_reduction: { targetPrefix: "market", shockType: "transport_capacity_reduction", label: "Transport capacity reduction" },
  market_demand_disruption: { targetPrefix: "demand", shockType: "market_disruption", label: "Market/demand disruption" },
};

// Explicit per-field assignment avoids relying on TS's narrower inference
// rules for a computed property key typed as a string-literal union.
export function withGraphShockField(base: ShockComposerRequest, field: GraphShockField, severity: number): ShockComposerRequest {
  switch (field) {
    case "production_disruption":
      return { ...base, production_disruption: severity };
    case "storage_capacity_reduction":
      return { ...base, storage_capacity_reduction: severity };
    case "transport_capacity_reduction":
      return { ...base, transport_capacity_reduction: severity };
    case "market_demand_disruption":
      return { ...base, market_demand_disruption: severity };
  }
}

export function buildGraphShockInput(geoId: string, field: GraphShockField, severity: number, maxHops: number): ShockInput {
  const { targetPrefix, shockType } = GRAPH_SHOCK_FIELD_MAP[field];
  return {
    target_node_id: `${targetPrefix}_${geoId}`,
    shock_type: shockType,
    severity,
    max_hops: maxHops,
  };
}

// A plausible starting shock field for a clicked graph node, purely a UI
// convenience default -- the field remains a separate, explicit control
// because the backend's own GRAPH_SHOCK_FIELD_MAP already routes
// transport_capacity_reduction at the market_{geo} node, so no single
// node-type -> shock-type inference could ever reach all four fields.
export function defaultShockFieldForNodeType(nodeType: "production" | "aggregation" | "storage" | "market" | "demand"): GraphShockField {
  switch (nodeType) {
    case "production":
    case "aggregation":
      return "production_disruption";
    case "storage":
      return "storage_capacity_reduction";
    case "market":
    case "demand":
      return "market_demand_disruption";
  }
}
