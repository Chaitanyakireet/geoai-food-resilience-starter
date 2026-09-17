"""Loads the model config (config/features.yaml) and the processed climate
feature table (data/processed/climate_features.json) built by
scripts/build_climate_features.py."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
FEATURES_CONFIG_PATH = REPO_ROOT / "config" / "features.yaml"
CLIMATE_FEATURES_PATH = REPO_ROOT / "data" / "processed" / "climate_features.json"


@lru_cache(maxsize=1)
def load_features_config() -> dict:
    with open(FEATURES_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


@lru_cache(maxsize=1)
def load_climate_feature_table() -> dict[str, dict]:
    if not CLIMATE_FEATURES_PATH.exists():
        raise FileNotFoundError(
            f"{CLIMATE_FEATURES_PATH} not found -- run scripts/build_climate_features.py first"
        )
    with open(CLIMATE_FEATURES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {row["geo_id"]: row for row in data["features"]}


def get_district_feature_row(district_id: str) -> Optional[dict]:
    return load_climate_feature_table().get(district_id)


REQUIRED_FEATURE_SCHEMA_KEYS = {
    "geo_id",
    "geo_level",
    "date",
    "observed",
    "climatology_baseline",
    "data_coverage",
}
