"""Orchestrates graph_builder + diagnostics into the GraphInput -> GraphResult
contract used by the API."""
from __future__ import annotations

from collections import Counter

from backend.graph.contracts import GraphEdge, GraphInput, GraphNode, GraphResult
from backend.graph.diagnostics import compute_bottlenecks, compute_connectivity_report
from backend.graph.graph_builder import get_food_graph
from backend.risk.features import load_features_config

GRAPH_LIMITATIONS = [
    "Production/aggregation/storage/demand nodes are largely SIMULATED scenario placeholders or DERIVED "
    "from administrative geography, not real named facilities -- no facility-level dataset was obtained "
    "this sprint (see /graph/provenance for exactly what was and was not obtainable).",
    "Market nodes are OBSERVED (real OpenStreetMap points) where one exists in a district, otherwise a "
    "SIMULATED placeholder; see each node's truth_status.",
    "No edge in the graph carries a real observed flow volume or transport capacity -- weighted-degree "
    "diagnostics and any capacity-based analysis are therefore not available this sprint.",
    "The same food_categories value applies to every node/edge; no food-category-specific network "
    "differentiation (e.g. which markets trade which commodities) is implemented yet.",
    "Bottleneck flags are graph-theoretic (structural) properties of the modeled network, not confirmed "
    "real-world operational bottlenecks -- see each bottleneck entry's note.",
]


def build_graph_result(inp: GraphInput) -> GraphResult:
    config = load_features_config()
    if inp.food_category not in config["food_categories"]:
        raise ValueError(f"Unknown food_category '{inp.food_category}'. Configured: {config['food_categories']}")

    food_graph = get_food_graph()
    if inp.geo_id is not None and not any(
        d.get("geo_id") == inp.geo_id for _, d in food_graph.graph.nodes(data=True)
    ):
        raise KeyError(f"geo_id '{inp.geo_id}' has no nodes in the food graph")

    subgraph = food_graph.filtered_subgraph(inp.food_category, inp.geo_id)

    nodes = [GraphNode(**data) for _, data in subgraph.nodes(data=True)]
    edges = [GraphEdge(**data) for _, _, data in subgraph.edges(data=True)]

    bottlenecks = compute_bottlenecks(subgraph) if inp.include_bottlenecks else []
    connectivity = compute_connectivity_report(subgraph)

    node_truth_counts = Counter(n.truth_status for n in nodes)
    edge_truth_counts = Counter(e.truth_status for e in edges)

    summary = {
        "food_category": inp.food_category,
        "geo_id_filter": inp.geo_id,
        "layers": food_graph.layers,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "node_truth_status_counts": dict(node_truth_counts),
        "edge_truth_status_counts": dict(edge_truth_counts),
        "connectivity": connectivity,
    }

    impacted_geographies = sorted({n.geo_id for n in nodes})
    impacted_food_categories = sorted({fc for n in nodes for fc in n.food_categories})

    return GraphResult(
        summary=summary,
        nodes=nodes,
        edges=edges,
        bottlenecks=bottlenecks,
        impacted_geographies=impacted_geographies,
        impacted_food_categories=impacted_food_categories,
        provenance_refs=[
            "OpenStreetMap marketplace points of interest (Telangana)",
            "District adjacency (transport backbone)",
        ],
        truth_status="DERIVED",  # the graph as a whole is a constructed mix; see per-node/edge truth_status
        limitations=GRAPH_LIMITATIONS,
    )
