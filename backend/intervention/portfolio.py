"""Portfolio composition: multiple interventions, deterministic aggregation.

Explicit, documented composition rule (config/interventions.yaml
portfolio.effect_composition_method = multiplicative_independent):
when every intervention in the portfolio targets the SAME shock (same
target_node_id, shock_type, severity), their effectivenesses combine as
combined_effectiveness = 1 - product(1 - effectiveness_i), applied ONCE to
the shock's original severity and re-propagated. This assumes independence
between interventions -- real synergy or conflict is NOT modeled (a
documented future extension, not pretended to be known). When interventions
target different shocks, no combined effect is computed (each stands alone;
resource totals still aggregate).

Cost/water/carbon are simple sums of whatever the caller supplied per
intervention -- an accounting aggregation, not a claim about how modeled
EFFECTS interact.
"""
from __future__ import annotations

from backend.graph.contracts import ShockInput
from backend.graph.graph_builder import get_food_graph
from backend.graph.propagation import propagate_shock
from backend.intervention.catalog import load_interventions_config
from backend.intervention.contracts import (
    ConstraintCheckEntry,
    Constraints,
    PortfolioInput,
    PortfolioResult,
)
from backend.intervention.engine import compute_intervention_effect
from backend.intervention.utils import impact_at_node


def _sum_optional(values: list[float | None]) -> tuple[float | None, bool]:
    present = [v for v in values if v is not None]
    if not present:
        return None, False
    return round(sum(present), 4), len(present) < len(values)


def compute_portfolio(inp: PortfolioInput) -> PortfolioResult:
    results = [compute_intervention_effect(i) for i in inp.interventions]
    limitations = [
        "Modeled combined effect (when computable) uses multiplicative composition on residual shock "
        "severity, assuming independent intervention effects -- real synergy/conflict between combined "
        "interventions is not modeled (a documented future extension).",
        "Cost/water/carbon totals are simple sums of caller-supplied per-intervention values -- an "
        "accounting aggregation, not a claim about how modeled effects interact.",
    ]

    target_node_ids = {i.shock.target_node_id for i in inp.interventions}
    shock_types = {i.shock.shock_type for i in inp.interventions}
    severities = {i.shock.severity for i in inp.interventions}
    max_hops_values = {i.shock.max_hops for i in inp.interventions}

    combined_food_availability_effect_proxy = None
    if len(target_node_ids) == 1 and len(shock_types) == 1 and len(severities) == 1:
        food_graph = get_food_graph()
        shared_target = next(iter(target_node_ids))
        original_severity = next(iter(severities))
        product_term = 1.0
        for r in results:
            product_term *= 1 - r.effectiveness_used
        combined_effectiveness = round(1 - product_term, 4)

        combined_severity = round(original_severity * (1 - combined_effectiveness), 4)
        combined_shock = ShockInput(
            target_node_id=shared_target,
            shock_type=next(iter(shock_types)),
            severity=combined_severity,
            max_hops=max(max_hops_values),
        )
        combined_propagation = propagate_shock(food_graph.graph, combined_shock)

        geo_id = results[0].affected_geo_id
        demand_node_id = f"demand_{geo_id}"
        combined_demand_impact = impact_at_node(combined_propagation, demand_node_id)
        original_demand_impact = impact_at_node(results[0].shock_propagation, demand_node_id)
        combined_food_availability_effect_proxy = round(original_demand_impact - combined_demand_impact, 4)
        limitations.append(
            f"combined_effectiveness={combined_effectiveness} computed via 1 - product(1 - effectiveness_i) "
            f"across {len(results)} interventions sharing shock target '{shared_target}'."
        )
    else:
        limitations.append(
            "Interventions target different shocks (varying target_node_id/shock_type/severity); no single "
            "combined_target_impact_reduction is computed -- each intervention's modeled effect stands alone."
        )

    total_cost, cost_partial = _sum_optional([r.cost_estimate for r in results])
    total_water, water_partial = _sum_optional([r.water_impact_m3 for r in results])
    total_carbon, carbon_partial = _sum_optional([r.carbon_impact_tco2e for r in results])
    if cost_partial:
        limitations.append("total_cost_estimate is a partial sum -- not every intervention had a cost_estimate supplied.")
    if water_partial:
        limitations.append("total_water_impact_m3 is a partial sum -- not every intervention had a water_impact_m3 supplied.")
    if carbon_partial:
        limitations.append("total_carbon_impact_tco2e is a partial sum -- not every intervention had a carbon_impact_tco2e supplied.")

    constraints = inp.constraints or Constraints()
    constraint_check = {
        "budget": ConstraintCheckEntry(
            limit=constraints.budget,
            total=total_cost,
            within_limit=(total_cost <= constraints.budget) if (total_cost is not None and constraints.budget is not None) else None,
        ),
        "water_limit": ConstraintCheckEntry(
            limit=constraints.water_limit_m3,
            total=total_water,
            within_limit=(total_water <= constraints.water_limit_m3)
            if (total_water is not None and constraints.water_limit_m3 is not None)
            else None,
        ),
        "carbon_target": ConstraintCheckEntry(
            limit=constraints.carbon_target_tco2e,
            total=total_carbon,
            within_limit=(total_carbon <= constraints.carbon_target_tco2e)
            if (total_carbon is not None and constraints.carbon_target_tco2e is not None)
            else None,
        ),
    }

    return PortfolioResult(
        interventions=results,
        combined_effect_composition_method=load_interventions_config()["portfolio"]["effect_composition_method"],
        combined_food_availability_effect_proxy=combined_food_availability_effect_proxy,
        total_cost_estimate=total_cost,
        total_water_impact_m3=total_water,
        total_carbon_impact_tco2e=total_carbon,
        constraint_check=constraint_check,
        provenance_refs=["backend/graph food network graph", "backend/resilience proxy", "config/interventions.yaml"],
        limitations=limitations,
    )
