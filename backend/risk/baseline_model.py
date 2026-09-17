"""Transparent, deterministic baseline risk model.

Why a formula and not a fitted ML model: a supervised model needs a labeled
target (an actual historical record of food-availability disruption events
per district/date). No such dataset was available in this sprint, and
training or reporting accuracy metrics without one would be fabricated
performance (explicitly forbidden by docs/MASTER_HANDOFF.md section 14/22).
Instead this implements a documented, inspectable composite index over
climate-anomaly signals, with every weight/threshold declared in
config/features.yaml rather than hidden in code.

Proxy definition (must not be read as a direct food-insecurity measurement):
  "Climate-driven food-system stress proxy" = a weighted composite of
  rainfall deficit and above-normal temperature, each expressed as a
  fractional deviation from the NASA POWER 2001-2020 climatological normal
  for the same calendar window, clipped and linearly scaled to [0, 1].

A third candidate signal, T2M_MAX anomaly, is computed and reported but
EXCLUDED from the score: NASA POWER's climatology T2M_MAX and our observed
daily-mean-of-T2M_MAX are not confirmed to be the same statistic (the
climatology value looks like a monthly extreme, not a mean-of-daily-max --
see the large, likely-spurious gap in data/processed/climate_features.json).
Using it without resolving that would inject an unverified signal into the
score.
"""
from __future__ import annotations

import uuid

from backend.risk.contracts import DataCoverage, Driver, RiskInput, RiskResult
from backend.risk.features import get_district_feature_row, load_features_config

STRUCTURAL_UNCERTAINTY_FLOOR = 0.05  # acknowledged formula/threshold-assumption uncertainty, even at full data coverage
MAX_COVERAGE_UNCERTAINTY = 0.45


def _clip(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _risk_class(score: float, bins: dict) -> str:
    if score <= bins["low"]:
        return "low"
    if score <= bins["moderate"]:
        return "moderate"
    if score <= bins["high"]:
        return "high"
    return "severe"


def compute_risk_for_district(inp: RiskInput, feature_row: dict, geo_level: str = "district", resolved_via: str = "district_centroid_direct") -> RiskResult:
    config = load_features_config()
    if inp.food_category not in config["food_categories"]:
        raise ValueError(f"Unknown food_category '{inp.food_category}'. Configured: {config['food_categories']}")

    model_cfg = config["risk_model"]
    weights = model_cfg["weights"]
    thresholds = model_cfg["thresholds"]
    bins = model_cfg["risk_class_bins"]
    min_coverage = model_cfg["min_coverage_ratio"]

    coverage = feature_row["data_coverage"]
    coverage_ratio = coverage["coverage_ratio"]
    run_id = str(uuid.uuid4())

    observed = feature_row["observed"]
    baseline = feature_row["climatology_baseline"]

    limitations = [
        "This is a transparent deterministic baseline, not a fitted/validated ML model: no historical "
        "labeled food-system-disruption outcome data was available this sprint to serve as a supervised "
        "training/validation target.",
        "risk_score is a climate-stress proxy for potential food-availability disruption, not a direct "
        "measurement of food insecurity or of an actual observed supply disruption.",
        "Weights and stress thresholds (config/features.yaml) are assumed/documented calibration choices, "
        "not empirically fit to outcome data.",
        "Feature values are computed at the district centroid on NASA POWER's ~50km native grid, not "
        "area-averaged over the district polygon.",
        "The same climate-stress proxy is currently applied to every food_category; category-specific "
        "sensitivity (perishability, crop calendars, cold-chain dependence) is not yet implemented.",
    ]
    if geo_level != "district":
        limitations.append(
            f"Requested geo_level is '{geo_level}'; this result is inherited from its containing district "
            f"({resolved_via}) because climate features were computed only at district centroids this sprint."
        )

    drivers: list[Driver] = []

    def _pct_deviation(observed_v, baseline_v):
        """(observed - baseline) / baseline. Positive = above the climatological normal."""
        if baseline_v in (None, 0):
            return None
        return (observed_v - baseline_v) / baseline_v

    # Positive rainfall_deficit_pct means below-normal rainfall (deficit = stress),
    # so this is the negation of the raw (observed - baseline) deviation.
    _precip_deviation = _pct_deviation(observed["precip_mean_mm_day"], baseline["precip_mean_mm_day"])
    rainfall_deficit_pct = -_precip_deviation if _precip_deviation is not None else None
    heat_stress_pct = _pct_deviation(observed["t2m_mean_c"], baseline["t2m_mean_c"])
    # informational only, not used in score -- see module docstring
    t2m_max_pct = _pct_deviation(observed["t2m_max_mean_c"], baseline["t2m_max_mean_c"])

    if coverage_ratio < min_coverage:
        drivers.append(
            Driver(
                feature="data_coverage",
                observed_value=coverage["available_days"],
                baseline_value=coverage["requested_days"],
                unit="days",
                anomaly_pct=None,
                contribution_to_score=None,
                used_in_score=False,
                truth_status="OBSERVED",
                note=f"Only {coverage['available_days']}/{coverage['requested_days']} days available; below the configured minimum coverage ratio ({min_coverage}) to compute a score.",
            )
        )
        return RiskResult(
            region_id=inp.geo_id,
            geo_level=geo_level,
            food_scope=inp.food_category,
            date=feature_row["date"],
            risk_score=None,
            risk_class="insufficient_data",
            confidence="low",
            uncertainty_interval=None,
            major_drivers=drivers,
            data_coverage=DataCoverage(
                requested_days=coverage["requested_days"],
                available_days=coverage["available_days"],
                coverage_ratio=coverage_ratio,
                spatial_resolution="district_centroid",
            ),
            model_version=model_cfg["model_version"],
            run_id=run_id,
            truth_status="ESTIMATED",
            resolved_via=resolved_via,
            provenance_refs=["NASA POWER daily meteorology (recent window)", "NASA POWER 20-year climatology (2001-2020 monthly normals)"],
            limitations=limitations,
        )

    rainfall_component = _clip((rainfall_deficit_pct or 0.0) / thresholds["rainfall_deficit_full_stress_pct"])
    heat_component = _clip((heat_stress_pct or 0.0) / thresholds["heat_stress_full_stress_pct"])
    risk_score = weights["rainfall_deficit"] * rainfall_component + weights["heat_stress"] * heat_component
    risk_score = round(_clip(risk_score), 4)

    drivers.append(
        Driver(
            feature="rainfall_deficit",
            observed_value=round(observed["precip_mean_mm_day"], 3),
            baseline_value=round(baseline["precip_mean_mm_day"], 3),
            unit="mm/day",
            anomaly_pct=round(rainfall_deficit_pct * 100, 2) if rainfall_deficit_pct is not None else None,
            contribution_to_score=round(weights["rainfall_deficit"] * rainfall_component, 4),
            used_in_score=True,
            truth_status="DERIVED",
        )
    )
    drivers.append(
        Driver(
            feature="heat_stress",
            observed_value=round(observed["t2m_mean_c"], 3),
            baseline_value=round(baseline["t2m_mean_c"], 3),
            unit="deg_C (mean daily temperature)",
            anomaly_pct=round(heat_stress_pct * 100, 2) if heat_stress_pct is not None else None,
            contribution_to_score=round(weights["heat_stress"] * heat_component, 4),
            used_in_score=True,
            truth_status="DERIVED",
        )
    )
    drivers.append(
        Driver(
            feature="heat_stress_t2m_max_context",
            observed_value=round(observed["t2m_max_mean_c"], 3),
            baseline_value=round(baseline["t2m_max_mean_c"], 3),
            unit="deg_C",
            anomaly_pct=round(t2m_max_pct * 100, 2) if t2m_max_pct is not None else None,
            contribution_to_score=None,
            used_in_score=False,
            truth_status="OBSERVED",
            note=(
                "Excluded from risk_score: NASA POWER's climatology T2M_MAX and the observed "
                "daily-mean T2M_MAX are not confirmed to be the same underlying statistic (the "
                "climatology value behaves like a monthly extreme, not a mean of daily maxima), "
                "producing a large gap not attributable to a real anomaly. Reported for context only."
            ),
        )
    )

    coverage_uncertainty = (1 - coverage_ratio) * MAX_COVERAGE_UNCERTAINTY
    margin = round(STRUCTURAL_UNCERTAINTY_FLOOR + coverage_uncertainty, 4)
    uncertainty_interval = [round(_clip(risk_score - margin), 4), round(_clip(risk_score + margin), 4)]

    if coverage_ratio >= 0.9:
        confidence = "high"
    elif coverage_ratio >= min_coverage:
        confidence = "medium"
    else:
        confidence = "low"

    return RiskResult(
        region_id=inp.geo_id,
        geo_level=geo_level,
        food_scope=inp.food_category,
        date=feature_row["date"],
        risk_score=risk_score,
        risk_class=_risk_class(risk_score, bins),
        confidence=confidence,
        uncertainty_interval=uncertainty_interval,
        major_drivers=drivers,
        data_coverage=DataCoverage(
            requested_days=coverage["requested_days"],
            available_days=coverage["available_days"],
            coverage_ratio=coverage_ratio,
            spatial_resolution="district_centroid",
        ),
        model_version=model_cfg["model_version"],
        run_id=run_id,
        truth_status="ESTIMATED",
        resolved_via=resolved_via,
        provenance_refs=["NASA POWER daily meteorology (recent window)", "NASA POWER 20-year climatology (2001-2020 monthly normals)"],
        limitations=limitations,
    )


def get_risk(inp: RiskInput) -> RiskResult:
    from backend.geoai.spatial_layer import get_registry

    registry = get_registry()

    if registry.districts.get(inp.geo_id) is not None:
        feature_row = get_district_feature_row(inp.geo_id)
        if feature_row is None:
            raise LookupError(f"No climate feature row for district '{inp.geo_id}' -- run scripts/build_climate_features.py")
        return compute_risk_for_district(inp, feature_row, geo_level="district", resolved_via="district_centroid_direct")

    mandal = registry.mandals.get(inp.geo_id)
    if mandal is not None:
        parent_district_id = mandal["district_id"]
        feature_row = get_district_feature_row(parent_district_id)
        if feature_row is None:
            raise LookupError(f"No climate feature row for district '{parent_district_id}' -- run scripts/build_climate_features.py")
        result = compute_risk_for_district(
            inp,
            feature_row,
            geo_level="mandal",
            resolved_via=f"inherited_from_parent_district:{parent_district_id}",
        )
        result.region_id = inp.geo_id
        return result

    raise KeyError(f"geo_id '{inp.geo_id}' is not a known district_id or mandal_id")
