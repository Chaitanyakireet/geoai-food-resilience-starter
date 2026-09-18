"""AI Decision Brief / Copilot API. Explanation + evidence + orchestration
only -- see backend/ai/orchestrator.py's module docstring for the
architecture. This router never computes a risk/resilience/graph/
optimization/twin number itself; it only calls into those existing engines
via backend/ai/tools.py.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.ai.contracts import (
    AiQueryInput,
    AiQueryOutput,
    DecisionBriefInput,
    DecisionBriefOutput,
    ToolInvokeInput,
    ToolInvokeOutput,
)
from backend.ai.orchestrator import build_decision_brief, run_query
from backend.ai.provenance import build_ai_provenance
from backend.ai.tools import invoke_tool

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/query", response_model=AiQueryOutput)
def post_query(inp: AiQueryInput) -> AiQueryOutput:
    if not inp.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    return run_query(inp.question, inp.scenario_context)


@router.post("/decision-brief", response_model=DecisionBriefOutput)
def post_decision_brief(inp: DecisionBriefInput) -> DecisionBriefOutput:
    return build_decision_brief(inp.scenario_context)


@router.post("/tool", response_model=ToolInvokeOutput)
def post_tool(inp: ToolInvokeInput) -> ToolInvokeOutput:
    result, error = invoke_tool(inp.tool_name, inp.arguments)
    if error and not result:
        return ToolInvokeOutput(tool_name=inp.tool_name, status="error", error=error)
    if error:
        return ToolInvokeOutput(tool_name=inp.tool_name, status="error", error=error, result=result)
    return ToolInvokeOutput(tool_name=inp.tool_name, status="ok", result=result)


@router.get("/provenance")
def get_provenance() -> dict:
    return build_ai_provenance()
