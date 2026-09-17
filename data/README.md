# data

Keep raw, cached, derived, and simulated data provenance explicit.

## Spatial layer (Telangana boundaries)
- `raw/` — untracked (see `.gitignore`) OpenStreetMap/GADM pulls fetched via
  Overpass + Nominatim. Not reproducible byte-for-byte (OSM data changes),
  but the fetch steps are documented in `scripts/build_spatial_layer.py` and
  its provenance output.
- `processed/` — tracked. `telangana_state.geojson`, `telangana_districts.geojson`
  (33 features), `telangana_mandals.geojson` (593 features), and
  `provenance.json` (full source/license/limitation registry, served live at
  `GET /gis/provenance`). Regenerate with:
  `.venv\Scripts\python scripts\build_spatial_layer.py`
- Known limitation: the master handoff's P0 source (TGRAC ArcGIS REST) was
  unreachable from the build environment; OpenStreetMap was used instead as
  the most current openly-licensed fallback. Full detail in `provenance.json`.

## Climate features (risk engine input)
- `raw/nasa_power/` — untracked. Raw NASA POWER climatology + daily JSON per
  district centroid.
- `processed/climate_features.json` — tracked. OBSERVED NASA POWER values
  (T2M, T2M_MAX, PRECTOTCORR) plus the 2001-2020 climatological baseline, per
  district, with data-coverage metadata. Regenerate with:
  `.venv\Scripts\python scripts\build_climate_features.py`
- `processed/climate_provenance.json` — source/license/limitation registry
  for the climate data, served at `GET /risk/provenance`.
- `processed/risk_validation_report.json` — spatial smoothness + temporal
  spot-check + leakage-check diagnostics for the baseline risk model (not
  accuracy metrics -- see `backend/risk/validation.py` docstring for why).
  Regenerate with: `.venv\Scripts\python scripts\validate_risk_baseline.py`
- Known limitation: features are computed at district centroids only
  (33 points); mandal-level risk currently inherits its parent district's
  value. `T2M_MAX` climatology and observed values are not confirmed to be
  on the same statistical basis and are excluded from the risk score (see
  `backend/risk/baseline_model.py`).

## Food network graph
- `raw/food_graph/osm_markets_raw.json` — untracked. Raw OSM marketplace POI
  query result.
- `processed/food_graph.json` — tracked. 165 nodes (33 districts x
  production/aggregation/storage/market/demand) + 318 edges. Regenerate with:
  `.venv\Scripts\python scripts\build_food_graph.py`
- `processed/food_graph_provenance.json` — source/license/limitation
  registry, served at `GET /graph/provenance`, including an
  `unobtained_sources` section documenting AGMARKNET/e-NAM, Telangana State
  Warehousing Corporation/FCI, and Telangana DES production statistics as
  sources that were sought but not programmatically obtainable this sprint.
- Known limitation: only market nodes carry real data (OpenStreetMap POIs,
  29/33 districts matched; the rest are labeled SIMULATED placeholders).
  Production nodes are DERIVED (real districts, no real volume);
  aggregation/storage/most-demand nodes are SIMULATED scenario placeholders
  -- no real facility-level dataset was obtained. No edge carries a real
  flow volume or transport capacity. See `backend/graph/service.py`'s
  `GRAPH_LIMITATIONS` for the full list served via the API.
