"""Food Network API contract: graph overview, nodes/edges, bottlenecks,
food-category/geography filtering, shock propagation, and provenance.

Every response is either a direct read of the constructed food graph
(backend/graph/graph_builder.py, built from data/processed/food_graph.json)
or a deterministic diagnostic/simulation over it. No LLM involvement.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.graph.contracts import GraphInput, GraphResult, PropagationResult, ShockInput
from backend.graph.graph_builder import get_food_graph, load_food_graph_provenance
from backend.graph.propagation import propagate_shock
from backend.graph.service import build_graph_result

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/overview", response_model=GraphResult)
def graph_overview(
    food_category: str = Query(default="all_food"),
    geo_id: str | None = Query(default=None),
    include_bottlenecks: bool = Query(default=True),
) -> GraphResult:
    try:
        return build_graph_result(GraphInput(food_category=food_category, geo_id=geo_id, include_bottlenecks=include_bottlenecks))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/nodes")
def graph_nodes(food_category: str = Query(default="all_food"), geo_id: str | None = Query(default=None)) -> list:
    try:
        result = build_graph_result(GraphInput(food_category=food_category, geo_id=geo_id, include_bottlenecks=False))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [n.model_dump() for n in result.nodes]


@router.get("/edges")
def graph_edges(food_category: str = Query(default="all_food"), geo_id: str | None = Query(default=None)) -> list:
    try:
        result = build_graph_result(GraphInput(food_category=food_category, geo_id=geo_id, include_bottlenecks=False))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [e.model_dump() for e in result.edges]


@router.get("/bottlenecks")
def graph_bottlenecks(food_category: str = Query(default="all_food")) -> list:
    try:
        result = build_graph_result(GraphInput(food_category=food_category, include_bottlenecks=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return [b.model_dump() for b in result.bottlenecks]


@router.post("/propagate", response_model=PropagationResult)
def graph_propagate(shock: ShockInput) -> PropagationResult:
    food_graph = get_food_graph()
    try:
        return propagate_shock(food_graph.graph, shock)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/provenance")
def graph_provenance() -> dict:
    return load_food_graph_provenance()
