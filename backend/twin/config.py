"""Loads config/twin.yaml."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
TWIN_CONFIG_PATH = REPO_ROOT / "config" / "twin.yaml"


@lru_cache(maxsize=1)
def load_twin_config() -> dict:
    with open(TWIN_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)
