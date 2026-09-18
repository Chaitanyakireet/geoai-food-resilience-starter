"""Small helpers shared between shock_composer.py and engine.py."""
from __future__ import annotations

from backend.graph.contracts import PropagationResult
from backend.resilience.contracts import ResilienceResult


def impact_at_node(propagation_result: PropagationResult, node_id: str) -> float:
    for step in propagation_result.steps:
        if step.node_id == node_id:
            return step.impact_fraction
    return 0.0


def degrade_resilience_by_impact(resilience: ResilienceResult, impact_fraction: float) -> ResilienceResult:
    """Documented simplifying assumption: a modeled graph-propagation impact
    at a geography's demand node multiplicatively degrades its resilience
    score (score * (1 - impact_fraction)). Not a validated shock-resilience
    relationship -- see the appended limitation on the returned result."""
    if impact_fraction <= 0:
        return resilience
    adjusted = round(resilience.current_resilience_score * (1 - impact_fraction), 4)
    return resilience.model_copy(
        update={
            "current_resilience_score": adjusted,
            "resilience_gap": round(resilience.target_resilience_score - adjusted, 4),
            "limitations": resilience.limitations
            + [
                f"Adjusted for modeled graph-propagation impact at the demand node "
                f"(impact_fraction={impact_fraction}) via score * (1 - impact_fraction); a documented "
                "simplifying assumption, not a validated shock-resilience relationship."
            ],
        }
    )
