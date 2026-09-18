"""Deterministic fallback: keyword-based tool routing + templated (not
LLM-generated) answer/brief composition. This is what runs when no LLM
provider is configured, or an LLM call fails -- the app must stay useful
without the LLM, per the deterministic-fallback requirement. Every branch
here still only ever touches the approved tools in backend/ai/tools.py.
"""
from __future__ import annotations

from backend.ai.contracts import DecisionBriefSection, ScenarioContext, ToolCallRecord
from backend.ai.tools import invoke_tool, summarize_tool_result

DEFAULT_ILLUSTRATIVE_SEVERITY = 0.3


def run_tool(tool_name: str, purpose: str, arguments: dict, raw_results: list[dict]) -> ToolCallRecord:
    result, error = invoke_tool(tool_name, arguments)
    source_refs = []
    if tool_name == "retrieve_evidence" and not error:
        source_refs = [m["provenance_id"] for m in result.get("matches", [])]
        raw_results.append(result)
    return ToolCallRecord(
        tool_name=tool_name,
        purpose=purpose,
        arguments=arguments,
        result_summary=summarize_tool_result(tool_name, result) if not error else {},
        status="error" if error else "ok",
        error=error,
        source_refs=source_refs,
    )


def _shock_field_from_question(question: str) -> str | None:
    q = question.lower()
    if "transport" in q:
        return "transport_capacity_reduction"
    if "storage" in q:
        return "storage_capacity_reduction"
    if "production" in q or "harvest" in q or "crop" in q:
        return "production_disruption"
    if "market" in q or "demand" in q:
        return "market_demand_disruption"
    return None


def classify_and_run(question: str, context: ScenarioContext | None) -> tuple[list[ToolCallRecord], list[dict]]:
    """Deterministic intent routing -- mirrors the mapping documented in the
    task brief (risk -> get_risk/inspect_location, vulnerability -> +graph +
    evidence, hypothetical shocks -> simulate_shock, budget/feasibility ->
    optimization, world comparison -> calculate_impact, evidence -> retrieve_evidence).
    Returns (tool_trace, raw_evidence_results) -- the latter carries full
    EvidenceItem-shaped dicts for citation-building."""
    q = question.lower()
    geo_id = context.geo_id if context else None
    food_category = (context.food_category if context else None) or "all_food"
    records: list[ToolCallRecord] = []
    raw_evidence: list[dict] = []

    wants_evidence = any(kw in q for kw in ["evidence", "source", "citation", "where did this come from", "proof"])
    wants_vulnerability = "vulnerable" in q or "why" in q
    wants_risk = "risk" in q
    wants_graph = any(kw in q for kw in ["network", "graph", "bottleneck", "supply chain", "dependency"])
    wants_shock = any(kw in q for kw in ["what happens", "what if", "if "]) and _shock_field_from_question(q) is not None
    wants_budget = any(kw in q for kw in ["budget", "feasible", "afford", "constraint"])
    wants_portfolio_why = "portfolio" in q and ("why" in q or "select" in q or "chose" in q or "chosen" in q)
    wants_compare = "compare" in q and ("world" in q or "scenario" in q)

    if geo_id and (wants_vulnerability or wants_risk) and not wants_shock:
        records.append(run_tool("inspect_location", "Fetch combined risk + resilience for the scenario geography.", {"geo_id": geo_id, "food_category": food_category}, raw_evidence))
        if wants_vulnerability and wants_graph is False:
            records.append(run_tool("inspect_food_graph", "Check structural food-network exposure for this geography.", {"geo_id": geo_id, "food_category": food_category}, raw_evidence))

    if wants_graph and geo_id:
        records.append(run_tool("inspect_food_graph", "Inspect food-network structure and bottlenecks.", {"geo_id": geo_id, "food_category": food_category}, raw_evidence))

    if wants_shock and geo_id:
        field = _shock_field_from_question(q)
        severity = context.severity if (context and context.severity is not None) else DEFAULT_ILLUSTRATIVE_SEVERITY
        args = {"geo_id": geo_id, "food_category": food_category, field: severity}
        records.append(run_tool("simulate_shock", f"Compose the {field.replace('_', ' ')} shock implied by the question and inspect its modeled impact.", args, raw_evidence))

    if (wants_budget or wants_portfolio_why) and geo_id and context and context.shock_field and context.severity is not None and context.intervention_types:
        target_node_id = target_node_id_for_field(context.shock_field, geo_id)
        shock_type = shock_type_for_field(context.shock_field)
        constraints = context.constraints or {}
        records.append(
            run_tool(
                "run_optimization",
                "Search the configured candidate interventions for the modeled-best feasible portfolio under the scenario's constraints.",
                {
                    "target_node_id": target_node_id,
                    "shock_type": shock_type,
                    "severity": context.severity,
                    "candidate_intervention_types": context.intervention_types,
                    "budget": constraints.get("budget"),
                    "water_limit_m3": constraints.get("water_limit_m3"),
                    "carbon_target_tco2e": constraints.get("carbon_target_tco2e"),
                },
                raw_evidence,
            )
        )

    if wants_compare and geo_id and context and context.shock_field and context.severity is not None:
        target_node_id = target_node_id_for_field(context.shock_field, geo_id)
        shock_type = shock_type_for_field(context.shock_field)
        records.append(
            run_tool(
                "calculate_impact",
                "Run the Digital Twin for World A (shock, no intervention) vs World B (optimized) to compare modeled outcomes.",
                {
                    "geo_id": geo_id,
                    "food_category": food_category,
                    "target_node_id": target_node_id,
                    "shock_type": shock_type,
                    "severity": context.severity,
                    "optimize_candidate_types": context.intervention_types or [],
                },
                raw_evidence,
            )
        )

    if wants_evidence or not records:
        records.append(run_tool("retrieve_evidence", "Retrieve supporting evidence from project provenance/methodology documents.", {"query": question, "top_k": 3, "geo_id": geo_id}, raw_evidence))

    return records, raw_evidence


def target_node_id_for_field(shock_field: str, geo_id: str) -> str:
    prefix = {"production_disruption": "production", "storage_capacity_reduction": "storage", "transport_capacity_reduction": "market", "market_demand_disruption": "demand"}[shock_field]
    return f"{prefix}_{geo_id}"


def shock_type_for_field(shock_field: str) -> str:
    return {
        "production_disruption": "production_reduction",
        "storage_capacity_reduction": "storage_capacity_reduction",
        "transport_capacity_reduction": "transport_capacity_reduction",
        "market_demand_disruption": "market_disruption",
    }[shock_field]


def compose_fallback_answer(question: str, records: list[ToolCallRecord]) -> str:
    lines = [
        "Structured system brief -- AI generation is unavailable, so this is a deterministic summary of backend "
        "tool results (not natural-language generation).",
        "",
    ]
    for r in records:
        if r.status == "error":
            lines.append(f"[{r.tool_name}] {r.purpose} -- failed: {r.error}")
            continue
        lines.append(f"[{r.tool_name}] {r.purpose}")
        for k, v in r.result_summary.items():
            lines.append(f"  - {k.replace('_', ' ')}: {v}")
    if not any(r.status == "ok" for r in records):
        lines.append("")
        lines.append(
            "No tool returned usable data for this question -- most likely the scenario is missing required "
            "context (a composed shock, an intervention portfolio, or a valid geography). Try composing a "
            "scenario in the Intervention Lab first, or ask a question about the currently selected geography."
        )
    return "\n".join(lines)


def build_deterministic_brief_sections(context: ScenarioContext, records: dict[str, ToolCallRecord]) -> list[DecisionBriefSection]:
    sections: list[DecisionBriefSection] = []

    loc = records.get("inspect_location")
    if loc and loc.status == "ok":
        s = loc.result_summary
        sections.append(
            DecisionBriefSection(
                title="EXECUTIVE SITUATION",
                content=(
                    f"{(context.geo_id or 'this geography').replace('_', ' ').title()}: climate-stress risk is "
                    f"{s.get('risk_class', 'unknown')} (score {s.get('risk_score', 'n/a')}, ESTIMATED). Modeled "
                    f"resilience is {s.get('resilience_score', 'n/a')} with a resilience gap of "
                    f"{s.get('resilience_gap', 'n/a')} against the target."
                ),
                truth_status="ESTIMATED",
                source_refs=["risk.methodology"],
            )
        )
        sections.append(
            DecisionBriefSection(
                title="WHY HERE?",
                content=(
                    "Risk classification is district-centroid based (NASA POWER ~50km grid), not a mandal-precise "
                    "or field-measured figure. See the driver breakdown in GET /risk?geo_id=... for the specific "
                    "rainfall/heat anomaly contributions."
                ),
                truth_status="DERIVED",
            )
        )

    graph = records.get("inspect_food_graph")
    if graph and graph.status == "ok":
        s = graph.result_summary
        sections.append(
            DecisionBriefSection(
                title="FOOD SYSTEM EXPOSURE",
                content=(
                    f"The modeled food network has {s.get('node_count', 'n/a')} nodes and {s.get('edge_count', 'n/a')} "
                    f"edges in scope, with {s.get('bottleneck_count', 0)} structural bottleneck candidates flagged "
                    "(graph-theoretic properties, not confirmed real-world importance)."
                ),
                truth_status="SIMULATED",
            )
        )

    shock = records.get("simulate_shock")
    if shock and shock.status == "ok":
        s = shock.result_summary
        sections.append(
            DecisionBriefSection(
                title="WHAT COULD HAPPEN?",
                content=(
                    f"Under the composed shock, modeled resilience moves from {s.get('baseline_resilience', 'n/a')} "
                    f"to {s.get('shocked_resilience', 'n/a')} (gap {s.get('resilience_gap', 'n/a')}), with "
                    f"{s.get('propagated_nodes', 0)} food-network nodes showing modeled impact. This is a "
                    "SIMULATED scenario cascade, not a measured or forecast real-world event."
                ),
                truth_status="SIMULATED",
            )
        )

    opt = records.get("run_optimization")
    if opt and opt.status == "ok":
        s = opt.result_summary
        sections.append(
            DecisionBriefSection(
                title="INTERVENTION OPTIONS",
                content=(
                    f"{s.get('feasible_candidate_count', 0)} of the configured candidate portfolios are feasible "
                    f"under the given constraints; {s.get('infeasible_candidate_count', 0)} are not."
                ),
                truth_status="SIMULATED",
            )
        )
        sections.append(
            DecisionBriefSection(
                title="MODELED PORTFOLIO",
                content=(
                    f"Modeled best under configured objectives and constraints: "
                    f"{', '.join(s.get('selected_intervention_types') or []) or 'no feasible candidate selected'}. "
                    f"{s.get('why_feasible', '')}"
                ),
                truth_status="SIMULATED",
            )
        )

    impact = records.get("calculate_impact")
    if impact and impact.status == "ok":
        s = impact.result_summary
        sections.append(
            DecisionBriefSection(
                title="RECOVERY OUTLOOK",
                content=(
                    f"Modeled resilience gap under the shock is {s.get('shocked_resilience_gap', 'n/a')}; under the "
                    f"optimized intervention it is {s.get('optimized_resilience_gap', 'n/a')}. Modeled recovery "
                    f"time to the configured threshold: {s.get('recovery_time_days', 'not reached in horizon')} days. "
                    "This recovery trajectory is SIMULATED, not a validated real-world forecast."
                ),
                truth_status="SIMULATED",
            )
        )

    sections.append(
        DecisionBriefSection(
            title="KEY TRADE-OFFS",
            content=(
                "Cost/water/carbon figures are only ever echoes of caller-supplied values in this sprint -- where "
                "not supplied by the user, they are explicitly unavailable, not assumed to be zero. Intervention "
                "effectiveness defaults are ESTIMATED, illustrative assumptions, not field-validated."
            ),
            truth_status="ESTIMATED",
        )
    )

    evidence = records.get("retrieve_evidence")
    limitations = [
        "This brief is a structured system summary of deterministic backend tool outputs, not free-form AI "
        "narrative generation, when the AI provider is unavailable.",
        "Every SIMULATED/COUNTERFACTUAL figure above is a scenario/decision-support model output, not a "
        "measured or forecast real-world event.",
    ]
    if evidence and evidence.status == "ok" and not evidence.result_summary.get("found"):
        limitations.append("No supporting evidence document matched this scenario's terms in the project corpus.")
    sections.append(DecisionBriefSection(title="LIMITATIONS", content=" ".join(limitations)))

    return sections
