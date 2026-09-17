"""GeoAI Food-Resilience Digital Twin -- backend API entrypoint.

Hours 0-2 foundation scope only: expose a healthcheck that proves the
service boots and reflects the locked project configuration. Analytical
modules (GeoAI, risk, graph, optimization, digital twin, etc.) are added
in later tasks per the 48-hour build order in docs/MASTER_HANDOFF.md.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import load_project_config

app = FastAPI(title="GeoAI Food-Resilience Digital Twin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    config = load_project_config()
    project = config["project"]
    architecture = config["architecture"]
    return {
        "status": "ok",
        "service": "geoai-food-resilience-backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version.split()[0],
        "project": {
            "name": project["name"],
            "region": project["region"],
            "product_type": project["product_type"],
            "food_scope": project["food_scope"],
            "primary_sdg": project["primary_sdg"],
            "secondary_sdgs": project["secondary_sdgs"],
        },
        "loop_stages": architecture["loop"],
        "modules": architecture["modules"],
        "truth_status_labels": config["truth_status"],
    }
