"""Catalog of canonical scenario archetypes (GET /twin/scenarios). This API
is stateless -- no scenario runs are persisted -- so this describes the
scenario TYPES the engine supports and how to construct a TwinScenario for
each, not a list of stored instances. The architecture accepts additional
archetypes later without changing TwinScenario itself (they are just
different combinations of its already-optional fields)."""
from __future__ import annotations

SCENARIO_CATALOG = {
    "A_baseline": {
        "label": "Baseline / no shock",
        "description": "Current risk and resilience for a geography, no shock applied.",
        "how_to_construct": "TwinScenario with geo_id set and shock/heat_change_c/rainfall_change_pct all omitted.",
    },
    "B_shock_no_intervention": {
        "label": "Shock / no intervention",
        "description": "A defined shock (climate and/or graph) applied with no counteracting intervention.",
        "how_to_construct": "TwinScenario with `shock` and/or heat_change_c/rainfall_change_pct set, "
        "intervention_portfolio and optimize_candidates both omitted.",
    },
    "C_shock_optimized_intervention": {
        "label": "Shock + selected/optimized intervention",
        "description": "A shock countered by the intervention portfolio the Hours 15-18 optimizer selects "
        "from a candidate pool, under given constraints.",
        "how_to_construct": "TwinScenario with `shock` set and `optimize_candidates` populated "
        "(optionally `constraints`, `objective_weights`).",
    },
    "D_shock_alternative_intervention": {
        "label": "Shock + alternative (manual) intervention portfolio",
        "description": "A shock countered by a caller-specified fixed portfolio, for side-by-side "
        "comparison against the optimizer's pick.",
        "how_to_construct": "TwinScenario with `shock` set and `intervention_portfolio` populated. Set both "
        "`intervention_portfolio` and `optimize_candidates` on one scenario to get C and D in a single run.",
    },
}


def get_scenario_catalog() -> dict:
    return {
        "scenario_types": SCENARIO_CATALOG,
        "note": (
            "This API is stateless: POST /twin/run always computes a fresh result from the TwinScenario you "
            "send, it does not store or replay past runs. This catalog documents how to construct each "
            "canonical scenario type; the same TwinScenario schema supports further archetypes later "
            "(e.g. multiple sequential shocks) without a contract change."
        ),
    }
