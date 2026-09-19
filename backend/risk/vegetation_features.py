"""Loads the processed vegetation (NDVI) feature table built by
scripts/build_vegetation_features.py. Mirrors backend/risk/features.py's
climate-feature loader. Optional by design: a district missing from this
table (fetch failure, or genuinely zero quality-passing composites) simply
gets no vegetation_condition driver rather than a fabricated one -- callers
must treat a missing row as "not available", not as an error."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
VEGETATION_FEATURES_PATH = REPO_ROOT / "data" / "processed" / "vegetation_features.json"


@lru_cache(maxsize=1)
def load_vegetation_feature_table() -> dict[str, dict]:
    if not VEGETATION_FEATURES_PATH.exists():
        return {}
    with open(VEGETATION_FEATURES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {row["geo_id"]: row for row in data["features"]}


def get_district_vegetation_row(district_id: str) -> Optional[dict]:
    return load_vegetation_feature_table().get(district_id)
