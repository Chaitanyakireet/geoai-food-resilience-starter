"""Compare Worlds: World A = shock, no intervention. World B = the best
available intervention outcome (optimized if present, else the manual
portfolio). Reuses run_twin_scenario entirely -- this is a focused view
over its output, not a separate computation path."""
from __future__ import annotations

from backend.twin.contracts import CompareWorldsResult, TwinScenario
from backend.twin.engine import run_twin_scenario


def _delta(b_value, a_value):
    if b_value is None or a_value is None:
        return None
    return round(b_value - a_value, 4)


def compare_worlds(scenario: TwinScenario) -> CompareWorldsResult:
    result = run_twin_scenario(scenario)

    if result.shocked_state is None:
        raise ValueError("Compare Worlds requires a shock scenario -- World A is the no-intervention shock state.")

    world_b_state = result.optimized_state or result.intervention_state
    world_b_recovery = result.optimized_recovery or result.intervention_recovery
    world_b_metrics = result.optimized_recovery_metrics or result.intervention_recovery_metrics
    world_b_label = "optimized_intervention" if result.optimized_state is not None else "intervention"

    if world_b_state is None or world_b_recovery is None or world_b_metrics is None:
        raise ValueError(
            "Compare Worlds requires an intervention_portfolio or optimize_candidates on the scenario -- "
            "World B is the intervention/optimized state, and none was computed."
        )

    world_a_state = result.shocked_state
    world_a_recovery = result.shock_recovery
    world_a_metrics = result.shock_recovery_metrics

    deltas = {
        "demand_impact_fraction": _delta(world_b_state.demand_impact_fraction, world_a_state.demand_impact_fraction),
        "resilience_score": _delta(world_b_state.resilience_score, world_a_state.resilience_score),
        "resilience_gap": _delta(world_b_state.resilience_gap, world_a_state.resilience_gap),
        "food_availability_effect_proxy": world_b_state.food_availability_effect_proxy,
        "food_loss_effect": world_b_state.food_loss_effect,
        "cost": world_b_state.cost,
        "water_impact_m3": world_b_state.water_impact_m3,
        "carbon_impact_tco2e": world_b_state.carbon_impact_tco2e,
        "recovery_time_days": _delta(world_b_metrics.recovery_time_days, world_a_metrics.recovery_time_days),
        "residual_impact": _delta(world_b_metrics.residual_impact, world_a_metrics.residual_impact),
    }

    return CompareWorldsResult(
        scenario_id=result.scenario_id,
        world_a_label="shock_no_intervention",
        world_b_label=world_b_label,
        world_a_state=world_a_state,
        world_b_state=world_b_state,
        world_a_recovery=world_a_recovery,
        world_b_recovery=world_b_recovery,
        world_a_metrics=world_a_metrics,
        world_b_metrics=world_b_metrics,
        deltas=deltas,
        affected_geographies=result.affected_geographies,
        affected_food_categories=result.affected_food_categories,
        provenance_refs=result.provenance_refs,
        limitations=result.limitations
        + [
            "deltas for demand_impact_fraction/resilience_score/resilience_gap/recovery_time_days/"
            "residual_impact are World B minus World A (negative demand_impact/residual_impact/"
            "recovery_time deltas indicate improvement; positive resilience_score deltas indicate "
            "improvement). food_availability_effect_proxy/food_loss_effect/cost/water/carbon are World B's "
            "own values relative to the implicit zero-cost, zero-effect World A baseline."
        ],
    )
