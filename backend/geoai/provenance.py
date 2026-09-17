"""Loads the dataset provenance registry written by scripts/build_spatial_layer.py."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PROVENANCE_PATH = REPO_ROOT / "data" / "processed" / "provenance.json"


@lru_cache(maxsize=1)
def load_provenance() -> dict:
    with open(PROVENANCE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
