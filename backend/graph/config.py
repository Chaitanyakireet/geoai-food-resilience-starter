"""Loads config/graph.yaml (propagation decay, bottleneck thresholds)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
GRAPH_CONFIG_PATH = REPO_ROOT / "config" / "graph.yaml"


@lru_cache(maxsize=1)
def load_graph_config() -> dict:
    with open(GRAPH_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)
