"""Loads config/interventions.yaml. New intervention types can be added
there without code changes; an unlisted type is also accepted at the API
level as long as the caller supplies an explicit effectiveness_override."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
INTERVENTIONS_CONFIG_PATH = REPO_ROOT / "config" / "interventions.yaml"


@lru_cache(maxsize=1)
def load_interventions_config() -> dict:
    with open(INTERVENTIONS_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_intervention_type(intervention_type: str) -> dict | None:
    return load_interventions_config()["intervention_types"].get(intervention_type)


def resolve_effectiveness(intervention_type: str, effectiveness_override: float | None) -> tuple[float, str, str, str]:
    """Returns (effectiveness, source, label, mechanism)."""
    catalog_entry = get_intervention_type(intervention_type)

    if effectiveness_override is not None:
        label = catalog_entry["label"] if catalog_entry else intervention_type
        mechanism = catalog_entry["mechanism"] if catalog_entry else "User-defined intervention type (not in config/interventions.yaml catalog)."
        return effectiveness_override, "user_override", label, mechanism

    if catalog_entry is None:
        raise ValueError(
            f"Unknown intervention_type '{intervention_type}' is not in config/interventions.yaml and no "
            "effectiveness_override was supplied -- either use a cataloged type or supply an override."
        )
    return catalog_entry["default_effectiveness"], "config_default", catalog_entry["label"], catalog_entry["mechanism"]
