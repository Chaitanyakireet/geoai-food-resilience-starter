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

## Digital Twin + Recovery (Hours 18-21)
`backend/twin/` composes (does not modify) the shock composer, portfolio
engine, optimizer, resilience proxy, and risk baseline, and adds one new
piece: a deterministic recovery model. This is a scenario/decision-support
simulation, not a live operational twin and not a validated real-world
recovery forecast. Endpoints, served under `/twin`:
- `POST /twin/run` — a `TwinScenario` → baseline/shocked/intervention/
  optimized states plus per-state recovery trajectories and metrics
- `POST /twin/compare` — Compare Worlds: World A (shock, no intervention)
  vs. World B (optimized if present, else the manual portfolio), with
  explicit deltas
- `GET /twin/scenarios` — catalog of the four canonical scenario types and
  how to construct each from `TwinScenario`'s fields (stateless API, no
  runs are persisted)
- `GET /twin/config`, `GET /twin/provenance`

Scenario types implemented: **A** baseline/no shock (district, mandal, or
state-level `"telangana"` aggregate), **B** shock/no intervention, **C**
shock + optimizer-selected portfolio, **D** shock + a manual alternative
portfolio (settable in the same run as C for direct comparison).

Recovery model (`config/twin.yaml`): deterministic exponential decay,
`demand_impact(day) = initial_impact * (1 - recovery_rate)^day`, resilience
recovering toward the pre-shock baseline the same way. `recovery_rate` is
an ESTIMATED assumed daily closure fraction — explicitly **not** fit to any
observed Telangana recovery event (none exists in this sprint's data).
Metrics (peak/final disruption, recovery_time_days, recovery_fraction,
resilience_gap before/after, residual_impact) are each defined in the
result payload itself (`RecoveryMetrics.definitions`), not just in code.

## Website shell (Hours 21-29)
`frontend/src/` replaces the Hours 0-2 reachability placeholder with the
locked 7-section information architecture: Command Center, Spatial
Intelligence, Food Network, Intervention Lab, Digital Twin, AI Decision
Brief, Impact & Responsible AI (`frontend/src/components/Sidebar.tsx`).
Command Center (`frontend/src/app/page.tsx`) is fully live: mean risk score,
food-network size/connectivity, and bottleneck-count stat tiles, a top-5
risk-hotspots table, a truth-status/provenance disclosure panel, and a
static risk choropleth (`frontend/src/components/ChoroplethPreview.tsx`) --
real `/gis/districts` geometry + real `/risk/state` classification through
an approximate equirectangular projection. The other five pages (Food
Network, Intervention Lab, Digital Twin, AI Decision Brief, Impact &
Responsible AI) are real, API-backed previews with an explicit "coming
next" notice where interactive/RAG/Copilot pieces are intentionally
deferred. All data is live from the backend; nothing is a fabricated
placeholder value. Fixed one integration bug found during the Hours 21-24
vertical check: CORS only allowlisted GET, which silently blocked every
POST endpoint (interventions, optimization, twin) from the browser.

## Spatial Intelligence GIS workspace (Hours 29-33)
`/spatial` (`frontend/src/components/spatial/`) replaces the static
choropleth preview with a real interactive Leaflet workspace: Telangana
state boundary, all 33 districts, and mandals loaded on demand per selected
district (`/gis/telangana`, `/gis/districts`, `/gis/mandals`), pan/zoom/
hover/click, and a risk choropleth layer toggle backed by `/risk/state`
with a legend, an "insufficient data" class, and a truth-status-labeled
layer control. Clicking a district/mandal opens a Location Intelligence
panel (`LocationPanel.tsx`): risk/confidence/data-coverage/truth-status,
a driver table, a deterministic template-based "Why here?" explanation
(`lib/whyHere.ts`, no LLM), food-network structural-bottleneck context
where available, and a link to a full provenance drawer
(`/gis/provenance` + `/risk/provenance`). Mandal selections explicitly
disclose that the risk engine is district-centroid based and the mandal
result is inherited (surfacing the backend's own `resolved_via` field).
Search resolves districts/loaded mandals by name; a coordinates form uses
`/gis/location`. A `TemporalNote` states plainly that only a current-
conditions snapshot exists -- no fabricated historical time series. Mandal
GeoJSON is fetched once per district and cached client-side, not
re-downloaded on repeat selection. Backend-down and malformed-GeoJSON
states are handled explicitly (verified by stopping the backend and
re-fetching `/spatial`).

## Current state
Hours 0-33 done: both services boot, 179 backend tests pass, and the
frontend build/lint are clean across all 7 routes. The Telangana spatial
layer, a climate-driven risk baseline, a food-system network with
bottleneck/propagation diagnostics, a shock/intervention/portfolio decision
layer, a multi-objective portfolio optimizer, a Digital Twin with recovery
simulation and Compare Worlds, a real website shell, and a real interactive
Spatial Intelligence GIS workspace are live. RAG/AI Copilot and the
interactive Food Network / Intervention Lab / Digital Twin workspaces
(later Day 2 tasks per `docs/MASTER_HANDOFF.md`) are not yet implemented.
Nothing here is fabricated; every value carries a truth_status and traces
to a provenance file.
