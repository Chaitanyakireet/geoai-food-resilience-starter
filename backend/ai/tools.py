"""The eight approved AI tools. Every tool is a thin wrapper over an
EXISTING deterministic engine (backend/risk, backend/geoai, backend/graph,
backend/intervention, backend/optimization, backend/twin, backend/ai/
evidence) -- no tool recomputes or reimplements analytical logic. Each
returns a plain dict (already JSON-safe via `.model_dump()` on the
underlying Pydantic result) so the orchestrator can hand it to an LLM as a
tool_result or format it directly in the deterministic fallback path.

Tools never raise past this module for expected input errors (unknown
geo_id, invalid shock, etc.) -- they return {"error": "..."} so the
orchestrator can report a clean tool-call failure instead of crashing the
whole request.
"""
from __future__ import annotations

from typing import Any, Callable

from backend.ai.contracts import EvidenceQuery
from backend.ai.evidence import retrieve_evidence as _retrieve_evidence


def get_risk(geo_id: str, food_category: str = "all_food") -> dict:
    from backend.risk.baseline_model import get_risk as _get_risk
    from backend.risk.contracts import RiskInput

    try:
        result = _get_risk(RiskInput(geo_id=geo_id, food_category=food_category))
        return result.model_dump()
    except (KeyError, LookupError, ValueError) as exc:
        return {"error": str(exc)}


def inspect_location(geo_id: str, food_category: str = "all_food") -> dict:
    from backend.geoai.spatial_layer import get_registry
    from backend.resilience.model import compute_resilience
    from backend.risk.baseline_model import get_risk as _get_risk
    from backend.risk.contracts import RiskInput

    registry = get_registry()
    district = registry.districts.get(geo_id)
    mandal = registry.mandals.get(geo_id) if district is None else None
    if district is None and mandal is None:
        return {"error": f"geo_id '{geo_id}' is not a known district_id or mandal_id"}

    try:
        risk = _get_risk(RiskInput(geo_id=geo_id, food_category=food_category)).model_dump()
    except (KeyError, LookupError, ValueError) as exc:
        risk = {"error": str(exc)}

    try:
        resilience = compute_resilience(geo_id, food_category).model_dump()
    except (KeyError, LookupError, ValueError) as exc:
        resilience = {"error": str(exc)}

    return {
        "geo_id": geo_id,
        "geography": district or mandal,
        "geo_level": "district" if district else "mandal",
        "risk": risk,
        "resilience": resilience,
    }


def inspect_food_graph(geo_id: str | None = None, food_category: str = "all_food") -> dict:
    from backend.graph.contracts import GraphInput
    from backend.graph.service import build_graph_result

    try:
        result = build_graph_result(GraphInput(food_category=food_category, geo_id=geo_id, include_bottlenecks=True))
        dumped = result.model_dump()
        # Trim node/edge lists for LLM/tool-trace consumption -- the summary
        # and bottlenecks carry the analytical content; full lists are large.
        return {
            "summary": dumped["summary"],
            "bottlenecks": dumped["bottlenecks"][:10],
            "bottleneck_count": len(dumped["bottlenecks"]),
            "impacted_geographies": dumped["impacted_geographies"],
            "impacted_food_categories": dumped["impacted_food_categories"],
            "limitations": dumped["limitations"],
        }
    except (KeyError, ValueError) as exc:
        return {"error": str(exc)}


def simulate_shock(
    geo_id: str,
    food_category: str = "all_food",
    heat_change_c: float | None = None,
    rainfall_change_pct: float | None = None,
    production_disruption: float | None = None,
    storage_capacity_reduction: float | None = None,
    transport_capacity_reduction: float | None = None,
    market_demand_disruption: float | None = None,
    max_hops: int = 5,
) -> dict:
    from backend.intervention.contracts import ShockComposerInput
    from backend.intervention.shock_composer import build_shock_result

    try:
        result = build_shock_result(
            ShockComposerInput(
                geo_id=geo_id,
                food_category=food_category,
                heat_change_c=heat_change_c,
                rainfall_change_pct=rainfall_change_pct,
                production_disruption=production_disruption,
                storage_capacity_reduction=storage_capacity_reduction,
                transport_capacity_reduction=transport_capacity_reduction,
                market_demand_disruption=market_demand_disruption,
                max_hops=max_hops,
            )
        )
        return result.model_dump()
    except (KeyError, LookupError, ValueError) as exc:
        return {"error": str(exc)}


def test_intervention(
    target_node_id: str,
    shock_type: str,
    severity: float,
    intervention_type: str,
    max_hops: int = 5,
    effectiveness_override: float | None = None,
) -> dict:
    from backend.graph.contracts import ShockInput
    from backend.intervention.contracts import InterventionInput
    from backend.intervention.engine import compute_intervention_effect

    try:
        result = compute_intervention_effect(
            InterventionInput(
                shock=ShockInput(target_node_id=target_node_id, shock_type=shock_type, severity=severity, max_hops=max_hops),
                intervention_type=intervention_type,
                effectiveness_override=effectiveness_override,
            )
        )
        return result.model_dump()
    except (KeyError, ValueError) as exc:
        return {"error": str(exc)}


def run_optimization(
    target_node_id: str,
    shock_type: str,
    severity: float,
    candidate_intervention_types: list[str],
    max_hops: int = 5,
    budget: float | None = None,
    water_limit_m3: float | None = None,
    carbon_target_tco2e: float | None = None,
) -> dict:
    from backend.graph.contracts import ShockInput
    from backend.intervention.contracts import Constraints
    from backend.optimization.contracts import CandidateIntervention, OptimizationInput
    from backend.optimization.optimizer import run_optimization as _run_optimization

    try:
        constraints = Constraints(budget=budget, water_limit_m3=water_limit_m3, carbon_target_tco2e=carbon_target_tco2e)
        result = _run_optimization(
            OptimizationInput(
                shock=ShockInput(target_node_id=target_node_id, shock_type=shock_type, severity=severity, max_hops=max_hops),
                candidate_interventions=[CandidateIntervention(intervention_type=t) for t in candidate_intervention_types],
                constraints=constraints,
            )
        )
        dumped = result.model_dump()
        dumped["candidates"] = dumped["candidates"][:8]
        return dumped
    except (KeyError, ValueError) as exc:
        return {"error": str(exc)}


def calculate_impact(
    geo_id: str,
    food_category: str = "all_food",
    target_node_id: str | None = None,
    shock_type: str | None = None,
    severity: float | None = None,
    max_hops: int = 5,
    intervention_types: list[str] | None = None,
    optimize_candidate_types: list[str] | None = None,
) -> dict:
    """Runs the Digital Twin (baseline/shock/intervention/optimized states +
    recovery) for a scenario -- the authoritative source for food-
    availability/water/carbon/cost impact and recovery metrics."""
    from backend.graph.contracts import ShockInput
    from backend.optimization.contracts import CandidateIntervention
    from backend.twin.contracts import TwinScenario
    from backend.twin.engine import run_twin_scenario

    try:
        shock = ShockInput(target_node_id=target_node_id, shock_type=shock_type, severity=severity, max_hops=max_hops) if target_node_id else None
        portfolio = [CandidateIntervention(intervention_type=t) for t in intervention_types] if intervention_types else None
        candidates = [CandidateIntervention(intervention_type=t) for t in optimize_candidate_types] if optimize_candidate_types else None
        result = run_twin_scenario(
            TwinScenario(
                scenario_id="ai-tool-calculate-impact",
                geo_id=geo_id,
                food_category=food_category,
                shock=shock,
                intervention_portfolio=portfolio,
                optimize_candidates=candidates,
            )
        )
        return result.model_dump()
    except (KeyError, ValueError) as exc:
        return {"error": str(exc)}


def retrieve_evidence(query: str, top_k: int = 3, geo_id: str | None = None) -> dict:
    result = _retrieve_evidence(EvidenceQuery(query=query, top_k=top_k, geo_id=geo_id))
    return result.model_dump()


TOOL_REGISTRY: dict[str, Callable[..., dict]] = {
    "get_risk": get_risk,
    "inspect_location": inspect_location,
    "inspect_food_graph": inspect_food_graph,
    "simulate_shock": simulate_shock,
    "test_intervention": test_intervention,
    "run_optimization": run_optimization,
    "calculate_impact": calculate_impact,
    "retrieve_evidence": retrieve_evidence,
}


def summarize_tool_result(tool_name: str, result: dict) -> dict:
    """A compact, display-ready summary of a tool result for the tool trace
    and for the deterministic fallback's templated answer -- every field
    here is copied verbatim from the tool's own (deterministic-engine)
    output, never recomputed or rephrased into a new number."""
    if "error" in result:
        return {"error": result["error"]}

    if tool_name in ("get_risk",):
        return {"risk_class": result.get("risk_class"), "risk_score": result.get("risk_score"), "confidence": result.get("confidence"), "truth_status": result.get("truth_status")}
    if tool_name == "inspect_location":
        risk = result.get("risk", {})
        resilience = result.get("resilience", {})
        return {
            "geo_level": result.get("geo_level"),
            "risk_class": risk.get("risk_class"),
            "risk_score": risk.get("risk_score"),
            "risk_truth_status": risk.get("truth_status"),
            "resilience_score": resilience.get("current_resilience_score"),
            "resilience_gap": resilience.get("resilience_gap"),
            "resilience_truth_status": resilience.get("truth_status"),
        }
    if tool_name == "inspect_food_graph":
        summary = result.get("summary", {})
        return {"node_count": summary.get("node_count"), "edge_count": summary.get("edge_count"), "bottleneck_count": result.get("bottleneck_count"), "truth_status": result.get("truth_status", "SIMULATED")}
    if tool_name == "simulate_shock":
        shocked = result.get("shocked_resilience", {})
        shocked_risk = result.get("shocked_risk")
        return {
            "baseline_resilience": result.get("baseline_resilience", {}).get("current_resilience_score"),
            "shocked_resilience": shocked.get("current_resilience_score"),
            "resilience_gap": shocked.get("resilience_gap"),
            "propagated_nodes": sum(len(p.get("steps", [])) for p in result.get("graph_propagations", [])),
            "shocked_risk_truth_status": shocked_risk.get("truth_status") if shocked_risk else None,
            "truth_status": result.get("truth_status", "SIMULATED"),
        }
    if tool_name == "test_intervention":
        return {
            "intervention_label": result.get("intervention_label"),
            "effectiveness_used": result.get("effectiveness_used"),
            "effectiveness_source": result.get("effectiveness_source"),
            "food_availability_effect_proxy": result.get("modeled_change", {}).get("food_availability_effect_proxy"),
            "truth_status": result.get("truth_status", "SIMULATED"),
        }
    if tool_name == "run_optimization":
        selected = result.get("selected_candidate")
        return {
            "feasible_candidate_count": result.get("feasible_candidate_count"),
            "infeasible_candidate_count": result.get("infeasible_candidate_count"),
            "selected_intervention_types": selected.get("intervention_types") if selected else None,
            "why_feasible": (result.get("explanation") or {}).get("why_feasible"),
            "truth_status": result.get("truth_status", "SIMULATED"),
        }
    if tool_name == "calculate_impact":
        shocked = result.get("shocked_state") or {}
        optimized = result.get("optimized_state") or {}
        return {
            "shocked_resilience_gap": shocked.get("resilience_gap"),
            "optimized_resilience_gap": optimized.get("resilience_gap"),
            "optimized_food_availability_effect_proxy": optimized.get("food_availability_effect_proxy"),
            "recovery_time_days": (result.get("optimized_recovery_metrics") or result.get("shock_recovery_metrics") or {}).get("recovery_time_days"),
            "truth_status": result.get("truth_status", "SIMULATED"),
        }
    if tool_name == "retrieve_evidence":
        return {"found": result.get("found"), "match_count": len(result.get("matches", [])), "sources": [m["source_name"] for m in result.get("matches", [])]}
    return result


def invoke_tool(tool_name: str, arguments: dict) -> tuple[dict, str | None]:
    """Returns (result, error). `error` is set (and result is {}) if the
    tool name is unknown or the call raises for a reason not already
    handled inside the tool (malformed argument types, etc.)."""
    tool = TOOL_REGISTRY.get(tool_name)
    if tool is None:
        return {}, f"Unknown tool '{tool_name}'. Approved tools: {', '.join(TOOL_REGISTRY)}."
    try:
        result: dict[str, Any] = tool(**arguments)
    except TypeError as exc:
        return {}, f"Malformed arguments for '{tool_name}': {exc}"
    if isinstance(result, dict) and "error" in result and len(result) == 1:
        return result, result["error"]
    return result, None


# JSON Schema tool definitions for LLM function-calling (Anthropic Messages
# API `tools` format). Kept alongside TOOL_REGISTRY so the schema can never
# drift from what invoke_tool() actually accepts.
TOOL_SCHEMAS: list[dict] = [
    {
        "name": "get_risk",
        "description": "Get the current deterministic climate-stress risk baseline for a district or mandal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "geo_id": {"type": "string", "description": "district_id or mandal_id"},
                "food_category": {"type": "string", "default": "all_food"},
            },
            "required": ["geo_id"],
        },
    },
    {
        "name": "inspect_location",
        "description": "Get combined geography + risk + resilience context for a district or mandal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "geo_id": {"type": "string"},
                "food_category": {"type": "string", "default": "all_food"},
            },
            "required": ["geo_id"],
        },
    },
    {
        "name": "inspect_food_graph",
        "description": "Get food-network graph summary and structural bottlenecks, optionally filtered to one district.",
        "input_schema": {
            "type": "object",
            "properties": {
                "geo_id": {"type": "string", "description": "optional district_id filter"},
                "food_category": {"type": "string", "default": "all_food"},
            },
        },
    },
    {
        "name": "simulate_shock",
        "description": "Compose a scenario shock (climate and/or graph fields) and get modeled baseline/shocked risk, resilience, and graph propagation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "geo_id": {"type": "string"},
                "food_category": {"type": "string", "default": "all_food"},
                "heat_change_c": {"type": "number"},
                "rainfall_change_pct": {"type": "number"},
                "production_disruption": {"type": "number", "minimum": 0, "maximum": 1},
                "storage_capacity_reduction": {"type": "number", "minimum": 0, "maximum": 1},
                "transport_capacity_reduction": {"type": "number", "minimum": 0, "maximum": 1},
                "market_demand_disruption": {"type": "number", "minimum": 0, "maximum": 1},
                "max_hops": {"type": "integer", "default": 5},
            },
            "required": ["geo_id"],
        },
    },
    {
        "name": "test_intervention",
        "description": "Test one intervention type against one graph shock and get its modeled effect.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_node_id": {"type": "string", "description": "e.g. production_hyderabad"},
                "shock_type": {"type": "string", "enum": ["production_reduction", "storage_capacity_reduction", "transport_capacity_reduction", "market_disruption"]},
                "severity": {"type": "number", "minimum": 0, "maximum": 1},
                "intervention_type": {"type": "string", "enum": ["alternative_sourcing", "storage_redistribution", "route_diversification", "resource_efficiency"]},
                "max_hops": {"type": "integer", "default": 5},
                "effectiveness_override": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "required": ["target_node_id", "shock_type", "severity", "intervention_type"],
        },
    },
    {
        "name": "run_optimization",
        "description": "Search combinations of candidate interventions against one graph shock and return the modeled-best feasible portfolio under given constraints.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_node_id": {"type": "string"},
                "shock_type": {"type": "string", "enum": ["production_reduction", "storage_capacity_reduction", "transport_capacity_reduction", "market_disruption"]},
                "severity": {"type": "number", "minimum": 0, "maximum": 1},
                "candidate_intervention_types": {"type": "array", "items": {"type": "string"}},
                "max_hops": {"type": "integer", "default": 5},
                "budget": {"type": "number"},
                "water_limit_m3": {"type": "number"},
                "carbon_target_tco2e": {"type": "number"},
            },
            "required": ["target_node_id", "shock_type", "severity", "candidate_intervention_types"],
        },
    },
    {
        "name": "calculate_impact",
        "description": "Run the Digital Twin for a scenario (baseline/shock/intervention/optimized states + recovery trajectory) -- the authoritative source for food-availability/water/carbon/cost impact and recovery metrics.",
        "input_schema": {
            "type": "object",
            "properties": {
                "geo_id": {"type": "string"},
                "food_category": {"type": "string", "default": "all_food"},
                "target_node_id": {"type": "string"},
                "shock_type": {"type": "string", "enum": ["production_reduction", "storage_capacity_reduction", "transport_capacity_reduction", "market_disruption"]},
                "severity": {"type": "number", "minimum": 0, "maximum": 1},
                "max_hops": {"type": "integer", "default": 5},
                "intervention_types": {"type": "array", "items": {"type": "string"}, "description": "manual/alternative portfolio"},
                "optimize_candidate_types": {"type": "array", "items": {"type": "string"}, "description": "candidate pool for the Twin's own optimizer"},
            },
            "required": ["geo_id"],
        },
    },
    {
        "name": "retrieve_evidence",
        "description": "Retrieve supporting evidence from the project's own provenance/config/methodology documents (GIS, NASA POWER, risk/graph/intervention/optimization/twin methodology, project locks). Returns 'found: false' if nothing matches -- never fabricate a source when this happens.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer", "default": 3},
                "geo_id": {"type": "string"},
            },
            "required": ["query"],
        },
    },
]
