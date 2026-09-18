"""Deterministic explanation structure for a completed optimization run.
Feeds the future AI Decision Brief -- the LLM should narrate this structure,
not invent its own reasoning about the numbers."""
from __future__ import annotations

from typing import Optional

from backend.intervention.contracts import Constraints
from backend.optimization.contracts import BaselineState, OptimizationExplanation, PortfolioCandidate
from backend.optimization.objectives import MAXIMIZE_OBJECTIVES, MINIMIZE_OBJECTIVES

BINDING_THRESHOLD_FRACTION = 0.8  # assumed: a constraint counts as "binding" once usage reaches 80% of its limit


def build_explanation(
    selected: Optional[PortfolioCandidate],
    constraints: Optional[Constraints],
    aggregated_limitations: list[str],
) -> OptimizationExplanation:
    if selected is None:
        return OptimizationExplanation(
            selected_intervention_types=[],
            why_feasible="No candidate portfolio satisfied every given constraint; no selection was made "
            "rather than silently picking an infeasible option.",
            binding_constraints=[],
            objectives_improved=[],
            objectives_worsened=[],
            assumptions_influencing_result=aggregated_limitations,
        )

    feasibility_clause = selected.feasibility_note.rstrip(".").lower()
    why_feasible = (
        f"Selected {selected.intervention_types} because it {feasibility_clause}, and scored "
        f"highest ({selected.normalized_score}) among feasible candidates under the configured objective "
        "weights. 'Best' here means modeled best under the configured objectives/constraints, not a "
        "claim of real-world optimality."
    )

    binding_constraints = []
    if constraints is not None:
        pc = selected.portfolio.constraint_check
        for name, limit_attr in [("budget", "budget"), ("water_limit", "water_limit_m3"), ("carbon_target", "carbon_target_tco2e")]:
            entry = pc.get(name)
            if entry is None or entry.limit is None or entry.total is None or entry.limit == 0:
                continue
            if entry.total / entry.limit >= BINDING_THRESHOLD_FRACTION:
                binding_constraints.append(f"{name} ({entry.total}/{entry.limit}, {round(entry.total/entry.limit*100)}% of limit)")

    ov = selected.objective_values
    objectives_improved = [
        obj for obj in sorted(MAXIMIZE_OBJECTIVES) if getattr(ov, obj) is not None and getattr(ov, obj) > 0
    ]
    objectives_worsened = [
        obj for obj in sorted(MINIMIZE_OBJECTIVES) if getattr(ov, obj) is not None and getattr(ov, obj) > 0
    ]

    return OptimizationExplanation(
        selected_intervention_types=selected.intervention_types,
        why_feasible=why_feasible,
        binding_constraints=binding_constraints,
        objectives_improved=objectives_improved,
        objectives_worsened=objectives_worsened,
        assumptions_influencing_result=aggregated_limitations,
    )
