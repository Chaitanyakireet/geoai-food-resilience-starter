"""GeoAI Food-Resilience Digital Twin -- backend API entrypoint.

Hours 0-2: healthcheck reflecting the locked project configuration.
Hours 2-5: GIS endpoints (backend/api/gis.py) serving processed Telangana
administrative boundaries. Remaining analytical modules (risk, food graph,
optimization, digital twin, etc.) are added in later tasks per the 48-hour
build order in docs/MASTER_HANDOFF.md.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.ai import router as ai_router
from backend.api.gis import router as gis_router
from backend.api.graph import router as graph_router
from backend.api.interventions import router as interventions_router
from backend.api.optimization import router as optimization_router
from backend.api.risk import router as risk_router
from backend.api.twin import router as twin_router
from backend.core.config import load_project_config

app = FastAPI(title="GeoAI Food-Resilience Digital Twin API")
app.include_router(gis_router)
app.include_router(risk_router)
app.include_router(graph_router)
app.include_router(interventions_router)
app.include_router(optimization_router)
app.include_router(twin_router)
app.include_router(ai_router)


# Local dev origins are always allowed; production frontend origin(s) come
# from an env var (comma-separated for more than one, e.g. a Railway
# preview + production URL) since the deployed frontend's domain isn't
# knowable at code-authoring time.
_default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_extra_origins = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_methods=["GET", "POST"],
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
