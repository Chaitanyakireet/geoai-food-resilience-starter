"""Validation diagnostics for the baseline risk model.

Honest framing: this is a deterministic formula over climate anomalies, not
a model fitted to labeled outcomes. Classic ML validation (temporal/spatial
holdout accuracy, cross-validation) requires a labeled target -- none exists
here (no historical food-system-disruption dataset was available this
sprint). What IS meaningful and implemented instead:

  - Spatial smoothness check: climate stress should vary smoothly across
    neighboring districts (~50km NASA POWER grid); large discontinuities
    between bordering districts would indicate a bug, not real signal.
  - Temporal spot-check: recompute a small sample of districts against a
    prior 30-day window to confirm the score actually moves with the
    underlying data rather than being frozen/constant.
  - Leakage check: confirm by construction that the recent window never
    extends past (today - latency buffer) and that the climatology baseline
    (2001-2020) predates any window used -- the deterministic-formula analog
    of a train/test leakage check.

Do not read either diagnostic as an accuracy metric. There is no accuracy
metric here because there is no ground truth to measure accuracy against.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.geoai.spatial_layer import get_registry
from backend.risk.baseline_model import compute_risk_for_district
from backend.risk.contracts import RiskInput
from backend.risk.features import get_district_feature_row, load_climate_feature_table
from backend.risk.power_client import compute_recent_stats, fetch_climatology, fetch_daily, month_weighted_climatology_mean


def spatial_smoothness_check() -> dict:
    registry = get_registry()
    districts_gdf = registry.districts.gdf
    table = load_climate_feature_table()

    risk_scores = {}
    for district_id in table:
        row = get_district_feature_row(district_id)
        result = compute_risk_for_district(RiskInput(geo_id=district_id), row)
        if result.risk_score is not None:
            risk_scores[district_id] = result.risk_score

    adjacency: dict[str, list[str]] = {}
    for _, row in districts_gdf.iterrows():
        neighbors = districts_gdf[districts_gdf.geometry.touches(row.geometry)]["district_id"].tolist()
        adjacency[row["district_id"]] = neighbors

    diffs = []
    per_district = {}
    for district_id, score in risk_scores.items():
        neighbor_scores = [risk_scores[n] for n in adjacency.get(district_id, []) if n in risk_scores]
        if not neighbor_scores:
            continue
        neighbor_mean = sum(neighbor_scores) / len(neighbor_scores)
        diff = abs(score - neighbor_mean)
        diffs.append(diff)
        per_district[district_id] = {
            "risk_score": score,
            "neighbor_mean_risk_score": round(neighbor_mean, 4),
            "abs_diff_from_neighbor_mean": round(diff, 4),
            "neighbor_count": len(neighbor_scores),
        }

    return {
        "method": (
            "For each district, compare its risk_score to the mean risk_score of its directly "
            "bordering districts (shared-boundary adjacency from the processed district polygon "
            "layer). This is a sanity/smoothness diagnostic, not an accuracy metric -- there is no "
            "ground-truth label to measure accuracy against."
        ),
        "district_count_scored": len(risk_scores),
        "mean_abs_neighbor_diff": round(sum(diffs) / len(diffs), 4) if diffs else None,
        "max_abs_neighbor_diff": round(max(diffs), 4) if diffs else None,
        "per_district": per_district,
    }


def temporal_spot_check(sample_district_ids: list[str], window_days: int = 30) -> dict:
    registry = get_registry()
    results = []

    end_date = datetime.now(timezone.utc).date() - timedelta(days=3 + window_days)
    start_date = end_date - timedelta(days=window_days - 1)
    start_str = start_date.strftime("%Y%m%d")
    end_str = end_date.strftime("%Y%m%d")

    for district_id in sample_district_ids:
        current_row = get_district_feature_row(district_id)
        if current_row is None:
            continue
        current_result = compute_risk_for_district(RiskInput(geo_id=district_id), current_row)

        district_props = registry.districts.get(district_id)
        lon, lat = district_props["centroid_lon"], district_props["centroid_lat"]

        try:
            climatology = fetch_climatology(lon, lat)
            daily = fetch_daily(lon, lat, start_str, end_str)
        except Exception as exc:  # noqa: BLE001 -- best-effort diagnostic, not core path
            results.append({"district_id": district_id, "error": str(exc)})
            continue

        recent = compute_recent_stats(daily, requested_days=window_days)
        expected = {
            p: month_weighted_climatology_mean(climatology, p, recent["month_day_counts"])
            for p in ("T2M", "T2M_MAX", "PRECTOTCORR")
        }
        prior_row = {
            "geo_id": district_id,
            "geo_level": "district",
            "date": end_str,
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
        }
        prior_result = compute_risk_for_district(RiskInput(geo_id=district_id), prior_row)

        results.append(
            {
                "district_id": district_id,
                "current_window": {"date": current_row["date"], "risk_score": current_result.risk_score},
                "prior_window": {"date": end_str, "risk_score": prior_result.risk_score},
                "moved": current_result.risk_score != prior_result.risk_score,
            }
        )

    return {
        "method": (
            "Recompute a small sample of districts against an earlier, non-overlapping 30-day window "
            "(ending before the current window starts) to confirm risk_score actually responds to "
            "different underlying data rather than being constant. Not an accuracy check -- there is "
            "no labeled outcome for either window to validate against."
        ),
        "sample_district_ids": sample_district_ids,
        "results": results,
    }


def leakage_check() -> dict:
    table = load_climate_feature_table()
    now = datetime.now(timezone.utc).date()
    violations = []
    for district_id, row in table.items():
        window_end = datetime.strptime(row["date"], "%Y%m%d").date()
        if window_end > now:
            violations.append(district_id)
    return {
        "method": (
            "This is a deterministic formula, not a model trained on historical examples, so classic "
            "train/test leakage does not apply in the usual sense. The analogous safeguard checked here: "
            "the recent-window end date must never be in the future relative to build time, and the "
            "climatology baseline (a fixed 2001-2020 normal) is structurally independent of the recent "
            "window's specific dates."
        ),
        "districts_checked": len(table),
        "future_dated_windows": violations,
        "passed": len(violations) == 0,
    }
