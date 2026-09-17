"""Build the processed Telangana spatial data layer from raw source extracts.

Deterministic, reproducible pipeline (no LLM, no invented values):
  data/raw/telangana_districts_osm_raw.geojson  (33 districts, OSM admin_level=5)
  data/raw/telangana_mandals_osm_merged.geojson (593 mandals, OSM admin_level=6)
      -> data/processed/telangana_districts.geojson
      -> data/processed/telangana_mandals.geojson   (district_id attached via spatial join)
      -> data/processed/telangana_state.geojson      (dissolve of districts)
      -> data/processed/provenance.json

Re-run with: .venv\\Scripts\\python scripts\\build_spatial_layer.py
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "data" / "raw"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Metric CRS used only for area calculation (UTM zone 44N covers Telangana).
# All output geometry is stored in EPSG:4326 (WGS84), the web/GeoJSON standard.
METRIC_CRS = "EPSG:32644"
OUTPUT_CRS = "EPSG:4326"


def slugify(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", normalized).strip("_").lower()
    return slug


def build_districts() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(RAW_DIR / "telangana_districts_osm_raw.geojson")
    gdf = gdf[["osm_id", "name", "geometry"]].copy()
    gdf["district_id"] = gdf["name"].apply(slugify)
    if gdf["district_id"].duplicated().any():
        raise ValueError("Duplicate district_id after slugify -- source data changed shape")

    metric = gdf.set_geometry("geometry").to_crs(METRIC_CRS)
    gdf["area_sq_km"] = (metric.geometry.area / 1_000_000).round(2)
    centroid_metric = metric.geometry.centroid
    centroid_wgs84 = gpd.GeoSeries(centroid_metric, crs=METRIC_CRS).to_crs(OUTPUT_CRS)
    gdf["centroid_lon"] = centroid_wgs84.x.round(6)
    gdf["centroid_lat"] = centroid_wgs84.y.round(6)
    gdf["truth_status"] = "OBSERVED"

    gdf = gdf.set_crs(OUTPUT_CRS, allow_override=True) if gdf.crs is None else gdf.to_crs(OUTPUT_CRS)
    return gdf[
        ["district_id", "name", "osm_id", "area_sq_km", "centroid_lon", "centroid_lat", "truth_status", "geometry"]
    ]


def build_mandals(districts: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(RAW_DIR / "telangana_mandals_osm_merged.geojson")
    gdf = gdf[["osm_id", "name", "geometry"]].copy()
    gdf["mandal_id"] = gdf.apply(lambda r: f"{slugify(r['name'])}_{r['osm_id']}", axis=1)
    if gdf["mandal_id"].duplicated().any():
        raise ValueError("Duplicate mandal_id after slugify -- source data changed shape")

    metric = gdf.set_geometry("geometry").to_crs(METRIC_CRS)
    gdf["area_sq_km"] = (metric.geometry.area / 1_000_000).round(2)
    centroid_metric = metric.geometry.centroid
    centroid_wgs84 = gpd.GeoSeries(centroid_metric, crs=METRIC_CRS).to_crs(OUTPUT_CRS)
    gdf["centroid_lon"] = centroid_wgs84.x.round(6)
    gdf["centroid_lat"] = centroid_wgs84.y.round(6)
    gdf["truth_status"] = "OBSERVED"

    # Spatial aggregation / hierarchy: assign each mandal to the district whose
    # polygon contains its centroid (deterministic point-in-polygon join).
    centroid_points = gpd.GeoDataFrame(
        gdf[["mandal_id"]], geometry=gpd.points_from_xy(gdf["centroid_lon"], gdf["centroid_lat"]), crs=OUTPUT_CRS
    )
    joined = gpd.sjoin(
        centroid_points, districts[["district_id", "name", "geometry"]], how="left", predicate="within"
    )
    joined = joined.rename(columns={"name": "district_name"})
    gdf = gdf.merge(joined[["mandal_id", "district_id", "district_name"]], on="mandal_id", how="left")

    unmatched = gdf["district_id"].isna().sum()
    if unmatched:
        print(f"WARNING: {unmatched} mandal(s) did not resolve to a containing district centroid-in-polygon match")

    gdf = gdf.to_crs(OUTPUT_CRS)
    return gdf[
        [
            "mandal_id",
            "name",
            "osm_id",
            "district_id",
            "district_name",
            "area_sq_km",
            "centroid_lon",
            "centroid_lat",
            "truth_status",
            "geometry",
        ]
    ]


def build_state(districts: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    dissolved = districts.dissolve()
    metric = dissolved.to_crs(METRIC_CRS)
    area_sq_km = round(float(metric.geometry.area.sum()) / 1_000_000, 2)
    state = gpd.GeoDataFrame(
        {
            "state_id": ["telangana"],
            "name": ["Telangana"],
            "area_sq_km": [area_sq_km],
            "district_count": [len(districts)],
            "truth_status": ["DERIVED"],
        },
        geometry=[dissolved.geometry.iloc[0]],
        crs=OUTPUT_CRS,
    )
    return state


def write_provenance(districts: gpd.GeoDataFrame, mandals: gpd.GeoDataFrame) -> None:
    now = datetime.now(timezone.utc).isoformat()
    provenance = {
        "generated_at": now,
        "datasets": [
            {
                "dataset_name": "Telangana district administrative boundaries",
                "publisher": "OpenStreetMap contributors",
                "source_url": "https://overpass-api.de/api/interpreter (Overpass query: boundary=administrative, admin_level=5, within OSM relation 3250963 'Telangana'); geometries via https://nominatim.openstreetmap.org/lookup",
                "access_date": now,
                "license": "Open Database License (ODbL) v1.0 -- https://opendatacommons.org/licenses/odbl/1-0/ -- requires attribution 'Data (c) OpenStreetMap contributors'",
                "geographic_level": "district (admin_level=5)",
                "crs": f"source {OUTPUT_CRS}; area computed via reprojection to {METRIC_CRS} (UTM 44N)",
                "processing": "Queried Overpass for admin_level=5 boundary=administrative relations within Telangana; fetched full polygon geometry via Nominatim batch lookup (format=geojson, polygon_geojson=1); validated geometry with shapely; assigned stable slug district_id; computed area_sq_km and centroid by reprojecting to EPSG:32644.",
                "truth_status": "OBSERVED",
                "feature_count": int(len(districts)),
                "limitations": (
                    "The master handoff's designated P0 source (TGRAC ArcGIS REST service, "
                    "tgrac.telangana.gov.in) was unreachable from this environment during the sprint "
                    "(connection timeout). GADM v4.1 was evaluated as a fallback but only encodes the "
                    "pre-2016 10-district structure and was rejected as out of date. OpenStreetMap was used "
                    "instead: it currently reflects the post-2016 33-district structure, but boundary line "
                    "precision reflects community mapping, not an official cadastral survey, and has not "
                    "been independently validated against a government source in this sprint."
                ),
            },
            {
                "dataset_name": "Telangana mandal (sub-district) administrative boundaries",
                "publisher": "OpenStreetMap contributors",
                "source_url": "https://overpass-api.de/api/interpreter (Overpass query: boundary=administrative, admin_level=6, within OSM relation 3250963 'Telangana'); geometries via https://nominatim.openstreetmap.org/lookup",
                "access_date": now,
                "license": "Open Database License (ODbL) v1.0 -- https://opendatacommons.org/licenses/odbl/1-0/ -- requires attribution 'Data (c) OpenStreetMap contributors'",
                "geographic_level": "mandal (admin_level=6)",
                "crs": f"source {OUTPUT_CRS}; area computed via reprojection to {METRIC_CRS} (UTM 44N)",
                "processing": "Same Overpass/Nominatim pipeline as districts, at admin_level=6; mandal-to-district assignment computed deterministically via centroid-in-polygon spatial join against the processed district layer (no fabricated linkage).",
                "truth_status": "OBSERVED",
                "feature_count": int(len(mandals)),
                "limitations": (
                    f"{len(mandals)} mandal boundaries were resolved in OpenStreetMap at the time of "
                    "access. This is not confirmed to be the complete current set of officially gazetted "
                    "Telangana mandals (the official count has changed via multiple reorganizations since "
                    "2016 and was not independently re-verified against a government source in this "
                    "sprint) -- treat mandal-level coverage as partial/best-effort, not authoritative."
                ),
            },
            {
                "dataset_name": "Telangana state boundary",
                "publisher": "Derived from the district dataset above",
                "source_url": "n/a -- computed",
                "access_date": now,
                "license": "Inherits ODbL from source district geometries",
                "geographic_level": "state",
                "crs": OUTPUT_CRS,
                "processing": "Geometric union (dissolve) of the 33 processed district polygons.",
                "truth_status": "DERIVED",
                "feature_count": 1,
                "limitations": "Only as accurate as the underlying district geometries above.",
            },
        ],
        "evaluated_but_rejected_sources": [
            {
                "dataset_name": "TGRAC district boundary ArcGIS REST service",
                "source_url": "https://tgrac.telangana.gov.in/arcgis/rest/services/DistrictFormation_Folder/DistrictFormation_Queries/MapServer/1",
                "reason_rejected": "Named as the P0 source in docs/MASTER_HANDOFF.md but unreachable (connection timeout) from this build environment.",
            },
            {
                "dataset_name": "GADM v4.1 India ADM2 (district) boundaries",
                "source_url": "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IND_2.json.zip",
                "reason_rejected": "Reachable and valid, but encodes only the pre-2016 10-district structure for Telangana, not the current 33 districts.",
            },
        ],
    }
    with open(PROCESSED_DIR / "provenance.json", "w", encoding="utf-8") as f:
        json.dump(provenance, f, indent=2, ensure_ascii=False)


def main() -> None:
    districts = build_districts()
    mandals = build_mandals(districts)
    state = build_state(districts)

    districts.to_file(PROCESSED_DIR / "telangana_districts.geojson", driver="GeoJSON")
    mandals.to_file(PROCESSED_DIR / "telangana_mandals.geojson", driver="GeoJSON")
    state.to_file(PROCESSED_DIR / "telangana_state.geojson", driver="GeoJSON")
    write_provenance(districts, mandals)

    print(f"districts: {len(districts)}, mandals: {len(mandals)}, state area_sq_km: {state['area_sq_km'].iloc[0]}")
    print(f"mandals with resolved district_id: {mandals['district_id'].notna().sum()} / {len(mandals)}")


if __name__ == "__main__":
    main()
