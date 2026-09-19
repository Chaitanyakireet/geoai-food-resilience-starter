"""Loads config/carbon_factors.yaml -- the emissions-factor registry."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

from backend.carbon.contracts import CarbonFactor

REPO_ROOT = Path(__file__).resolve().parents[2]
CARBON_FACTORS_PATH = REPO_ROOT / "config" / "carbon_factors.yaml"


@lru_cache(maxsize=1)
def load_carbon_factors() -> dict[str, CarbonFactor]:
    with open(CARBON_FACTORS_PATH, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return {row["factor_id"]: CarbonFactor(**row) for row in raw["factors"]}


def get_factor(factor_id: str) -> Optional[CarbonFactor]:
    return load_carbon_factors().get(factor_id)


def list_factors() -> list[CarbonFactor]:
    return list(load_carbon_factors().values())
