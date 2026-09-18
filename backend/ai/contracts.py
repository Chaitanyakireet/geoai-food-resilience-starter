"""AI Decision Brief / Copilot contracts.

This layer is EXPLANATION + EVIDENCE + ORCHESTRATION only. It composes
(does not modify or replace) the deterministic backend/risk, backend/geoai,
backend/graph, backend/intervention, backend/optimization, and backend/twin
engines via backend/ai/tools.py. Numeric values in every ToolCallRecord and
DecisionBriefSection trace back to one of those deterministic modules -- the
LLM (when configured) narrates and orchestrates over already-computed
results, it never invents or overrides a number.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]
Mode = Literal["llm", "deterministic_fallback"]


class EvidenceQuery(BaseModel):
    query: str
    top_k: int = 3
    geo_id: Optional[str] = None


class EvidenceItem(BaseModel):
    provenance_id: str
    source_name: str
    source_url: Optional[str] = None
    access_date: Optional[str] = None
    truth_status: TruthStatus
    excerpt: str
    relevance_score: float
    matched_terms: list[str]


class EvidenceResult(BaseModel):
    query: str
    matches: list[EvidenceItem]
    found: bool
    limitations: list[str]


class ScenarioContext(BaseModel):
    """Mirrors what the frontend already has in session state (Intervention
    Lab / Digital Twin handoffs) -- the AI layer reads it, it never invents
    scenario parameters that weren't actually configured/computed."""

    geo_id: Optional[str] = None
    food_category: Optional[str] = None
    shock_field: Optional[str] = None
    severity: Optional[float] = None
    max_hops: Optional[int] = None
    heat_change_c: Optional[float] = None
    rainfall_change_pct: Optional[float] = None
    intervention_types: Optional[list[str]] = None
    constraints: Optional[dict] = None
    optimization_selected_types: Optional[list[str]] = None
    twin_result_available: Optional[bool] = None
    compare_result_available: Optional[bool] = None


class ToolCallRecord(BaseModel):
    tool_name: str
    purpose: str
    arguments: dict
    result_summary: dict
    status: Literal["ok", "error"]
    error: Optional[str] = None
    source_refs: list[str] = []


class AiQueryInput(BaseModel):
    question: str
    scenario_context: Optional[ScenarioContext] = None


class AiQueryOutput(BaseModel):
    answer: str
    mode: Mode
    tool_trace: list[ToolCallRecord]
    citations: list[EvidenceItem]
    truth_statuses_referenced: list[TruthStatus]
    limitations: list[str]
    provider_status: str


class DecisionBriefInput(BaseModel):
    scenario_context: ScenarioContext


class DecisionBriefSection(BaseModel):
    title: str
    content: str
    truth_status: Optional[TruthStatus] = None
    source_refs: list[str] = []


class DecisionBriefOutput(BaseModel):
    mode: Mode
    sections: list[DecisionBriefSection]
    tool_trace: list[ToolCallRecord]
    citations: list[EvidenceItem]
    limitations: list[str]
    provider_status: str


class ToolInvokeInput(BaseModel):
    tool_name: str
    arguments: dict = {}


class ToolInvokeOutput(BaseModel):
    tool_name: str
    status: Literal["ok", "error"]
    result: Optional[dict] = None
    error: Optional[str] = None
