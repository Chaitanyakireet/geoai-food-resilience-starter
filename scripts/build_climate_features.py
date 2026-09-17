"""Fetch NASA POWER climate observations for every Telangana district centroid
and derive DERIVED anomaly features. Deterministic, reproducible, no LLM.

Pipeline:
  data/processed/telangana_districts.geojson (33 district centroids)
      -> NASA POWER climatology API (2001-2020 monthly normals)  [OBSERVED]
      -> NASA POWER daily API (recent window)                     [OBSERVED]
      -> data/raw/nasa_power/<district_id>_{climatology,daily}.json
      -> data/processed/climate_features.json                     [DERIVED anomalies]
      -> data/processed/climate_provenance.json

Re-run with: .venv\\Scripts\\python scripts\\build_climate_features.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import geopandas as gpd
import requests
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.risk.power_client import (  # noqa: E402
    compute_recent_stats,
    fetch_climatology,
    fetch_daily,
    month_weighted_climatology_mean,
)

RAW_DIR = REPO_ROOT / "data" / "raw" / "nasa_power"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
RAW_DIR.mkdir(parents=True, exist_ok=True)

REQUEST_DELAY_SECONDS = 0.5


def load_features_config() -> dict:
    with open(REPO_ROOT / "config" / "features.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main() -> None:
    config = load_features_config()
    window_days = config["climate_source"]["recent_window_days"]

    end_date = datetime.now(timezone.utc).date() - timedelta(days=3)  # POWER near-real-time latency
    start_date = end_date - timedelta(days=window_days - 1)
    start_str = start_date.strftime("%Y%m%d")
    end_str = end_date.strftime("%Y%m%d")

    districts = gpd.read_file(PROCESSED_DIR / "telangana_districts.geojson")

    features = []
    fetch_failures = []
    fetched_at = datetime.now(timezone.utc).isoformat()

    for _, row in districts.iterrows():
        district_id = row["district_id"]
        lon, lat = float(row["centroid_lon"]), float(row["centroid_lat"])
        print(f"Fetching NASA POWER data for {district_id} ({lon}, {lat})...")

        try:
            climatology = fetch_climatology(lon, lat)
            time.sleep(REQUEST_DELAY_SECONDS)
            daily = fetch_daily(lon, lat, start_str, end_str)
            time.sleep(REQUEST_DELAY_SECONDS)
        except requests.RequestException as exc:
            print(f"  FAILED: {exc}")
            fetch_failures.append({"district_id": district_id, "error": str(exc)})
            continue

        (RAW_DIR / f"{district_id}_climatology.json").write_text(json.dumps(climatology), encoding="utf-8")
        (RAW_DIR / f"{district_id}_daily.json").write_text(json.dumps(daily), encoding="utf-8")

        recent = compute_recent_stats(daily, requested_days=window_days)
        expected = {
            p: month_weighted_climatology_mean(climatology, p, recent["month_day_counts"])
            for p in ("T2M", "T2M_MAX", "PRECTOTCORR")
        }

        features.append(
            {
                "geo_id": district_id,
                "geo_level": "district",
                "date": end_str,
                "window_start": start_str,
                "window_end": end_str,
                "observed": {
                    "t2m_mean_c": recent["means"]["T2M"],
                    "t2m_max_mean_c": recent["means"]["T2M_MAX"],
                    "precip_mean_mm_day": recent["means"]["PRECTOTCORR"],
                    "truth_status": "OBSERVED",
                },
                "climatology_baseline": {
                    "t2m_mean_c": expected["T2M"],
                    "t2m_max_mean_c": expected["T2M_MAX"],
                    "precip_mean_mm_day": expected["PRECTOTCORR"],
                    "period": "2001-2020",
                    "truth_status": "OBSERVED",
                },
                "data_coverage": {
                    "requested_days": recent["requested_days"],
                    "available_days": recent["available_days"],
                    "coverage_ratio": recent["coverage_ratio"],
                },
                "fetched_at": fetched_at,
            }
        )

    (PROCESSED_DIR / "climate_features.json").write_text(
        json.dumps({"features": features, "built_at": fetched_at}, indent=2), encoding="utf-8"
    )

    provenance = {
        "generated_at": fetched_at,
        "datasets": [
            {
                "dataset_name": "NASA POWER daily meteorology (recent window)",
                "publisher": "NASA Langley Research Center POWER Project",
                "source_url": "https://power.larc.nasa.gov/api/temporal/daily/point",
                "access_date": fetched_at,
                "license": "NASA POWER data are public domain; cite NASA POWER per https://power.larc.nasa.gov/docs/methodology/",
                "geographic_level": "point (district centroid), NASA POWER native grid ~0.5 deg (~50km)",
                "crs": "EPSG:4326 (query points from the processed district centroid layer)",
                "processing": (
                    f"Queried T2M, T2M_MAX, PRECTOTCORR for each of 33 district centroids for the "
                    f"{window_days}-day window {start_str}-{end_str}; averaged over non-fill-value days only."
                ),
                "truth_status": "OBSERVED",
                "limitations": (
                    "Point estimate at the district centroid, not an area-weighted average over the "
                    "district polygon. Grid resolution (~50km) is coarser than many districts and coarser "
                    "still than mandals -- mandal-level values are not independently computed and inherit "
                    "their parent district's value (see backend/risk API). Recent-window latency means the "
                    "window ends a few days before 'today', not literally real-time."
                ),
            },
            {
                "dataset_name": "NASA POWER 20-year climatology (2001-2020 monthly normals)",
                "publisher": "NASA Langley Research Center POWER Project",
                "source_url": "https://power.larc.nasa.gov/api/temporal/climatology/point",
                "access_date": fetched_at,
                "license": "NASA POWER data are public domain; cite NASA POWER per https://power.larc.nasa.gov/docs/methodology/",
                "geographic_level": "point (district centroid)",
                "crs": "EPSG:4326",
                "processing": "Used as the historical baseline for anomaly calculation; blended across months proportionally to the number of recent-window days falling in each calendar month.",
                "truth_status": "OBSERVED",
                "limitations": "20-year normal (2001-2020) does not capture more recent climate trends or exceptional multi-year droughts/wet periods outside that window.",
            },
        ],
        "fetch_failures": fetch_failures,
    }
    (PROCESSED_DIR / "climate_provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")

    print(f"\nFeatures written for {len(features)}/{len(districts)} districts. Failures: {len(fetch_failures)}")


if __name__ == "__main__":
    main()
