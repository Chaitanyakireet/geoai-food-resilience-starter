"""Deterministic graph-theoretic diagnostics: degree, betweenness centrality,
connectivity/components, and candidate-bottleneck identification.

IMPORTANT SCIENTIFIC BOUNDARY: everything here is a graph-theoretic property
of the modeled network (backend/graph/graph_builder.py), not a measurement
of real-world food-system importance. A node flagged here is a "modeled
dependency" / "graph-theoretic bottleneck" candidate -- whether it matters
operationally depends on real capacity/flow data this sprint does not have
(most edges carry no observed weight; see truth_status per node/edge).
"""
from __future__ import annotations

import networkx as nx

from backend.graph.config import load_graph_config
from backend.graph.contracts import BottleneckEntry


def compute_connectivity_report(graph: nx.DiGraph) -> dict:
    undirected = graph.to_undirected()
    components = list(nx.connected_components(undirected))
    return {
        "is_weakly_connected": nx.is_weakly_connected(graph) if graph.number_of_nodes() else False,
        "weakly_connected_component_count": nx.number_weakly_connected_components(graph),
        "component_sizes": sorted((len(c) for c in components), reverse=True),
        "isolated_node_count": sum(1 for c in components if len(c) == 1),
    }


def compute_bottlenecks(graph: nx.DiGraph) -> list[BottleneckEntry]:
    """Graph-theoretic candidate bottlenecks, flagged for any of three
    independent reasons:
      - articulation point: removing it disconnects the underlying undirected graph.
      - high betweenness centrality: lies on many shortest paths BETWEEN OTHER node pairs.
      - high in-degree ("dependency concentration"): many nodes directly feed into it.

    These are deliberately kept separate: a pure sink node (e.g. a demand hub
    with no outgoing edges) can have zero betweenness by definition -- it can
    never sit "between" two other nodes on a shortest path -- even while many
    other nodes depend on it directly. Betweenness alone would miss that;
    in-degree concentration is what surfaces it.
    """
    if graph.number_of_nodes() == 0:
        return []

    undirected = graph.to_undirected()
    articulation_points = set(nx.articulation_points(undirected)) if nx.is_connected(undirected) else set()
    if not nx.is_connected(undirected):
        # articulation_points() requires a connected graph; run per-component.
        articulation_points = set()
        for component in nx.connected_components(undirected):
            sub = undirected.subgraph(component)
            if len(component) > 2:
                articulation_points.update(nx.articulation_points(sub))

    bottleneck_config = load_graph_config()["bottleneck_analysis"]

    betweenness = nx.betweenness_centrality(graph, normalized=True)
    betweenness_threshold = _top_percentile_threshold(
        betweenness.values(), bottleneck_config["betweenness_candidate_percentile"]
    )

    in_degrees = dict(graph.in_degree())
    in_degree_threshold = _top_percentile_threshold(
        in_degrees.values(), bottleneck_config["in_degree_candidate_percentile"]
    )

    entries: list[BottleneckEntry] = []
    for node_id, data in graph.nodes(data=True):
        degree = graph.in_degree(node_id) + graph.out_degree(node_id)
        is_articulation = node_id in articulation_points
        is_high_betweenness = betweenness[node_id] >= betweenness_threshold and betweenness[node_id] > 0
        is_high_in_degree = in_degrees[node_id] >= in_degree_threshold and in_degrees[node_id] > 0

        if not (is_articulation or is_high_betweenness or is_high_in_degree):
            continue

        reasons = []
        if is_articulation:
            reasons.append("articulation_point (its removal disconnects the modeled network)")
        if is_high_betweenness:
            reasons.append(f"high betweenness centrality ({betweenness[node_id]:.3f}, top quartile of nonzero values)")
        if is_high_in_degree:
            reasons.append(
                f"high dependency concentration (in-degree {in_degrees[node_id]}, top quartile of nonzero "
                "values -- many nodes feed directly into this one; note a pure sink can score 0 on "
                "betweenness despite this)"
            )

        entries.append(
            BottleneckEntry(
                node_id=node_id,
                node_type=data.get("node_type", "unknown"),
                geo_id=data.get("geo_id", "unknown"),
                degree=degree,
                weighted_degree=None,  # no real edge-flow weights available this sprint
                betweenness_centrality=round(betweenness[node_id], 4),
                is_articulation_point=is_articulation,
                note="Graph-theoretic candidate bottleneck (" + "; ".join(reasons) + "). This describes the "
                "modeled network's structure, not confirmed real-world operational importance -- most edges "
                "here carry no observed capacity/flow weight.",
            )
        )

    entries.sort(key=lambda e: (e.betweenness_centrality, in_degrees[e.node_id]), reverse=True)
    return entries


def _top_percentile_threshold(values, percentile: float) -> float:
    nonzero_sorted = sorted((v for v in values if v > 0), reverse=True)
    if not nonzero_sorted:
        return float("inf")
    return nonzero_sorted[int(len(nonzero_sorted) * (1 - percentile))]
