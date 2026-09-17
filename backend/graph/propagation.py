"""Deterministic shock propagation over the food-system graph.

This is a modeled cascade, not a forecast or a measured historical effect.
Every result is labeled truth_status=SIMULATED. The decay mechanism (a
constant per-hop multiplier, config/graph.yaml) is a documented, assumed
simplification -- there is no observed elasticity/transfer-coefficient
dataset for Telangana's food system this sprint to calibrate it against.
"""
from __future__ import annotations

from collections import deque

import networkx as nx

from backend.graph.config import load_graph_config
from backend.graph.contracts import PropagationResult, PropagationStep, ShockInput

METHOD_DESCRIPTION = (
    "Breadth-first traversal downstream from the shocked node along directed graph edges. "
    "The target node's impact_fraction is set to the shock severity; each hop away multiplies the "
    "impact by a fixed decay_factor (config/graph.yaml). A node reachable via multiple paths keeps "
    "the maximum impact_fraction found. Propagation stops at max_hops or once impact falls below "
    "min_impact_threshold. This models directional dependency structure only -- it does not account "
    "for real substitution, buffering/inventory, or elasticity effects, none of which are in scope "
    "without observed data."
)


def propagate_shock(graph: nx.DiGraph, shock: ShockInput) -> PropagationResult:
    config = load_graph_config()["propagation"]
    decay_factor = config["decay_factor"]
    min_threshold = config["min_impact_threshold"]

    if shock.target_node_id not in graph.nodes:
        raise KeyError(f"target_node_id '{shock.target_node_id}' is not a known node in the food graph")

    impacts: dict[str, float] = {shock.target_node_id: shock.severity}
    hop_of: dict[str, int] = {shock.target_node_id: 0}
    queue = deque([shock.target_node_id])

    while queue:
        current = queue.popleft()
        current_hop = hop_of[current]
        current_impact = impacts[current]
        if current_hop >= shock.max_hops:
            continue

        for successor in graph.successors(current):
            propagated_impact = current_impact * decay_factor
            if propagated_impact < min_threshold:
                continue
            if propagated_impact <= impacts.get(successor, 0.0):
                continue  # already have an equal-or-larger impact via a shorter/stronger path
            impacts[successor] = propagated_impact
            hop_of[successor] = current_hop + 1
            queue.append(successor)

    steps = []
    impacted_geo_ids = set()
    impacted_food_categories = set()
    for node_id, impact in impacts.items():
        data = graph.nodes[node_id]
        steps.append(
            PropagationStep(
                node_id=node_id,
                node_type=data.get("node_type", "unknown"),
                geo_id=data.get("geo_id", "unknown"),
                hop_distance=hop_of[node_id],
                impact_fraction=round(impact, 4),
            )
        )
        impacted_geo_ids.add(data.get("geo_id", "unknown"))
        impacted_food_categories.update(data.get("food_categories", []))

    steps.sort(key=lambda s: (s.hop_distance, -s.impact_fraction))

    return PropagationResult(
        shock=shock,
        steps=steps,
        impacted_geographies=sorted(impacted_geo_ids),
        impacted_food_categories=sorted(impacted_food_categories),
        method=METHOD_DESCRIPTION,
        limitations=[
            "Simulated cascade over modeled dependency edges, not a measured or forecast real-world effect.",
            f"decay_factor={decay_factor} and min_impact_threshold={min_threshold} (config/graph.yaml) are "
            "assumed modeling choices, not fit to observed shock/outcome data.",
            "Does not model substitution, inventory buffering, price response, or real transport/storage "
            "capacity limits -- most edges in the graph carry no observed capacity/flow weight this sprint.",
        ],
    )
