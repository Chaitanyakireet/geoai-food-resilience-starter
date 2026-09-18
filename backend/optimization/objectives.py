"""Objective extraction, min-max normalization, weighted scoring, and Pareto
dominance -- see config/optimization.yaml for the documented method.

Every raw objective value is preserved and returned alongside any weighted
score, so a caller can ignore the scalar ranking entirely and do its own
multi-objective comparison (Pareto-style) if it does not want to accept the
weighting assumption.
"""
from __future__ import annotations

from backend.intervention.contracts import PortfolioResult
from backend.optimization.contracts import ObjectiveValues

MAXIMIZE_OBJECTIVES = {"food_availability_effect_proxy", "resilience_effect", "food_loss_effect"}
MINIMIZE_OBJECTIVES = {"cost", "water_impact_m3", "carbon_impact_tco2e"}
ALL_OBJECTIVES = MAXIMIZE_OBJECTIVES | MINIMIZE_OBJECTIVES


def extract_objective_values(portfolio: PortfolioResult) -> ObjectiveValues:
    # food_loss_effect: portfolio-level combined loss isn't separately modeled
    # (no defensible combination rule for caller-supplied fractions across
    # multiple interventions) -- report the max single-intervention value
    # supplied in this portfolio as a conservative, disclosed proxy.
    loss_values = [i.food_loss_effect for i in portfolio.interventions if i.food_loss_effect is not None]
    return ObjectiveValues(
        food_availability_effect_proxy=portfolio.combined_food_availability_effect_proxy,
        resilience_effect=portfolio.combined_resilience_effect,
        food_loss_effect=max(loss_values) if loss_values else None,
        cost=portfolio.total_cost_estimate,
        water_impact_m3=portfolio.total_water_impact_m3,
        carbon_impact_tco2e=portfolio.total_carbon_impact_tco2e,
    )


def normalize_and_score(
    objective_values_by_candidate: dict[str, ObjectiveValues], weights: dict[str, float]
) -> dict[str, float]:
    """Min-max normalize each objective ACROSS the given candidates, then
    return a weighted sum per candidate. A candidate with no data for an
    objective contributes 0 for that objective's term (not imputed)."""
    ranges: dict[str, tuple[float, float]] = {}
    for objective in ALL_OBJECTIVES:
        values = [
            getattr(ov, objective) for ov in objective_values_by_candidate.values() if getattr(ov, objective) is not None
        ]
        if values:
            ranges[objective] = (min(values), max(values))

    scores: dict[str, float] = {}
    for candidate_id, ov in objective_values_by_candidate.items():
        total = 0.0
        for objective in ALL_OBJECTIVES:
            value = getattr(ov, objective)
            weight = weights.get(objective, 0.0)
            if value is None or objective not in ranges or weight == 0.0:
                continue
            lo, hi = ranges[objective]
            if hi == lo:
                continue  # no discriminating information for this objective on this run
            if objective in MAXIMIZE_OBJECTIVES:
                normalized = (value - lo) / (hi - lo)
            else:
                normalized = (hi - value) / (hi - lo)
            total += weight * normalized
        scores[candidate_id] = round(total, 4)
    return scores


def compute_pareto_optimal(objective_values_by_candidate: dict[str, ObjectiveValues]) -> dict[str, bool]:
    """A candidate is Pareto-optimal if no other candidate is at least as
    good on every objective (with data for both) and strictly better on at
    least one. Objectives missing on either side are skipped for that pair."""
    ids = list(objective_values_by_candidate.keys())
    result = {cid: True for cid in ids}

    def dominates(a: ObjectiveValues, b: ObjectiveValues) -> bool:
        at_least_as_good_everywhere = True
        strictly_better_somewhere = False
        for objective in ALL_OBJECTIVES:
            av, bv = getattr(a, objective), getattr(b, objective)
            if av is None or bv is None:
                continue
            if objective in MAXIMIZE_OBJECTIVES:
                if av < bv:
                    at_least_as_good_everywhere = False
                elif av > bv:
                    strictly_better_somewhere = True
            else:
                if av > bv:
                    at_least_as_good_everywhere = False
                elif av < bv:
                    strictly_better_somewhere = True
        return at_least_as_good_everywhere and strictly_better_somewhere

    for i in ids:
        for j in ids:
            if i == j:
                continue
            if dominates(objective_values_by_candidate[j], objective_values_by_candidate[i]):
                result[i] = False
                break
    return result
