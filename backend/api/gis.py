"""GIS API contract for the frontend's Spatial Intelligence layer.

Every response here is either a direct read of the processed boundary files
(built deterministically by scripts/build_spatial_layer.py from OpenStreetMap
extracts) or a deterministic geometric computation (point-in-polygon,
count aggregation). No LLM involvement, no invented values.
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query

from backend.geoai.provenance import load_provenance
from backend.geoai.spatial_layer import get_registry

router = APIRouter(prefix="/gis", tags=["gis"])


@router.get("/telangana")
def get_state_boundary() -> dict:
    return get_registry().state.to_feature_collection()


@router.get("/districts")
def get_districts() -> dict:
    return get_registry().districts.to_feature_collection()


@router.get("/districts/{district_id}")
def get_district(district_id: str) -> dict:
    registry = get_registry()
    district = registry.districts.get(district_id)
    if district is None:
        raise HTTPException(status_code=404, detail=f"district_id '{district_id}' not found")
    mandal_count = registry.districts.aggregate_count_by(registry.mandals, fk_field="district_id").get(
        district_id, 0
    )
    return {**district, "mandal_count": mandal_count}


@router.get("/mandals")
def get_mandals(district_id: str | None = Query(default=None)) -> dict:
    registry = get_registry()
    if district_id is None:
        return registry.mandals.to_feature_collection()
    filtered = registry.mandals.gdf[registry.mandals.gdf["district_id"] == district_id]
    if filtered.empty and registry.districts.get(district_id) is None:
        raise HTTPException(status_code=404, detail=f"district_id '{district_id}' not found")
    return filtered.__geo_interface__


@router.get("/location")
def get_location(
    lon: float = Query(..., ge=76.0, le=82.0, description="Longitude (Telangana bounding range)"),
    lat: float = Query(..., ge=15.5, le=20.0, description="Latitude (Telangana bounding range)"),
) -> dict:
    return get_registry().locate(lon, lat)


@router.get("/provenance")
def get_provenance() -> dict:
    return load_provenance()


@router.get("/validate")
def get_validation_report() -> dict:
    reports = get_registry().validate_all()
    return {"layers": [asdict(r) for r in reports], "all_valid": all(r.is_valid for r in reports)}
