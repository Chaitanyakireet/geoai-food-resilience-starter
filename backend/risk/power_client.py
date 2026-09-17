"""Shared NASA POWER API client + deterministic aggregation helpers.
Used by scripts/build_climate_features.py (the main build pipeline) and
backend/risk/validation.py (temporal spot-check, which needs an extra
fetch for a shifted window)."""
from __future__ import annotations

import requests

POWER_CLIMATOLOGY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
POWER_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = "T2M,T2M_MAX,PRECTOTCORR"
COMMUNITY = "AG"
FILL_VALUE = -999.0
REQUEST_TIMEOUT = 30

MONTH_CODES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def fetch_climatology(lon: float, lat: float) -> dict:
    params = {
        "parameters": PARAMETERS,
        "community": COMMUNITY,
        "longitude": lon,
        "latitude": lat,
        "format": "JSON",
    }
    resp = requests.get(POWER_CLIMATOLOGY_URL, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def fetch_daily(lon: float, lat: float, start: str, end: str) -> dict:
    params = {
        "parameters": PARAMETERS,
        "community": COMMUNITY,
        "longitude": lon,
        "latitude": lat,
        "start": start,
        "end": end,
        "format": "JSON",
    }
    resp = requests.get(POWER_DAILY_URL, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def compute_recent_stats(daily_json: dict, requested_days: int) -> dict:
    params = daily_json["properties"]["parameter"]
    days_by_param = {p: params[p] for p in ("T2M", "T2M_MAX", "PRECTOTCORR")}

    all_dates = sorted(days_by_param["T2M"].keys())
    available_dates = [d for d in all_dates if all(days_by_param[p][d] != FILL_VALUE for p in days_by_param)]

    means = {}
    for p in days_by_param:
        values = [days_by_param[p][d] for d in available_dates]
        means[p] = sum(values) / len(values) if values else None

    months_present = sorted({d[4:6] for d in available_dates})
    month_day_counts = {m: sum(1 for d in available_dates if d[4:6] == m) for m in months_present}

    return {
        "requested_days": requested_days,
        "available_days": len(available_dates),
        "coverage_ratio": round(len(available_dates) / requested_days, 3) if requested_days else 0.0,
        "means": means,
        "month_day_counts": month_day_counts,
    }


def month_weighted_climatology_mean(climatology_json: dict, parameter: str, month_day_counts: dict) -> float | None:
    monthly = climatology_json["properties"]["parameter"][parameter]
    total_days = sum(month_day_counts.values())
    if total_days == 0:
        return None
    weighted = sum(monthly[MONTH_CODES[int(m) - 1]] * count for m, count in month_day_counts.items())
    return weighted / total_days
