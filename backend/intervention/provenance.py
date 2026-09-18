"""This module has no external dataset of its own -- it is a deterministic
scenario/decision layer over the existing risk, graph, and resilience
engines. Its 'provenance' is therefore an assumptions registry: which
config-driven, documented assumptions drive its outputs, and where they
come from."""
from __future__ import annotations

from backend.graph.config import load_graph_config
from backend.intervention.catalog import load_interventions_config
from backend.resilience.model import load_resilience_config


def build_intervention_provenance() -> dict:
    interventions_config = load_interventions_config()
    resilience_config = load_resilience_config()
    graph_config = load_graph_config()

    return {
        "nature": (
            "This layer computes no new external data. It composes the existing, separately-provenanced "
            "risk engine (GET /risk/provenance), food graph (GET /graph/provenance), and resilience proxy "
            "over documented, assumed parameters below. All shock/intervention outputs are labeled "
            "COUNTERFACTUAL (climate what-if recomputation) or SIMULATED (graph propagation / intervention "
            "modeling) -- never OBSERVED."
        ),
        "intervention_type_catalog": interventions_config["intervention_types"],
        "portfolio_composition_method": interventions_config["portfolio"]["effect_composition_method"],
        "resilience_model": resilience_config["resilience_model"],
        "propagation_config": graph_config["propagation"],
        "assumption_disclosure": [
            "Intervention default_effectiveness values (config/interventions.yaml) are illustrative, assumed "
            "figures for relative scenario comparison, not measured/field-validated effectiveness.",
            "resilience_model weights and target_resilience_score (config/resilience.yaml) are assumed, not "
            "fit to any external resilience benchmark.",
            "propagation decay_factor / min_impact_threshold (config/graph.yaml) are assumed, not fit to any "
            "observed shock/outcome data (reused unmodified from backend/graph, built in Hours 8-11).",
            "cost_estimate, water_impact_m3, carbon_impact_tco2e, and loss_reduction_pct are accepted only "
            "as caller-supplied values per intervention; this system never invents them.",
        ],
        "upstream_provenance_endpoints": ["/risk/provenance", "/graph/provenance", "/gis/provenance"],
    }
