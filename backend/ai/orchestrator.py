"""Orchestrates POST /ai/query and POST /ai/decision-brief.

Architecture: tool calls are ALWAYS the ground truth, executed by Python
code (backend/ai/tools.py) against the existing deterministic engines --
never guessed by an LLM. When an LLM provider is configured, it is used
only to (a) pick which approved tools to call for an open-ended question,
via the provider's native tool-use loop, and (b) phrase a narrative answer
strictly over the tool results it already received. It never answers
without grounding, and a tool result is never edited by the LLM before
being shown in the tool trace. When no provider is configured, or a
provider call fails, everything falls back to backend/ai/fallback.py's
deterministic routing + templated composition -- the app stays fully
functional without an LLM.
"""
from __future__ import annotations

import json
import logging

from backend.ai.contracts import (
    AiQueryOutput,
    DecisionBriefOutput,
    DecisionBriefSection,
    EvidenceItem,
    ScenarioContext,
    ToolCallRecord,
)
from backend.ai.fallback import build_deterministic_brief_sections, classify_and_run, compose_fallback_answer, run_tool, shock_type_for_field, target_node_id_for_field
from backend.ai.provider import LLMProvider, ProviderResponse, get_provider
from backend.ai.tools import TOOL_SCHEMAS, invoke_tool, summarize_tool_result

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 4

SYSTEM_PROMPT = """You are the AI Copilot for a GeoAI food-resilience decision-intelligence platform \
(Hyderabad-Telangana, multi-food, SDG 2). You explain and orchestrate; you are NEVER the source of \
truth for a number. Deterministic backend tools are authoritative for risk, resilience, graph \
propagation, intervention effects, optimization, Digital Twin simulation, recovery, and impact.

Rules you must follow exactly:
- Use the provided tools to ground every factual/numeric claim. Never invent a number, citation, or \
scientific claim.
- Always preserve and state the truth-status of what you report: OBSERVED, DERIVED, ESTIMATED, \
COUNTERFACTUAL, or SIMULATED. Use phrasing like "Estimated under configured assumptions...", \
"Simulated result...", "Counterfactual scenario...". Never call an ESTIMATED/SIMULATED value \
"observed" or "measured", and never claim an intervention is field-validated -- effectiveness \
defaults are illustrative assumptions.
- If retrieve_evidence returns found=false, say explicitly that no supporting evidence was found \
rather than inventing a source.
- Do not infer public preferences, causal real-world effectiveness, or facts not returned by a tool.
- Keep answers concise and cite which tool result each claim comes from."""


def _tool_schemas_for_provider() -> list[dict]:
    return TOOL_SCHEMAS


def _run_provider_tool_loop(provider: LLMProvider, system: str, initial_user_message: str) -> tuple[str, list[ToolCallRecord]]:
    messages: list[dict] = [{"role": "user", "content": initial_user_message}]
    tool_trace: list[ToolCallRecord] = []

    for _ in range(MAX_TOOL_ITERATIONS):
        response: ProviderResponse = provider.complete(system, messages, _tool_schemas_for_provider())

        if not response.tool_uses:
            return response.text.strip(), tool_trace

        assistant_content = []
        for block in response.text_blocks:
            assistant_content.append({"type": "text", "text": block})
        for tu in response.tool_uses:
            assistant_content.append({"type": "tool_use", "id": tu.id, "name": tu.name, "input": tu.input})
        messages.append({"role": "assistant", "content": assistant_content})

        tool_result_blocks = []
        for tu in response.tool_uses:
            result, error = invoke_tool(tu.name, tu.input)
            tool_trace.append(
                ToolCallRecord(
                    tool_name=tu.name,
                    purpose=f"Called by the AI Copilot to answer the question (LLM-selected).",
                    arguments=tu.input,
                    result_summary=summarize_tool_result(tu.name, result) if not error else {},
                    status="error" if error else "ok",
                    error=error,
                    source_refs=[m["provenance_id"] for m in result.get("matches", [])] if tu.name == "retrieve_evidence" and not error else [],
                )
            )
            tool_result_blocks.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(result)[:4000],
                    "is_error": bool(error),
                }
            )
        messages.append({"role": "user", "content": tool_result_blocks})

    # Exhausted iterations without a final text answer -- surface what we have.
    return "The AI Copilot reached its tool-call limit for this question without producing a final answer.", tool_trace


def _collect_citations_from_trace(tool_trace: list[ToolCallRecord]) -> list[EvidenceItem]:
    # For the LLM path, retrieve_evidence tool_result JSON isn't retained
    # verbatim in the trace (only the summary is, to keep the trace
    # compact) -- re-run retrieve_evidence-sourced provenance_ids through
    # the same tool to recover full EvidenceItem objects deterministically.
    from backend.ai.evidence import retrieve_evidence as _retrieve

    citations: list[EvidenceItem] = []
    seen: set[str] = set()
    for record in tool_trace:
        if record.tool_name != "retrieve_evidence" or record.status != "ok":
            continue
        query = record.arguments.get("query", "")
        top_k = record.arguments.get("top_k", 3)
        geo_id = record.arguments.get("geo_id")
        from backend.ai.contracts import EvidenceQuery

        result = _retrieve(EvidenceQuery(query=query, top_k=top_k, geo_id=geo_id))
        for item in result.matches:
            if item.provenance_id not in seen:
                seen.add(item.provenance_id)
                citations.append(item)
    return citations


_TRUTH_STATUS_KEYS = ("truth_status", "risk_truth_status", "resilience_truth_status", "shocked_risk_truth_status")


def _truth_statuses_from_trace(tool_trace: list[ToolCallRecord], citations: list[EvidenceItem]) -> list[str]:
    # Only reports truth statuses an actual tool result or citation carried
    # -- never guesses one when nothing in the trace established it.
    statuses: set[str] = {c.truth_status for c in citations}
    for record in tool_trace:
        for key in _TRUTH_STATUS_KEYS:
            ts = record.result_summary.get(key)
            if ts:
                statuses.add(ts)
    return sorted(statuses)


def run_query(question: str, scenario_context: ScenarioContext | None) -> AiQueryOutput:
    provider = get_provider()

    if provider.is_configured():
        try:
            context_json = scenario_context.model_dump_json() if scenario_context else "null"
            user_message = f"Scenario context (JSON, may be null): {context_json}\n\nQuestion: {question}"
            answer, tool_trace = _run_provider_tool_loop(provider, SYSTEM_PROMPT, user_message)
            citations = _collect_citations_from_trace(tool_trace)
            return AiQueryOutput(
                answer=answer,
                mode="llm",
                tool_trace=tool_trace,
                citations=citations,
                truth_statuses_referenced=_truth_statuses_from_trace(tool_trace, citations),
                limitations=[
                    "Numeric values above are copied from deterministic tool results; the LLM narrates and "
                    "orchestrates but does not compute them.",
                ],
                provider_status=f"{provider.name} (configured)",
            )
        except Exception as exc:  # noqa: BLE001 -- any provider/network failure falls back, never crashes the request
            logger.warning("AI provider call failed, using deterministic fallback: %s", exc)
            fallback = _run_query_fallback(question, scenario_context, provider_status=f"{provider.name} (call failed: {exc})")
            return fallback

    return _run_query_fallback(question, scenario_context, provider_status="none (not configured)")


def _run_query_fallback(question: str, scenario_context: ScenarioContext | None, provider_status: str) -> AiQueryOutput:
    tool_trace, raw_evidence = classify_and_run(question, scenario_context)
    answer = compose_fallback_answer(question, tool_trace)
    citations = [EvidenceItem(**m) for r in raw_evidence for m in r.get("matches", [])]
    seen: set[str] = set()
    deduped_citations = []
    for c in citations:
        if c.provenance_id not in seen:
            seen.add(c.provenance_id)
            deduped_citations.append(c)
    return AiQueryOutput(
        answer=answer,
        mode="deterministic_fallback",
        tool_trace=tool_trace,
        citations=deduped_citations,
        truth_statuses_referenced=_truth_statuses_from_trace(tool_trace, deduped_citations),
        limitations=[
            "No LLM provider is configured (or the provider call failed), so this is a deterministic, "
            "template-formatted summary of backend tool results, not AI-generated prose.",
        ],
        provider_status=provider_status,
    )


def build_decision_brief(scenario_context: ScenarioContext) -> DecisionBriefOutput:
    provider = get_provider()

    # Tool selection for the brief is always deterministic -- we already
    # know exactly what's in scenario_context, there's no intent to guess.
    tool_trace: list[ToolCallRecord] = []
    raw_evidence: list[dict] = []
    records_by_name: dict[str, ToolCallRecord] = {}

    def run(tool_name: str, purpose: str, arguments: dict) -> None:
        record = run_tool(tool_name, purpose, arguments, raw_evidence)
        tool_trace.append(record)
        records_by_name[tool_name] = record

    if scenario_context.geo_id:
        run("inspect_location", "Fetch risk + resilience for the scenario geography.", {"geo_id": scenario_context.geo_id, "food_category": scenario_context.food_category or "all_food"})
        run("inspect_food_graph", "Check food-network exposure for this geography.", {"geo_id": scenario_context.geo_id, "food_category": scenario_context.food_category or "all_food"})

    if scenario_context.geo_id and scenario_context.shock_field and scenario_context.severity is not None:
        target_node_id = target_node_id_for_field(scenario_context.shock_field, scenario_context.geo_id)
        shock_type = shock_type_for_field(scenario_context.shock_field)

        run(
            "simulate_shock",
            "Inspect the modeled impact of the scenario's composed shock.",
            {scenario_context.shock_field: scenario_context.severity, "geo_id": scenario_context.geo_id, "food_category": scenario_context.food_category or "all_food", "max_hops": scenario_context.max_hops or 5},
        )

        if scenario_context.intervention_types:
            constraints = scenario_context.constraints or {}
            run(
                "run_optimization",
                "Search the scenario's candidate interventions for the modeled-best feasible portfolio.",
                {
                    "target_node_id": target_node_id,
                    "shock_type": shock_type,
                    "severity": scenario_context.severity,
                    "candidate_intervention_types": scenario_context.intervention_types,
                    "budget": constraints.get("budget"),
                    "water_limit_m3": constraints.get("water_limit_m3"),
                    "carbon_target_tco2e": constraints.get("carbon_target_tco2e"),
                },
            )
            run(
                "calculate_impact",
                "Run the Digital Twin for baseline/shock/intervention/optimized states and recovery.",
                {
                    "geo_id": scenario_context.geo_id,
                    "food_category": scenario_context.food_category or "all_food",
                    "target_node_id": target_node_id,
                    "shock_type": shock_type,
                    "severity": scenario_context.severity,
                    "optimize_candidate_types": scenario_context.intervention_types,
                },
            )

    run(
        "retrieve_evidence",
        "Retrieve methodology/provenance evidence relevant to this scenario.",
        {"query": f"{scenario_context.food_category or ''} risk resilience methodology {scenario_context.geo_id or ''}".strip(), "top_k": 4, "geo_id": scenario_context.geo_id},
    )

    citations = [EvidenceItem(**m) for r in raw_evidence for m in r.get("matches", [])]
    seen: set[str] = set()
    deduped_citations: list[EvidenceItem] = []
    for c in citations:
        if c.provenance_id not in seen:
            seen.add(c.provenance_id)
            deduped_citations.append(c)

    deterministic_sections = build_deterministic_brief_sections(scenario_context, records_by_name)

    if provider.is_configured():
        try:
            sections = _narrate_brief_sections(provider, scenario_context, records_by_name, deterministic_sections)
            return DecisionBriefOutput(
                mode="llm",
                sections=sections,
                tool_trace=tool_trace,
                citations=deduped_citations,
                limitations=[
                    "Section narrative is LLM-phrased strictly over the deterministic tool results in the tool "
                    "trace; every number traces back to a specific backend engine, not the LLM.",
                ],
                provider_status=f"{provider.name} (configured)",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("AI provider call failed for decision brief, using deterministic sections: %s", exc)
            deterministic_sections.append(
                DecisionBriefSection(title="LIMITATIONS", content=f"AI narration unavailable ({exc}); sections below are the structured deterministic fallback.")
            )

    return DecisionBriefOutput(
        mode="deterministic_fallback",
        sections=deterministic_sections,
        tool_trace=tool_trace,
        citations=deduped_citations,
        limitations=[
            "No LLM provider is configured (or the provider call failed): every section is a structured, "
            "template-formatted summary of backend tool results, not AI-generated narrative.",
        ],
        provider_status="none (not configured)" if not provider.is_configured() else f"{provider.name} (call failed)",
    )


def _narrate_brief_sections(
    provider: LLMProvider,
    scenario_context: ScenarioContext,
    records_by_name: dict[str, ToolCallRecord],
    deterministic_sections: list[DecisionBriefSection],
) -> list[DecisionBriefSection]:
    """LLM narrates over already-fetched tool results ONLY -- it receives no
    tool-use capability here, so it cannot introduce a new, ungrounded
    number; it can only rephrase what's in results_json."""
    results_json = json.dumps({name: r.result_summary for name, r in records_by_name.items()}, default=str)
    prompt = (
        "Using ONLY the structured tool results below (JSON), write a Decision Brief with these exact section "
        "titles, each 1-3 sentences, grounded strictly in the given numbers -- do not introduce any number not "
        "present in the JSON: EXECUTIVE SITUATION, WHAT IS HAPPENING?, WHY HERE?, FOOD SYSTEM EXPOSURE, WHAT "
        "COULD HAPPEN?, INTERVENTION OPTIONS, MODELED PORTFOLIO, RECOVERY OUTLOOK, KEY TRADE-OFFS, LIMITATIONS. "
        "Respond as JSON: a list of {\"title\": ..., \"content\": ...}. Skip a section if the JSON has no "
        "relevant data for it rather than inventing content.\n\n"
        f"Tool results JSON: {results_json}"
    )
    response = provider.complete(SYSTEM_PROMPT, [{"role": "user", "content": prompt}], tools=[])
    text = response.text.strip()
    # Defensive parse: fall back to the deterministic sections if the model
    # didn't return valid JSON -- never fabricate sections from a parse error.
    try:
        start = text.index("[")
        end = text.rindex("]") + 1
        parsed = json.loads(text[start:end])
        sections = [DecisionBriefSection(title=s["title"], content=s["content"]) for s in parsed if s.get("title") and s.get("content")]
        if sections:
            return sections
    except (ValueError, KeyError, TypeError):
        pass
    return deterministic_sections
