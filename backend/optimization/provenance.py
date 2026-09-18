"""No new external dataset -- this layer composes backend/intervention,
backend/graph, backend/resilience, and backend/risk (all separately
provenanced) plus its own documented objective-weighting assumptions."""
from __future__ import annotations

from backend.optimization.config import load_optimization_config


def build_optimization_provenance() -> dict:
    config = load_optimization_config()
    return {
        "nature": (
            "This layer computes no new external data. It brute-force searches combinations of "
            "backend/intervention portfolios (GET /interventions/provenance) over the existing risk "
            "(GET /risk/provenance), graph (GET /graph/provenance), and resilience engines, ranked by a "
            "documented, assumed objective weighting. All results are labeled SIMULATED."
        ),
        "objective_weights_default": config["objective_weights"],
        "normalization_method": config["normalization_method"],
        "max_candidates": config["max_candidates"],
        "assumption_disclosure": [
            "objective_weights are assumed illustrative weights for demonstration/ranking only, not derived "
            "from any policy or empirical source -- overridable per-request via OptimizationInput.objective_weights.",
            "Normalization is relative to each run's own candidate set (min-max), not an absolute external scale.",
            "'Selected' is the modeled-best candidate under these weights and constraints for this run, not "
            "a claim of real-world optimality.",
            "Every objective value, cost/water/carbon figure, and effectiveness assumption this layer uses "
            "is inherited unmodified from backend/intervention, backend/graph, and backend/risk -- see their "
            "provenance endpoints for the underlying data discipline.",
        ],
        "upstream_provenance_endpoints": ["/interventions/provenance", "/graph/provenance", "/risk/provenance", "/gis/provenance"],
    }
