"""Brute-force multi-objective portfolio optimizer.

Method: enumerate every non-empty subset (powerset) of the (capped) candidate
interventions -- a combinatorial search, deliberately transparent and
explainable rather than a heuristic/metaheuristic, appropriate for the small
candidate set this sprint supports (config/optimization.yaml max_candidates).
Each subset is evaluated by calling backend.intervention.portfolio.compute_portfolio
UNMODIFIED. Feasibility is read from that same call's constraint_check.
Among feasible candidates, one is "selected" via a transparent, documented
weighted score (backend/optimization/objectives.py) -- but every candidate's
raw objective values and Pareto-optimality flag are also returned, so the
caller is never limited to trusting the single scalar pick.
"""
from __future__ import annotations

from itertools import combinations

from backend.graph.graph_builder import get_food_graph
from backend.graph.propagation import propagate_shock
from backend.intervention.contracts import InterventionInput, PortfolioInput
from backend.intervention.portfolio import compute_portfolio
from backend.intervention.utils import degrade_resilience_by_impact, impact_at_node
from backend.optimization.config import load_optimization_config
from backend.optimization.contracts import (
    BaselineState,
    OptimizationInput,
    OptimizationResult,
    PortfolioCandidate,
)
from backend.optimization.explain import build_explanation
from backend.optimization.objectives import compute_pareto_optimal, extract_objective_values, normalize_and_score
from backend.resilience.model import compute_resilience
from backend.risk.baseline_model import get_risk
from backend.risk.contracts import RiskInput

GENERAL_LIMITATIONS = [
    "'Selected' means modeled best under the configured objectives/constraints for this run, not a claim "
    "of real-world optimality -- it depends on the assumed objective_weights and on each intervention's "
    "estimated effectiveness and caller-supplied cost/water/carbon values.",
    "objective_weights_used are ASSUMED (config/optimization.yaml unless overridden per-request) and are "
    "used only to rank feasible candidates into a single scalar pick; every candidate's raw, unweighted "
    "objective_values and is_pareto_optimal flag are also returned for independent multi-objective review.",
    "cost/water/carbon entries in a candidate's 'objectives_worsened' reflect resource spent relative to "
    "the zero-cost baseline of taking no action -- expected for any active intervention, not necessarily "
    "a sign of a poor choice.",
    "This optimizer's shock is graph-based (production/storage/transport/market capacity); it does not "
    "modify climate risk. baseline_state.risk_score is this geography's current unshocked climate-risk "
    "baseline for context -- use POST /interventions/shock for climate what-if scenarios.",
]


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def run_optimization(inp: OptimizationInput) -> OptimizationResult:
    config = load_optimization_config()
    weights = inp.objective_weights or config["objective_weights"]

    food_graph = get_food_graph()
    if inp.shock.target_node_id not in food_graph.graph.nodes:
        raise KeyError(f"target_node_id '{inp.shock.target_node_id}' is not a known node in the food graph")

    limitations: list[str] = list(GENERAL_LIMITATIONS)

    candidate_configs = inp.candidate_interventions
    max_candidates = config["max_candidates"]
    if len(candidate_configs) > max_candidates:
        limitations.append(
            f"Only the first {max_candidates} of {len(candidate_configs)} supplied candidate interventions "
            "were used (max_candidates in config/optimization.yaml) to keep the brute-force powerset search "
            "small and interactively explainable."
        )
        candidate_configs = candidate_configs[:max_candidates]

    # --- baseline: shock applied, zero interventions ---
    target_data = food_graph.node(inp.shock.target_node_id)
    geo_id = target_data["geo_id"]
    demand_node_id = f"demand_{geo_id}"

    baseline_resilience = compute_resilience(geo_id)
    shock_propagation = propagate_shock(food_graph.graph, inp.shock)
    baseline_demand_impact = impact_at_node(shock_propagation, demand_node_id)
    shocked_resilience = degrade_resilience_by_impact(baseline_resilience, baseline_demand_impact)
    risk_result = get_risk(RiskInput(geo_id=geo_id))

    baseline_state = BaselineState(
        risk_score=risk_result.risk_score,
        risk_truth_status=risk_result.truth_status,
        resilience_score=shocked_resilience.current_resilience_score,
        resilience_gap=shocked_resilience.resilience_gap,
        demand_impact_fraction=baseline_demand_impact,
    )

    # --- enumerate the powerset of candidates (non-empty subsets) ---
    n = len(candidate_configs)
    subsets = [combo for r in range(1, n + 1) for combo in combinations(range(n), r)]

    raw_candidates = []
    for combo in subsets:
        selected_configs = [candidate_configs[i] for i in combo]
        intervention_inputs = [
            InterventionInput(shock=inp.shock, **c.model_dump()) for c in selected_configs
        ]
        try:
            portfolio_result = compute_portfolio(PortfolioInput(interventions=intervention_inputs, constraints=inp.constraints))
        except ValueError as exc:
            limitations.append(
                f"Skipped candidate combination {[c.intervention_type for c in selected_configs]}: {exc}"
            )
            continue

        candidate_id = str(combo)
        objective_values = extract_objective_values(portfolio_result)

        if inp.constraints is None or all(
            v is None for v in (inp.constraints.budget, inp.constraints.water_limit_m3, inp.constraints.carbon_target_tco2e)
        ):
            feasibility_status = "unconstrained"
            feasibility_note = "No constraints were supplied for this run; there is nothing to violate."
        else:
            violated = [name for name, entry in portfolio_result.constraint_check.items() if entry.within_limit is False]
            if violated:
                feasibility_status = "infeasible"
                feasibility_note = f"Violates constraint(s): {', '.join(violated)}."
            else:
                unknown = [
                    name
                    for name, entry in portfolio_result.constraint_check.items()
                    if entry.limit is not None and entry.within_limit is None
                ]
                feasibility_status = "feasible"
                feasibility_note = (
                    f"No confirmed violation, but data was unavailable to fully verify: {', '.join(unknown)}."
                    if unknown
                    else "Satisfies all given constraints."
                )

        raw_candidates.append(
            {
                "candidate_id": candidate_id,
                "intervention_types": [c.intervention_type for c in selected_configs],
                "portfolio": portfolio_result,
                "objective_values": objective_values,
                "feasibility_status": feasibility_status,
                "feasibility_note": feasibility_note,
            }
        )
        limitations.extend(portfolio_result.limitations)

    scoreable = {
        c["candidate_id"]: c["objective_values"] for c in raw_candidates if c["feasibility_status"] != "infeasible"
    }
    scores = normalize_and_score(scoreable, weights) if scoreable else {}
    pareto = compute_pareto_optimal(scoreable) if scoreable else {}

    candidates: list[PortfolioCandidate] = []
    candidates_by_id: dict[str, PortfolioCandidate] = {}
    for c in raw_candidates:
        cid = c["candidate_id"]
        pc = PortfolioCandidate(
            intervention_types=c["intervention_types"],
            portfolio=c["portfolio"],
            objective_values=c["objective_values"],
            feasibility_status=c["feasibility_status"],
            feasibility_note=c["feasibility_note"],
            normalized_score=scores.get(cid),
            is_pareto_optimal=pareto.get(cid, False),
        )
        candidates.append(pc)
        candidates_by_id[cid] = pc

    selected = candidates_by_id[max(scores, key=scores.get)] if scores else None

    feasible_count = sum(1 for c in candidates if c.feasibility_status != "infeasible")
    infeasible_count = sum(1 for c in candidates if c.feasibility_status == "infeasible")

    limitations = _dedupe(limitations)
    explanation = build_explanation(selected, inp.constraints, limitations)

    return OptimizationResult(
        objective_weights_used=weights,
        normalization_method=config["normalization_method"],
        baseline_state=baseline_state,
        candidates=candidates,
        feasible_candidate_count=feasible_count,
        infeasible_candidate_count=infeasible_count,
        selected_candidate=selected,
        explanation=explanation,
        provenance_refs=[
            "backend/intervention portfolio engine",
            "backend/graph food network graph",
            "backend/resilience proxy",
            "backend/risk climate-stress baseline",
            "config/optimization.yaml",
        ],
        limitations=limitations,
    )
