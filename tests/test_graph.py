"""Hours 8-11 food network graph tests.

Covers: graph construction, node/edge typing, geography linkage,
food-category dimension, provenance, truth-status handling, deterministic
centrality/bottleneck calculations, shock propagation, no-data behavior,
and invalid graph inputs.
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import networkx as nx
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.graph.contracts import GraphInput, ShockInput
from backend.graph.diagnostics import compute_bottlenecks, compute_connectivity_report
from backend.graph.graph_builder import get_food_graph
from backend.graph.propagation import propagate_shock
from backend.graph.service import build_graph_result

client = TestClient(app)

VALID_NODE_TYPES = {"production", "aggregation", "storage", "market", "demand"}
VALID_TRUTH_STATUS = {"OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"}


# --- graph construction ------------------------------------------------------


def test_food_graph_loads_and_has_five_layers():
    food_graph = get_food_graph()
    assert set(food_graph.layers) >= {"production", "aggregation", "storage", "market", "demand"}
    assert food_graph.graph.number_of_nodes() == 165
    assert food_graph.graph.number_of_edges() == 318


def test_graph_is_a_networkx_digraph():
    food_graph = get_food_graph()
    assert isinstance(food_graph.graph, nx.DiGraph)


# --- node/edge typing --------------------------------------------------------


def test_every_node_has_a_valid_node_type():
    food_graph = get_food_graph()
    for _, data in food_graph.graph.nodes(data=True):
        assert data["node_type"] in VALID_NODE_TYPES


def test_every_district_has_all_five_node_types():
    food_graph = get_food_graph()
    types_by_district: dict[str, set] = {}
    for _, data in food_graph.graph.nodes(data=True):
        types_by_district.setdefault(data["geo_id"], set()).add(data["node_type"])
    assert len(types_by_district) == 33
    for geo_id, types in types_by_district.items():
        assert types == VALID_NODE_TYPES, f"{geo_id} missing node types: {VALID_NODE_TYPES - types}"


def test_within_district_chain_edges_exist():
    food_graph = get_food_graph()
    assert food_graph.graph.has_edge("production_hyderabad", "aggregation_hyderabad")
    assert food_graph.graph.has_edge("aggregation_hyderabad", "storage_hyderabad")
    assert food_graph.graph.has_edge("storage_hyderabad", "market_hyderabad")
    assert food_graph.graph.has_edge("market_hyderabad", "demand_hyderabad")


# --- geography linkage --------------------------------------------------------


def test_every_node_geo_id_is_a_real_district():
    from backend.geoai.spatial_layer import get_registry

    registry = get_registry()
    valid_district_ids = set(registry.districts.gdf["district_id"])
    food_graph = get_food_graph()
    for _, data in food_graph.graph.nodes(data=True):
        assert data["geo_id"] in valid_district_ids


def test_hyderabad_is_flagged_as_principal_demand_hub():
    food_graph = get_food_graph()
    node = food_graph.node("demand_hyderabad")
    assert node["is_principal_demand_hub"] is True


def test_geo_filter_returns_only_that_districts_nodes_and_direct_neighbors():
    result = build_graph_result(GraphInput(geo_id="hyderabad"))
    hyderabad_nodes = [n for n in result.nodes if n.geo_id == "hyderabad"]
    assert len(hyderabad_nodes) == 5  # production, aggregation, storage, market, demand


def test_unknown_geo_id_filter_raises_keyerror():
    with pytest.raises(KeyError):
        build_graph_result(GraphInput(geo_id="not_a_real_district"))


# --- food-category dimension --------------------------------------------------


def test_all_configured_food_categories_return_a_result():
    from backend.risk.features import load_features_config

    config = load_features_config()
    for category in config["food_categories"]:
        result = build_graph_result(GraphInput(food_category=category, include_bottlenecks=False))
        assert result.summary["food_category"] == category
        assert result.summary["node_count"] == 165  # v0: every node supports every category


def test_unknown_food_category_rejected():
    with pytest.raises(ValueError):
        build_graph_result(GraphInput(food_category="not_a_real_category"))


def test_graph_overview_endpoint_rejects_unknown_food_category():
    resp = client.get("/graph/overview", params={"food_category": "not_a_real_category"})
    assert resp.status_code == 400


# --- provenance ---------------------------------------------------------------


def test_graph_provenance_endpoint_has_required_fields():
    resp = client.get("/graph/provenance")
    assert resp.status_code == 200
    body = resp.json()
    required_fields = {
        "dataset_name",
        "publisher",
        "source_url",
        "access_date",
        "license",
        "geographic_level",
        "crs",
        "processing",
        "truth_status",
        "limitations",
    }
    for dataset in body["datasets"]:
        assert required_fields <= set(dataset.keys())
    assert "unobtained_sources" in body  # honest disclosure of what wasn't obtained


def test_provenance_documents_agmarknet_as_unobtained():
    resp = client.get("/graph/provenance")
    names = [d["dataset_name"] for d in resp.json()["unobtained_sources"]]
    assert any("AGMARKNET" in n or "e-NAM" in n for n in names)


# --- truth-status handling -----------------------------------------------------


def test_every_node_and_edge_has_a_valid_truth_status():
    food_graph = get_food_graph()
    for _, data in food_graph.graph.nodes(data=True):
        assert data["truth_status"] in VALID_TRUTH_STATUS
    for _, _, data in food_graph.graph.edges(data=True):
        assert data["truth_status"] in VALID_TRUTH_STATUS


def test_real_market_nodes_are_observed_placeholders_are_simulated():
    food_graph = get_food_graph()
    market_nodes = [d for _, d in food_graph.graph.nodes(data=True) if d["node_type"] == "market"]
    truth_statuses = {d["truth_status"] for d in market_nodes}
    assert truth_statuses <= {"OBSERVED", "SIMULATED"}
    assert any(d["truth_status"] == "OBSERVED" for d in market_nodes)
    assert any(d["truth_status"] == "SIMULATED" for d in market_nodes)


def test_no_node_or_edge_has_a_fabricated_capacity():
    food_graph = get_food_graph()
    for _, data in food_graph.graph.nodes(data=True):
        assert data.get("capacity") is None
    for _, _, data in food_graph.graph.edges(data=True):
        assert data.get("weight") is None


# --- deterministic centrality / bottleneck calculations -------------------------


def test_bottleneck_computation_is_deterministic():
    food_graph = get_food_graph()
    result_a = compute_bottlenecks(food_graph.graph)
    result_b = compute_bottlenecks(food_graph.graph)
    assert [b.node_id for b in result_a] == [b.node_id for b in result_b]
    assert [b.betweenness_centrality for b in result_a] == [b.betweenness_centrality for b in result_b]


def test_bottleneck_entries_carry_graph_theoretic_language_not_real_world_claim():
    food_graph = get_food_graph()
    bottlenecks = compute_bottlenecks(food_graph.graph)
    assert bottlenecks
    for b in bottlenecks:
        assert "graph-theoretic" in b.note.lower()


def test_hyderabad_demand_hub_is_flagged_as_a_bottleneck():
    # Every non-hub district's market links to demand_hyderabad -> high in-degree/betweenness expected.
    food_graph = get_food_graph()
    bottlenecks = compute_bottlenecks(food_graph.graph)
    assert "demand_hyderabad" in {b.node_id for b in bottlenecks}


def test_connectivity_report_reflects_a_single_weakly_connected_graph():
    food_graph = get_food_graph()
    report = compute_connectivity_report(food_graph.graph)
    assert report["is_weakly_connected"] is True
    assert report["weakly_connected_component_count"] == 1


# --- shock propagation -----------------------------------------------------------


def test_propagation_target_node_gets_full_severity():
    food_graph = get_food_graph()
    shock = ShockInput(target_node_id="production_hyderabad", shock_type="production_reduction", severity=0.8)
    result = propagate_shock(food_graph.graph, shock)
    target_step = next(s for s in result.steps if s.node_id == "production_hyderabad")
    assert target_step.impact_fraction == 0.8
    assert target_step.hop_distance == 0


def test_propagation_decays_with_hop_distance():
    food_graph = get_food_graph()
    shock = ShockInput(target_node_id="production_hyderabad", shock_type="production_reduction", severity=1.0)
    result = propagate_shock(food_graph.graph, shock)
    by_id = {s.node_id: s for s in result.steps}
    assert by_id["aggregation_hyderabad"].impact_fraction < by_id["production_hyderabad"].impact_fraction
    assert by_id["storage_hyderabad"].impact_fraction < by_id["aggregation_hyderabad"].impact_fraction


def test_propagation_result_is_labeled_simulated():
    food_graph = get_food_graph()
    shock = ShockInput(target_node_id="market_khammam", shock_type="market_disruption", severity=0.5)
    result = propagate_shock(food_graph.graph, shock)
    assert result.truth_status == "SIMULATED"
    assert all(s.truth_status == "SIMULATED" for s in result.steps)


def test_propagation_reaches_hyderabad_hub_from_a_remote_market():
    food_graph = get_food_graph()
    shock = ShockInput(
        target_node_id="market_adilabad", shock_type="market_disruption", severity=1.0, max_hops=5
    )
    result = propagate_shock(food_graph.graph, shock)
    assert "hyderabad" in result.impacted_geographies


def test_propagation_endpoint_returns_impacted_geographies():
    resp = client.post(
        "/graph/propagate",
        json={"target_node_id": "storage_khammam", "shock_type": "storage_capacity_reduction", "severity": 0.6},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "khammam" in body["impacted_geographies"]
    assert body["truth_status"] == "SIMULATED"


# --- no-data behavior / invalid inputs --------------------------------------------


def test_propagation_unknown_target_node_raises_keyerror():
    food_graph = get_food_graph()
    shock = ShockInput(target_node_id="not_a_real_node", shock_type="production_reduction", severity=0.5)
    with pytest.raises(KeyError):
        propagate_shock(food_graph.graph, shock)


def test_propagation_endpoint_404_for_unknown_node():
    resp = client.post(
        "/graph/propagate",
        json={"target_node_id": "not_a_real_node", "shock_type": "production_reduction", "severity": 0.5},
    )
    assert resp.status_code == 404


def test_propagation_severity_out_of_range_rejected_by_schema():
    resp = client.post(
        "/graph/propagate",
        json={"target_node_id": "production_hyderabad", "shock_type": "production_reduction", "severity": "not_a_number"},
    )
    assert resp.status_code == 422


def test_empty_graph_bottlenecks_returns_empty_list():
    empty_graph = nx.DiGraph()
    assert compute_bottlenecks(empty_graph) == []


def test_graph_nodes_endpoint_empty_geo_filter_404s():
    resp = client.get("/graph/nodes", params={"geo_id": "not_a_real_district"})
    assert resp.status_code == 404
