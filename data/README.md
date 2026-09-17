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
