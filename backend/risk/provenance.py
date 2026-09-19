"""Loads the climate + vegetation dataset provenance registries written by
scripts/build_climate_features.py and scripts/build_vegetation_features.py."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PROVENANCE_PATH = REPO_ROOT / "data" / "processed" / "climate_provenance.json"
VEGETATION_PROVENANCE_PATH = REPO_ROOT / "data" / "processed" / "vegetation_provenance.json"


@lru_cache(maxsize=1)
def load_climate_provenance() -> dict:
    with open(PROVENANCE_PATH, "r", encoding="utf-8") as f:
        climate = json.load(f)

    # Vegetation provenance is optional -- scripts/build_vegetation_features.py
    # needs a free NASA Earthdata Login account, so a fresh checkout without
    # it configured simply won't have this file yet. Merge its dataset entry
    # in when present rather than exposing a second endpoint the frontend
    # would need to know to also call.
    if VEGETATION_PROVENANCE_PATH.exists():
        with open(VEGETATION_PROVENANCE_PATH, "r", encoding="utf-8") as f:
            vegetation = json.load(f)
        climate = {**climate, "datasets": [*climate.get("datasets", []), *vegetation.get("datasets", [])]}

    return climate
