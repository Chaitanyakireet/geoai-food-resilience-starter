# GeoAI Food-Resilience Digital Twin

Starter repository for the 48-hour Hyderabad–Telangana project.

## Non-negotiable project locks
- Proper web platform, not a mobile app.
- Hyderabad–Telangana regional food system.
- Multi-food / food-agnostic; never narrow to rice-only.
- SDG 2 primary; SDGs 6, 7, 8, 9, 11, 12, 13, 15, 17 secondary.
- GIS / spatial intelligence is central to the product experience.
- Core loop: Sense → Predict → Diagnose/Trace → Reason → Optimize → Simulate → Recover → Verify/Impact → Explain → Human Review.
- Numeric calculations are deterministic; the LLM explains/orchestrates and does not invent or override numbers.
- Truth status labels: OBSERVED, DERIVED, ESTIMATED, COUNTERFACTUAL, SIMULATED.

## Repository rule
Treat `docs/MASTER_HANDOFF.md` and the full DOCX as the project source of truth. Do not redesign or narrow the scope.

## Architecture decision (Hours 0-2 foundation task)
- `backend/` — Python 3.12 analytical/backend service (FastAPI). Owns GeoAI/GIS
  processing, risk engine, food-network graph, intervention logic, optimization,
  digital twin, recovery/impact, data/provenance, and all deterministic
  simulation logic. One service; do not split into microservices without a
  genuine need.
- `frontend/` — Node.js/TypeScript (Next.js). Owns the GIS/map UX, navigation,
  dashboards, intervention workflows, Compare Worlds, Digital Twin
  visualization, AI Copilot interface, truth-status display, evidence/
  provenance UI, and Responsible AI UI.
- `src/` and `web/` are superseded placeholders from the original scaffold,
  kept (not deleted) for history; see their READMEs.

## Running the backend
```
cd backend  # requirements.txt lives here; venv at repo root
..\.venv\Scripts\python -m uvicorn backend.api.main:app --reload --app-dir ..
```
Or from the repo root: `.venv\Scripts\python -m uvicorn backend.api.main:app --reload`.
Health check: `GET http://localhost:8000/health`.

## Running the frontend
```
cd frontend
npm install
npm run dev
```
Open http://localhost:3000 — it fetches the backend `/health` endpoint and
shows a "Backend reachable" panel with the live locked config, or a red
"Backend unreachable" notice if the backend isn't running.

## Tests
```
.venv\Scripts\python -m pytest tests\
```

## GIS API (Hours 2-5)
`backend/geoai/spatial_layer.py` is the reusable spatial layer every later
module (risk, food graph, optimization, digital twin) will load boundaries
from. Endpoints, served under `/gis`:
- `GET /gis/telangana` — state boundary
- `GET /gis/districts`, `GET /gis/districts/{district_id}` — 33 districts, with mandal counts
- `GET /gis/mandals?district_id=...` — 593 mandals, optionally filtered
- `GET /gis/location?lon=..&lat=..` — point-in-polygon district/mandal lookup
- `GET /gis/provenance` — full dataset source/license/limitation registry
- `GET /gis/validate` — geometry validity + CRS report for all layers

See `data/README.md` for the data pipeline and known source limitations.

## Risk API (Hours 5-8)
`backend/risk/` is a transparent, deterministic baseline -- not a fitted ML
model (no labeled food-system-disruption outcome data exists to train or
validate one against; see `backend/risk/baseline_model.py` docstring).
Endpoints, served under `/risk`:
- `GET /risk?geo_id=...&food_category=...` — RiskResult for a district or
  mandal (mandals inherit their parent district's result, clearly flagged)
- `GET /risk/state?food_category=...` — unweighted state-level mean + all
  33 district results
- `GET /risk/config` — current model weights/thresholds (transparency)
- `GET /risk/provenance` — NASA POWER dataset source/license/limitations
- `GET /risk/validation-report` — spatial/temporal/leakage diagnostics

RiskResult matches the field names in `docs/MASTER_HANDOFF.md` section 11
(`region_id`, `food_scope`, `risk_score`, `risk_class`, `confidence`,
`uncertainty_interval`, `major_drivers`, `data_coverage`, `model_version`,
`run_id`, `truth_status`), plus `provenance_refs` and `limitations`. See
`data/README.md` for what the proxy does and does not measure.

## Food Network API (Hours 8-11)
`backend/graph/` models production -> aggregation -> storage -> market ->
demand as a NetworkX `DiGraph`, per district, plus a real cross-district
transport backbone. Endpoints, served under `/graph`:
- `GET /graph/overview?food_category=...&geo_id=...` — GraphResult (nodes,
  edges, bottlenecks, connectivity summary)
- `GET /graph/nodes`, `GET /graph/edges` — filtered node/edge lists
- `GET /graph/bottlenecks` — graph-theoretic candidates (articulation
  points, high betweenness, high in-degree/"dependency concentration"),
  explicitly labeled as structural properties, not confirmed real-world
  importance
- `POST /graph/propagate` — deterministic SIMULATED shock cascade
  (`{target_node_id, shock_type, severity, max_hops}`)
- `GET /graph/provenance` — what's real (OSM markets, district adjacency)
  vs. simulated, and what sources were sought but not obtained

Only market nodes carry real external data (OpenStreetMap POIs, 29/33
districts); production/aggregation/storage/demand nodes are DERIVED from
administrative geography or clearly labeled SIMULATED scenario placeholders
-- no facility, capacity, or trade-volume number is invented anywhere in
the graph. See `data/README.md` for the full breakdown.

## Current state
Hours 0-11 done: both services boot, the frontend proves live reachability
to the backend, and 78 tests pass (health + GIS + risk + graph). The
Telangana spatial layer, a climate-driven risk baseline, and a food-system
network with bottleneck/propagation diagnostics are live behind documented
APIs. No further analytical modules (optimization, digital twin, RAG,
copilot) are implemented yet — they follow the build order in
`docs/MASTER_HANDOFF.md` section 19. Nothing here is fabricated; every
value carries a truth_status and traces to a provenance file.
