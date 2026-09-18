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

## Shock Composer + Intervention Engine (Hours 11-15)
`backend/intervention/` and `backend/resilience/` compose (do not modify)
the risk and graph engines into a decision layer. RISK, RESILIENCE, and
RESILIENCE_GAP are kept as three distinct values — resilience is a
composite of graph transport redundancy, graph-theoretic bottleneck status,
and inverse climate risk (`config/resilience.yaml`), never `1 - risk`.
Endpoints, served under `/interventions`:
- `POST /interventions/shock` — structured shock (climate + graph fields)
  → baseline/shocked risk (COUNTERFACTUAL), baseline/shocked resilience,
  graph propagations (SIMULATED)
- `POST /interventions/test` — one intervention against a graph shock,
  reusing `backend/graph/propagation.py` with severity reduced by the
  intervention's effectiveness
- `POST /interventions/portfolio` — multiple interventions + optional
  budget/water/carbon constraints; same-shock interventions combine via a
  documented multiplicative (not linear) composition
- `GET /interventions/catalog` — the four intervention types (alternative
  sourcing, storage redistribution, route diversification, resource
  efficiency), extensible via `config/interventions.yaml`
- `GET /interventions/provenance` — assumption disclosure (this layer adds
  no new external data; it documents which config-driven assumptions drive
  its outputs)

No cost, water, carbon, or effectiveness figure is invented: effectiveness
defaults are clearly labeled ESTIMATED illustrative assumptions, and cost/
water/carbon are only ever echoes of caller-supplied values.

## Multi-Objective Optimizer (Hours 15-18)
`backend/optimization/` composes (does not modify) `backend/intervention`,
`backend/graph`, `backend/resilience`, and `backend/risk` into a brute-force
portfolio optimizer. Method: enumerate every non-empty subset of the
(capped, default 8) candidate interventions, evaluate each via the
existing `compute_portfolio`, and rank feasible ones with a transparent
weighted score — while always returning every candidate's raw, unweighted
objective values and a Pareto-optimality flag, so the weighting is one
disclosed lens, not the only view. Endpoints, served under `/optimization`:
- `POST /optimization/run` — full candidate set + selection + explanation
  in one response (also serves the future Intervention Lab / Compare
  Worlds UI — no separate endpoint needed since nothing is stateful)
- `GET /optimization/config` — objective weights, normalization method,
  max_candidates
- `GET /optimization/provenance` — assumption disclosure

Objectives: PRIMARY food_availability_effect_proxy + resilience_effect
(maximize), SECONDARY food_loss_effect (maximize where supplied), cost/
water/carbon (minimize where supplied). Weights (`config/optimization.yaml`)
are disclosed ESTIMATED assumptions, not derived — overridable per request.
Normalization is min-max, relative to each run's own candidate set. A
"selected" portfolio is always phrased as modeled best under the configured
objectives/constraints, never an unconditional optimality claim; when no
candidate satisfies the given constraints, nothing is selected rather than
silently picking an infeasible one.

## Current state
Hours 0-18 done: both services boot, the frontend proves live reachability
to the backend, and 142 tests pass (health + GIS + risk + graph +
interventions + optimization). The Telangana spatial layer, a
climate-driven risk baseline, a food-system network with bottleneck/
propagation diagnostics, a shock/intervention/portfolio decision layer, and
a multi-objective portfolio optimizer are live behind documented APIs. No
further analytical modules (digital twin, RAG, copilot) are implemented
yet — they follow the build order in `docs/MASTER_HANDOFF.md` section 19.
Nothing here is fabricated; every value carries a truth_status and traces
to a provenance file.
