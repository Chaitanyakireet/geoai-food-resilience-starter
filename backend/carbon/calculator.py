"""Deterministic food-system carbon calculator: activity x emissions factor.

No LLM involvement. Every number here is either:
  - a real geometric fact (great-circle distance between two real district/
    mandal centroids, via backend/geoai/spatial_layer.py), or
  - a cited, publicly published emissions factor (config/carbon_factors.yaml), or
  - an explicit, disclosed caller-supplied activity assumption (tonnage).

If a factor is not_modeled or a geography can't be resolved, the result is
returned with available=False and a stated reason -- never a fabricated
number silently standing in for one.
"""
from __future__ import annotations

from math import asin, cos, radians, sin, sqrt
from typing import Optional

from backend.carbon.contracts import CarbonCalculationResult, CarbonComparisonResult, WorldCarbon
from backend.carbon.registry import get_factor

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance between two lon/lat points, in kilometers."""
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(min(1.0, sqrt(a)))


def _resolve_centroid(geo_id: str) -> Optional[tuple[float, float]]:
    """Returns (lon, lat) for a district_id or mandal_id, or None if unknown.
    Import is local to avoid a hard dependency on geopandas for callers that
    only need the pure-arithmetic parts of this module (e.g. unit tests)."""
    from backend.geoai.spatial_layer import get_registry

    registry = get_registry()
    row = registry.districts.get(geo_id)
    if row is None:
        row = registry.mandals.get(geo_id)
    if row is None:
        return None
    return float(row["centroid_lon"]), float(row["centroid_lat"])


def calculate_transport_carbon(
    origin_geo_id: str,
    destination_geo_id: str,
    activity_tonnes: Optional[float] = None,
    factor_id: str = "road_freight_hgv_rigid_gt17t_avg_laden_uk_2021",
) -> CarbonCalculationResult:
    factor = get_factor(factor_id)
    if factor is None:
        raise KeyError(f"Unknown carbon factor_id '{factor_id}'. See config/carbon_factors.yaml.")

    limitations: list[str] = []
    if factor.uncertainty_limitations:
        limitations.append(factor.uncertainty_limitations)

    if factor.status != "available" or factor.factor_value is None:
        return CarbonCalculationResult(
            origin_geo_id=origin_geo_id,
            destination_geo_id=destination_geo_id,
            distance_km=None,
            distance_truth_status=None,
            factor=factor,
            activity_tonnes=activity_tonnes,
            carbon_intensity_kg_per_tonne=None,
            total_carbon_kg=None,
            truth_status="ESTIMATED",
            available=False,
            unavailable_reason=f"No available emissions factor for activity_category '{factor.activity_category}' (factor_id='{factor_id}' is not_modeled).",
            limitations=limitations,
        )

    origin = _resolve_centroid(origin_geo_id)
    destination = _resolve_centroid(destination_geo_id)
    if origin is None or destination is None:
        missing = origin_geo_id if origin is None else destination_geo_id
        return CarbonCalculationResult(
            origin_geo_id=origin_geo_id,
            destination_geo_id=destination_geo_id,
            distance_km=None,
            distance_truth_status=None,
            factor=factor,
            activity_tonnes=activity_tonnes,
            carbon_intensity_kg_per_tonne=None,
            total_carbon_kg=None,
            truth_status="ESTIMATED",
            available=False,
            unavailable_reason=f"'{missing}' is not a known district_id or mandal_id -- cannot resolve a centroid to compute distance.",
            limitations=limitations,
        )

    distance_km = round(haversine_km(origin[0], origin[1], destination[0], destination[1]), 3)
    limitations.append(
        "Distance is a straight-line (great-circle) distance between district/mandal centroids, not a real road-network "
        "routing distance -- actual road transport distance is typically longer."
    )

    intensity = round(distance_km * factor.factor_value, 4)

    total_carbon_kg: Optional[float] = None
    truth_status = "DERIVED"
    if activity_tonnes is not None:
        total_carbon_kg = round(intensity * activity_tonnes, 3)
        truth_status = "ESTIMATED"
        limitations.append(
            f"activity_tonnes ({activity_tonnes}) is a caller-supplied assumption, not a measured freight volume -- "
            "this platform does not track actual tonnage moved."
        )

    return CarbonCalculationResult(
        origin_geo_id=origin_geo_id,
        destination_geo_id=destination_geo_id,
        distance_km=distance_km,
        distance_truth_status="DERIVED",
        factor=factor,
        activity_tonnes=activity_tonnes,
        carbon_intensity_kg_per_tonne=intensity,
        total_carbon_kg=total_carbon_kg,
        truth_status=truth_status,
        available=True,
        unavailable_reason=None,
        limitations=limitations,
    )


def calculate_carbon_comparison(
    geo_id: str,
    alternate_geo_id: Optional[str],
    activity_tonnes: Optional[float] = None,
    factor_id: str = "road_freight_hgv_rigid_gt17t_avg_laden_uk_2021",
) -> CarbonComparisonResult:
    """World A ("no intervention") has no additional transport activity to
    attribute -- 0 kg is a definitional consequence of nothing being
    rerouted, not a measured or modeled value, so it is always available.
    World B ("with intervention") is the real transport-carbon calculation
    for the geo_id -> alternate_geo_id leg, only available once an alternate
    geography is actually specified."""
    world_a = WorldCarbon(label="Baseline (no intervention)", total_carbon_kg=0.0, available=True, truth_status="DERIVED", unavailable_reason=None)

    limitations = [
        "World A (no intervention) is 0 kg by definition -- no additional transport activity is attributable when no "
        "rerouting/alternate-sourcing intervention is applied. This is not a measured baseline food-system carbon "
        "footprint; it is the incremental carbon this specific intervention's transport activity would add."
    ]

    if not alternate_geo_id:
        world_b = WorldCarbon(
            label="Scenario (with intervention)",
            total_carbon_kg=None,
            available=False,
            truth_status="ESTIMATED",
            unavailable_reason="No alternate geography specified -- route diversification / alternative sourcing carbon requires knowing which district the flow is rerouted to/sourced from.",
        )
        return CarbonComparisonResult(world_a=world_a, world_b=world_b, delta_carbon_kg=None, pct_change=None, detail=None, limitations=limitations)

    detail = calculate_transport_carbon(geo_id, alternate_geo_id, activity_tonnes, factor_id)
    world_b = WorldCarbon(
        label="Scenario (with intervention)",
        total_carbon_kg=detail.total_carbon_kg,
        available=detail.available and detail.total_carbon_kg is not None,
        truth_status=detail.truth_status,
        unavailable_reason=detail.unavailable_reason if not detail.available else (None if detail.total_carbon_kg is not None else "No activity_tonnes supplied -- only carbon intensity (kg per tonne) could be computed, not a total."),
    )
    limitations.extend(detail.limitations)

    delta_carbon_kg: Optional[float] = None
    pct_change: Optional[float] = None
    if world_a.available and world_b.available and world_a.total_carbon_kg is not None and world_b.total_carbon_kg is not None:
        delta_carbon_kg = round(world_b.total_carbon_kg - world_a.total_carbon_kg, 3)
        # % change from a zero baseline is mathematically undefined -- report
        # the absolute delta only rather than a division by zero.
        if world_a.total_carbon_kg != 0:
            pct_change = round((delta_carbon_kg / world_a.total_carbon_kg) * 100, 2)

    return CarbonComparisonResult(
        world_a=world_a,
        world_b=world_b,
        delta_carbon_kg=delta_carbon_kg,
        pct_change=pct_change,
        detail=detail,
        limitations=limitations,
    )
