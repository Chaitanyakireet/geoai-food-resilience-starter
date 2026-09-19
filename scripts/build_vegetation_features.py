"""Fetch real MODIS vegetation-index (NDVI) observations for every Telangana
district centroid via NASA's AppEEARS point-extraction API, and derive a
DERIVED seasonal-baseline anomaly. Deterministic, reproducible, no LLM.

Unlike backend/risk/power_client.py (NASA POWER, genuinely keyless), the
AppEEARS API requires a free NASA Earthdata Login account -- this script
reads EARTHDATA_USERNAME / EARTHDATA_PASSWORD from the environment (or a
repo-root .env file, loaded manually below since this project has no
python-dotenv dependency).

Pipeline:
  data/processed/telangana_districts.geojson (33 district centroids)
      -> AppEEARS /login (Earthdata credentials -> session token)
      -> AppEEARS /task (point extraction, MOD13Q1.061 NDVI, ~6yr history)
      -> poll /status until done
      -> download the point-sample CSV via /bundle
      -> per district: most recent quality-passing composite = "observed";
         mean of prior composites within +/-24 days of that day-of-year
         (a seasonal window, not a NASA-POWER-style 20yr climatology) =
         "baseline"
      -> data/processed/vegetation_features.json                 [DERIVED anomaly]
      -> data/processed/vegetation_provenance.json

Re-run with: .venv\\Scripts\\python scripts\\build_vegetation_features.py
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

PROCESSED_DIR = REPO_ROOT / "data" / "processed"
DISTRICTS_PATH = PROCESSED_DIR / "telangana_districts.geojson"

APPEEARS_BASE = "https://appeears.earthdatacloud.nasa.gov/api"
USER_AGENT = "geoai-food-resilience-starter/1.0 (+https://github.com)"
PRODUCT = "MOD13Q1.061"
NDVI_LAYER = "_250m_16_days_NDVI"
QUALITY_LAYER = "_250m_16_days_pixel_reliability"
# AppEEARS' point-extraction CSV already applies the product's 0.0001 scale
# factor server-side (confirmed by inspecting real output: values arrive
# as e.g. 0.3088, the correct -1..1 NDVI range, not the raw 3088 integer
# from the underlying HDF layer) -- do NOT multiply by scale again here.
GOOD_RELIABILITY_VALUES = {0, 1}  # 0=Good, 1=Marginal; excludes 2=Snow/Ice, 3=Cloudy, -1=Fill
HISTORY_YEARS = 6
SEASONAL_WINDOW_DAYS = 24  # ~1.5 sixteen-day composite cycles either side
MIN_BASELINE_COMPOSITES = 3
POLL_INTERVAL_SECONDS = 15
POLL_TIMEOUT_SECONDS = 3600


def _load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _login(session: requests.Session, username: str, password: str) -> str:
    resp = session.post(f"{APPEEARS_BASE}/login", auth=(username, password), headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.json()["token"]


def _load_district_centroids() -> list[dict]:
    import geopandas as gpd

    gdf = gpd.read_file(DISTRICTS_PATH)
    return [
        {"district_id": row["district_id"], "lon": float(row["centroid_lon"]), "lat": float(row["centroid_lat"])}
        for _, row in gdf.iterrows()
    ]


def _submit_task(session: requests.Session, token: str, districts: list[dict], start: date, end: date) -> str:
    payload = {
        "task_type": "point",
        "task_name": f"telangana_ndvi_{end.isoformat()}",
        "params": {
            "dates": [{"startDate": start.strftime("%m-%d-%Y"), "endDate": end.strftime("%m-%d-%Y")}],
            "layers": [
                {"product": PRODUCT, "layer": NDVI_LAYER},
                {"product": PRODUCT, "layer": QUALITY_LAYER},
            ],
            "coordinates": [
                {"latitude": d["lat"], "longitude": d["lon"], "id": d["district_id"], "category": "district"}
                for d in districts
            ],
        },
    }
    resp = session.post(
        f"{APPEEARS_BASE}/task",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT},
    )
    resp.raise_for_status()
    return resp.json()["task_id"]


def _wait_for_task(session: requests.Session, token: str, task_id: str) -> None:
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
    while time.monotonic() < deadline:
        resp = session.get(f"{APPEEARS_BASE}/status/{task_id}", headers=headers)
        resp.raise_for_status()
        body = resp.json()
        if body.get("status") == "done":
            return
        if body.get("status") == "error":
            raise RuntimeError(f"AppEEARS task {task_id} failed: {body}")
        print(f"  ... task {task_id} status={body.get('status', body.get('progress', {}).get('summary'))}")
        time.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError(f"AppEEARS task {task_id} did not finish within {POLL_TIMEOUT_SECONDS}s")


def _download_csv(session: requests.Session, token: str, task_id: str) -> str:
    headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
    bundle = session.get(f"{APPEEARS_BASE}/bundle/{task_id}", headers=headers)
    bundle.raise_for_status()
    files = bundle.json()["files"]
    csv_file = next(f for f in files if f["file_name"].endswith("-results.csv"))
    resp = session.get(f"{APPEEARS_BASE}/bundle/{task_id}/{csv_file['file_id']}", headers=headers, allow_redirects=True)
    resp.raise_for_status()
    return resp.text


def _derive_features(csv_text: str, fetched_at: str, all_district_ids: list[str]) -> tuple[list[dict], list[dict]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    total_by_district: dict[str, int] = {}
    good_by_district: dict[str, list[dict]] = {}
    for row in reader:
        district_id = row["ID"]
        total_by_district[district_id] = total_by_district.get(district_id, 0) + 1
        try:
            reliability = int(float(row[f"{PRODUCT.replace('.', '_')}_{QUALITY_LAYER}"]))
            ndvi = float(row[f"{PRODUCT.replace('.', '_')}_{NDVI_LAYER}"])
        except (KeyError, ValueError):
            continue
        if reliability not in GOOD_RELIABILITY_VALUES:
            continue
        obs_date = datetime.strptime(row["Date"], "%Y-%m-%d").date()
        good_by_district.setdefault(district_id, []).append({"date": obs_date, "ndvi": ndvi, "reliability": reliability})

    features: list[dict] = []
    skipped: list[dict] = []
    for district_id in all_district_ids:
        total_fetched = total_by_district.get(district_id, 0)
        rows = sorted(good_by_district.get(district_id, []), key=lambda r: r["date"])
        if not rows:
            skipped.append({"district_id": district_id, "reason": f"no quality-passing composites in window ({total_fetched} composites fetched, all filtered out)"})
            continue
        latest = rows[-1]
        history = rows[:-1]

        def _doy_distance(d: date, ref: date) -> int:
            # Circular day-of-year distance so a window spanning New Year's still works.
            a, b = d.timetuple().tm_yday, ref.timetuple().tm_yday
            diff = abs(a - b)
            return min(diff, 365 - diff)

        seasonal = [r for r in history if _doy_distance(r["date"], latest["date"]) <= SEASONAL_WINDOW_DAYS]
        baseline_pool = seasonal if len(seasonal) >= MIN_BASELINE_COMPOSITES else history
        baseline_method = (
            f"seasonal window (+/-{SEASONAL_WINDOW_DAYS} days of day-of-year), {len(seasonal)} composites"
            if seasonal is baseline_pool
            else f"fallback: all {len(history)} available prior composites (fewer than {MIN_BASELINE_COMPOSITES} fell in the seasonal window)"
        )

        if not baseline_pool:
            skipped.append({"district_id": district_id, "reason": "only one quality-passing composite available; no baseline possible"})
            continue

        baseline_ndvi = sum(r["ndvi"] for r in baseline_pool) / len(baseline_pool)

        features.append(
            {
                "geo_id": district_id,
                "geo_level": "district",
                "date": latest["date"].isoformat(),
                "observed": {"ndvi": round(latest["ndvi"], 4), "pixel_reliability": latest["reliability"], "truth_status": "OBSERVED"},
                "baseline": {
                    "ndvi": round(baseline_ndvi, 4),
                    "composite_count": len(baseline_pool),
                    "method": baseline_method,
                    "truth_status": "DERIVED",
                },
                "data_coverage": {"quality_passing_composites": len(rows), "total_composites_fetched": total_fetched},
                "fetched_at": fetched_at,
            }
        )
    return features, skipped


def main() -> None:
    _load_dotenv()
    username = os.environ.get("EARTHDATA_USERNAME")
    password = os.environ.get("EARTHDATA_PASSWORD")
    if not username or not password:
        print("EARTHDATA_USERNAME / EARTHDATA_PASSWORD not set (checked environment and repo-root .env). Aborting.")
        sys.exit(1)

    fetched_at = datetime.now(timezone.utc).isoformat()
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=365 * HISTORY_YEARS)

    session = requests.Session()
    print("Logging in to AppEEARS...")
    token = _login(session, username, password)

    print("Loading district centroids...")
    districts = _load_district_centroids()
    print(f"  {len(districts)} districts")

    # A task already submitted keeps processing on AppEEARS's side
    # regardless of whether this script is still running -- if a previous
    # run timed out waiting (point tasks over several years of history can
    # take well over 30 minutes), resume polling the same task_id instead
    # of resubmitting and burning another full processing cycle. Note:
    # start_date/end_date are recomputed as "now" either way, so on a
    # resume they describe the intended window, not necessarily the exact
    # historical moment the original task was submitted (negligible for
    # provenance text describing a ~6-year lookback).
    resume_task_id = sys.argv[1] if len(sys.argv) > 1 else None
    if resume_task_id:
        task_id = resume_task_id
        print(f"Resuming existing task_id={task_id} (not resubmitting)...")
    else:
        print(f"Submitting point task ({start_date} to {end_date}, {PRODUCT} {NDVI_LAYER})...")
        task_id = _submit_task(session, token, districts, start_date, end_date)
        print(f"  task_id={task_id}")

    print("Waiting for AppEEARS to process the task...")
    _wait_for_task(session, token, task_id)

    print("Downloading results...")
    csv_text = _download_csv(session, token, task_id)

    print("Deriving features...")
    features, skipped = _derive_features(csv_text, fetched_at, [d["district_id"] for d in districts])

    (PROCESSED_DIR / "vegetation_features.json").write_text(
        json.dumps({"features": features, "built_at": fetched_at, "skipped": skipped}, indent=2), encoding="utf-8"
    )

    provenance = {
        "generated_at": fetched_at,
        "datasets": [
            {
                "dataset_name": "MODIS Terra Vegetation Indices (MOD13Q1.061), NDVI",
                "publisher": "NASA LP DAAC, via AppEEARS point extraction",
                "source_url": "https://appeears.earthdatacloud.nasa.gov/api/",
                "access_date": fetched_at,
                "license": "NASA data are public domain; free NASA Earthdata Login account required for API access.",
                "geographic_level": f"point (district centroid), MOD13Q1 native 250m sinusoidal grid, nearest-pixel resample",
                "crs": "EPSG:4326 (query points from the processed district centroid layer)",
                "processing": (
                    f"Queried {NDVI_LAYER} + {QUALITY_LAYER} for each of {len(districts)} district centroids over "
                    f"{start_date} to {end_date} (16-day composites). Kept only pixel_reliability in "
                    f"{sorted(GOOD_RELIABILITY_VALUES)} (Good/Marginal; excludes snow/ice and cloudy composites). "
                    f"'observed' = most recent quality-passing composite. 'baseline' = mean of prior quality-passing "
                    f"composites within +/-{SEASONAL_WINDOW_DAYS} days of the same day-of-year (falls back to the mean "
                    f"of all available prior composites if fewer than {MIN_BASELINE_COMPOSITES} fall in that window)."
                ),
                "truth_status": "OBSERVED",
                "limitations": (
                    "NOT currently used in risk_score -- reported as context only, the same way heat_stress_t2m_max_context "
                    "is handled, pending a deliberate methodology decision on how to weight vegetation condition. "
                    "250m native resolution is finer than the NASA POWER climate grid but still a single point per district, "
                    "not an area-weighted average over the district polygon. The 'baseline' here is a same-season historical "
                    f"mean over up to {HISTORY_YEARS} years of this project's own query, not an independently published, "
                    "peer-reviewed climatology like NASA POWER's 2001-2020 normals. Monsoon-season cloud cover can reduce "
                    "the number of quality-passing composites available in some districts/years. Districts with zero "
                    "quality-passing composites in the window are listed under 'skipped' in vegetation_features.json "
                    "rather than backfilled with an invented value."
                ),
            }
        ],
        "skipped_districts": skipped,
    }
    (PROCESSED_DIR / "vegetation_provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")

    print(f"\nFeatures written for {len(features)}/{len(districts)} districts. Skipped: {len(skipped)}.")
    if skipped:
        for s in skipped:
            print(f"  SKIPPED {s['district_id']}: {s['reason']}")


if __name__ == "__main__":
    main()
