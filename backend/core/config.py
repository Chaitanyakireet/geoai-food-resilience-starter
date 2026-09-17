"""Loads the locked project configuration from config/project.yaml.

This is the single source of truth for project locks (region, food scope,
SDGs, loop stages, module list, truth-status labels) consumed by the API
and, eventually, every backend module. Nothing here is fabricated; it is a
direct read of the committed YAML config.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = REPO_ROOT / "config" / "project.yaml"


@lru_cache(maxsize=1)
def load_project_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)
