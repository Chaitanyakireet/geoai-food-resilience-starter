"""Loads data/processed/food_graph.json (built by scripts/build_food_graph.py)
into a NetworkX directed graph. Single place later modules (optimization,
digital twin) load the food-system graph from."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

import networkx as nx

REPO_ROOT = Path(__file__).resolve().parents[2]
GRAPH_PATH = REPO_ROOT / "data" / "processed" / "food_graph.json"
PROVENANCE_PATH = REPO_ROOT / "data" / "processed" / "food_graph_provenance.json"


class FoodGraph:
    def __init__(self, raw: dict):
        self.raw = raw
        self.graph = nx.DiGraph()
        for node in raw["nodes"]:
            self.graph.add_node(node["node_id"], **node)
        for edge in raw["edges"]:
            self.graph.add_edge(edge["source"], edge["target"], **edge)

    @property
    def layers(self) -> list[str]:
        return self.raw["layers"]

    def node(self, node_id: str) -> Optional[dict]:
        if node_id not in self.graph.nodes:
            return None
        return dict(self.graph.nodes[node_id])

    def nodes_for_food_category(self, food_category: str) -> list[dict]:
        return [
            dict(data) for _, data in self.graph.nodes(data=True) if food_category in data.get("food_categories", [])
        ]

    def edges_for_food_category(self, food_category: str) -> list[dict]:
        return [
            dict(data)
            for _, _, data in self.graph.edges(data=True)
            if food_category in data.get("food_categories", [])
        ]

    def nodes_for_geo(self, geo_id: str) -> list[dict]:
        """Nodes in this geo_id plus nodes directly connected to them (one hop),
        so a district's local chain and its transport neighbors are all included."""
        direct = {n for n, data in self.graph.nodes(data=True) if data.get("geo_id") == geo_id}
        neighbors = set()
        for n in direct:
            neighbors.update(self.graph.predecessors(n))
            neighbors.update(self.graph.successors(n))
        return [dict(self.graph.nodes[n]) for n in direct | neighbors]

    def subgraph_for_food_category(self, food_category: str) -> nx.DiGraph:
        nodes = [n for n, data in self.graph.nodes(data=True) if food_category in data.get("food_categories", [])]
        return self.graph.subgraph(nodes).copy()

    def filtered_subgraph(self, food_category: str, geo_id: Optional[str] = None) -> nx.DiGraph:
        node_ids = {n for n, d in self.graph.nodes(data=True) if food_category in d.get("food_categories", [])}
        if geo_id:
            geo_node_ids = {n for n in node_ids if self.graph.nodes[n].get("geo_id") == geo_id}
            neighbor_ids = set()
            for n in geo_node_ids:
                neighbor_ids.update(self.graph.predecessors(n))
                neighbor_ids.update(self.graph.successors(n))
            node_ids = geo_node_ids | (neighbor_ids & node_ids)
        return self.graph.subgraph(node_ids).copy()


@lru_cache(maxsize=1)
def get_food_graph() -> FoodGraph:
    if not GRAPH_PATH.exists():
        raise FileNotFoundError(f"{GRAPH_PATH} not found -- run scripts/build_food_graph.py first")
    with open(GRAPH_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return FoodGraph(raw)


@lru_cache(maxsize=1)
def load_food_graph_provenance() -> dict:
    with open(PROVENANCE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
