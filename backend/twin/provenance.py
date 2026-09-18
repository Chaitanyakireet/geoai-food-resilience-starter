"""No new external dataset -- this layer composes backend/intervention,
backend/optimization, backend/graph, backend/resilience, and backend/risk
(all separately provenanced) plus its own documented recovery-model
assumptions."""
from __future__ import annotations

from backend.twin.config import load_twin_config


def build_twin_provenance() -> dict:
    config = load_twin_config()
    return {
        "nature": (
            "This layer computes no new external data. It composes the existing shock composer, "
            "intervention portfolio engine, multi-objective optimizer, resilience proxy, and risk baseline "
            "(each separately provenanced) with a new, documented deterministic recovery model. All "
            "results are labeled SIMULATED (or COUNTERFACTUAL for climate what-if risk recomputation)."
        ),
        "recovery_model": config["recovery_model"],
        "assumption_disclosure": [
            "recovery_rate is an ASSUMED daily closure fraction (exponential decay toward the pre-shock "
            "baseline), not fit to any observed Telangana recovery event -- no such historical dataset was "
            "available this sprint.",
            "The Digital Twin is a deterministic scenario/decision-support simulation, not a live "
            "operational twin, and does not claim a validated real-world recovery forecast or causal proof "
            "of intervention effectiveness.",
            "Every cost/water/carbon/effectiveness assumption feeding a scenario is inherited unmodified "
            "from backend/intervention and backend/optimization -- see their provenance endpoints.",
        ],
        "upstream_provenance_endpoints": [
            "/interventions/provenance",
            "/optimization/provenance",
            "/graph/provenance",
            "/risk/provenance",
            "/gis/provenance",
        ],
    }
