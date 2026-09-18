"""GraphInput -> GraphResult contract for the food-system network layer.

Mirrors the RiskInput/RiskResult pattern from backend/risk/contracts.py.
Nodes/edges carry `extra="allow"` because optional fields differ by type
(e.g. lon/lat on market nodes, is_principal_demand_hub on demand nodes) --
see data/processed/food_graph.json for the concrete shapes.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]
NodeType = Literal["production", "aggregation", "storage", "market", "demand"]


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="allow")

    node_id: str
    node_type: NodeType
    geo_id: str
    geo_level: str
    name: str
    food_categories: list[str]
    capacity: Optional[float] = None
    truth_status: TruthStatus
    provenance: str


class GraphEdge(BaseModel):
    model_config = ConfigDict(extra="allow")

    edge_id: str
    source: str
    target: str
    edge_type: str
    food_categories: list[str]
    weight: Optional[float] = None
    truth_status: TruthStatus
    provenance: str


class GraphInput(BaseModel):
    food_category: str = "all_food"
    geo_id: Optional[str] = None  # filter to a district's nodes (+ its direct transport neighbors)
    include_bottlenecks: bool = True


class BottleneckEntry(BaseModel):
    node_id: str
    node_type: str
    geo_id: str
    degree: int
    weighted_degree: Optional[float] = None
    betweenness_centrality: float
    is_articulation_point: bool
    note: str


class GraphResult(BaseModel):
    summary: dict
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    bottlenecks: list[BottleneckEntry]
    impacted_geographies: list[str]
    impacted_food_categories: list[str]
    provenance_refs: list[str]
    truth_status: str
    limitations: list[str]


class ShockInput(BaseModel):
    target_node_id: str
    shock_type: Literal["production_reduction", "storage_capacity_reduction", "transport_capacity_reduction", "market_disruption"]
    severity: float = Field(ge=0.0, le=1.0)  # fraction of capacity/throughput removed at the target node
    max_hops: int = 5


class PropagationStep(BaseModel):
    node_id: str
    node_type: str
    geo_id: str
    hop_distance: int
    impact_fraction: float  # 0.0-1.0, modeled residual impact at this node
    truth_status: Literal["SIMULATED"] = "SIMULATED"


class PropagationResult(BaseModel):
    shock: ShockInput
    steps: list[PropagationStep]
    impacted_geographies: list[str]
    impacted_food_categories: list[str]
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    method: str
    limitations: list[str]
