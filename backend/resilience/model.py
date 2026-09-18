"""Deterministic resilience proxy. Reuses (does not modify) the existing
risk engine and food graph: transport redundancy and bottleneck status come
from backend/graph, the climate-risk component from backend/risk.

RESILIENCE != RISK: risk_score measures current disruption likelihood;
this measures modeled capacity to absorb/maintain/recover, from
independent structural signals (not just 1 - risk_score).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

from backend.geoai.spatial_layer import get_registry
from backend.graph.diagnostics import compute_bottlenecks
from backend.graph.graph_builder import get_food_graph
from backend.resilience.contracts import ResilienceComponent, ResilienceResult
from backend.risk.baseline_model import get_risk
from backend.risk.contracts import RiskInput

REPO_ROOT = Path(__file__).resolve().parents[2]
RESILIENCE_CONFIG_PATH = REPO_ROOT / "config" / "resilience.yaml"

NEUTRAL_RISK_FALLBACK = 0.5  # used only if risk_score is unavailable (insufficient_data); documented in limitations


@lru_cache(maxsize=1)
def load_resilience_config() -> dict:
    with open(RESILIENCE_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def resolve_district_id(geo_id: str) -> tuple[str, str, str]:
    """Returns (district_id, geo_level, resolved_via), mirroring the risk
    engine's mandal-inherits-parent-district resolution."""
    registry = get_registry()
    if registry.districts.get(geo_id) is not None:
        return geo_id, "district", "district_direct"
    mandal = registry.mandals.get(geo_id)
    if mandal is not None:
        return mandal["district_id"], "mandal", f"inherited_from_parent_district:{mandal['district_id']}"
    raise KeyError(f"geo_id '{geo_id}' is not a known district_id or mandal_id")


def _transport_redundancy(district_id: str) -> tuple[float, int, int]:
    food_graph = get_food_graph()
    all_district_ids = sorted({d["geo_id"] for _, d in food_graph.graph.nodes(data=True)})
    degrees = {}
    for did in all_district_ids:
        node_id = f"market_{did}"
        degrees[did] = sum(
            1 for _, _, d in food_graph.graph.out_edges(node_id, data=True) if d.get("edge_type") == "transport_link"
        )
    max_degree = max(degrees.values()) if degrees else 0
    this_degree = degrees.get(district_id, 0)
    normalized = round(this_degree / max_degree, 4) if max_degree > 0 else 0.0
    return normalized, this_degree, max_degree


def compute_resilience(geo_id: str, food_category: str = "all_food", risk_score_override: Optional[float] = None) -> ResilienceResult:
    district_id, geo_level, resolved_via = resolve_district_id(geo_id)
    config = load_resilience_config()["resilience_model"]
    weights = config["weights"]

    food_graph = get_food_graph()
    market_node_id = f"market_{district_id}"
    bottleneck_ids = {b.node_id for b in compute_bottlenecks(food_graph.graph)}
    is_bottleneck = market_node_id in bottleneck_ids

    redundancy_value, this_degree, max_degree = _transport_redundancy(district_id)
    non_bottleneck_value = config["bottleneck_penalty"] if is_bottleneck else 1.0

    limitations = [
        "Resilience is a documented composite proxy (transport redundancy + graph-theoretic bottleneck "
        "status + inverse climate risk), not a fitted or externally validated resilience index -- no such "
        "dataset exists for this sprint.",
        f"target_resilience_score ({load_resilience_config()['resilience_model']['target_resilience_score']}) "
        "is an assumed demonstration target, not an official policy target.",
        "Transport redundancy uses the modeled district-adjacency transport backbone (backend/graph), not "
        "real road capacity or actual alternate-route travel times.",
    ]
    if geo_level != "district":
        limitations.append(f"Requested geo_level is '{geo_level}'; resilience is inherited from {resolved_via}.")

    if risk_score_override is not None:
        risk_score = risk_score_override
        risk_note = "Using a provided risk_score override (e.g. a shocked/counterfactual scenario), not a fresh baseline risk lookup."
    else:
        risk_result = get_risk(RiskInput(geo_id=district_id, food_category=food_category))
        if risk_result.risk_score is not None:
            risk_score = risk_result.risk_score
            risk_note = "From the current baseline risk engine (backend/risk)."
        else:
            risk_score = NEUTRAL_RISK_FALLBACK
            risk_note = f"Baseline risk_score unavailable (insufficient_data); a neutral {NEUTRAL_RISK_FALLBACK} value was substituted."
            limitations.append(risk_note)

    components = [
        ResilienceComponent(
            name="transport_redundancy",
            value=redundancy_value,
            weight=weights["transport_redundancy"],
            contribution=round(weights["transport_redundancy"] * redundancy_value, 4),
            note=f"{this_degree} of max {max_degree} transport-adjacent neighbor districts (normalized).",
        ),
        ResilienceComponent(
            name="non_bottleneck",
            value=non_bottleneck_value,
            weight=weights["non_bottleneck"],
            contribution=round(weights["non_bottleneck"] * non_bottleneck_value, 4),
            note=f"Market node {'IS' if is_bottleneck else 'is NOT'} a graph-theoretic candidate bottleneck (backend/graph/diagnostics.py).",
        ),
        ResilienceComponent(
            name="inverse_climate_risk",
            value=round(1 - risk_score, 4),
            weight=weights["inverse_climate_risk"],
            contribution=round(weights["inverse_climate_risk"] * (1 - risk_score), 4),
            note=risk_note,
        ),
    ]

    current_score = round(min(1.0, max(0.0, sum(c.contribution for c in components))), 4)
    target = load_resilience_config()["resilience_model"]["target_resilience_score"]

    return ResilienceResult(
        region_id=geo_id,
        geo_level=geo_level,
        food_scope=food_category,
        current_resilience_score=current_score,
        target_resilience_score=target,
        resilience_gap=round(target - current_score, 4),
        components=components,
        model_version=config["model_version"],
        truth_status="ESTIMATED",
        provenance_refs=["backend/graph food network graph", "backend/risk climate-stress baseline"],
        limitations=limitations,
    )
