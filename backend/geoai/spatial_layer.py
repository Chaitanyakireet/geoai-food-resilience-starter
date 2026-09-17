"""Reusable spatial data layer for the GeoAI Food-Resilience Digital Twin.

This module is the single place later modules (risk, food graph, optimization,
digital twin) load administrative geometry from. It wraps a GeoDataFrame with:
  - geometry validity checking
  - point-in-polygon location lookup
  - parent/child spatial aggregation (e.g. mandals -> district)
  - GeoJSON serialization for the API

No numeric outputs here are modeled or fabricated -- area/centroid are plain
deterministic geometric calculations over the processed boundary files built
by scripts/build_spatial_layer.py, and every value carries a truth_status
label from that pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import geopandas as gpd
from shapely.geometry import Point

REPO_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
EXPECTED_CRS = "EPSG:4326"


@dataclass
class ValidationReport:
    layer: str
    feature_count: int
    crs: str
    crs_matches_expected: bool
    invalid_geometry_ids: list[str]
    null_geometry_ids: list[str]

    @property
    def is_valid(self) -> bool:
        return self.crs_matches_expected and not self.invalid_geometry_ids and not self.null_geometry_ids


class SpatialLayer:
    """A single administrative-geometry layer (state, district, or mandal)."""

    def __init__(self, gdf: gpd.GeoDataFrame, id_field: str, level: str):
        self.gdf = gdf
        self.id_field = id_field
        self.level = level

    @classmethod
    def from_geojson(cls, filename: str, id_field: str, level: str) -> "SpatialLayer":
        path = PROCESSED_DIR / filename
        if not path.exists():
            raise FileNotFoundError(
                f"{path} not found -- run scripts/build_spatial_layer.py to generate processed layers"
            )
        gdf = gpd.read_file(path)
        return cls(gdf, id_field=id_field, level=level)

    def validate(self) -> ValidationReport:
        crs_str = str(self.gdf.crs)
        invalid_ids = self.gdf.loc[~self.gdf.geometry.is_valid, self.id_field].astype(str).tolist()
        null_ids = self.gdf.loc[self.gdf.geometry.isna(), self.id_field].astype(str).tolist()
        return ValidationReport(
            layer=self.level,
            feature_count=len(self.gdf),
            crs=crs_str,
            crs_matches_expected=crs_str.upper() == EXPECTED_CRS,
            invalid_geometry_ids=invalid_ids,
            null_geometry_ids=null_ids,
        )

    def get(self, feature_id: str) -> Optional[dict]:
        row = self.gdf.loc[self.gdf[self.id_field] == feature_id]
        if row.empty:
            return None
        return self._row_to_properties(row.iloc[0])

    def point_lookup(self, lon: float, lat: float) -> Optional[dict]:
        """Deterministic point-in-polygon lookup: which feature contains (lon, lat)?"""
        point = Point(lon, lat)
        hits = self.gdf[self.gdf.geometry.contains(point)]
        if hits.empty:
            return None
        return self._row_to_properties(hits.iloc[0])

    def aggregate_count_by(self, child_layer: "SpatialLayer", fk_field: str) -> dict[str, int]:
        """Count how many child features (e.g. mandals) reference each of this
        layer's ids via fk_field (e.g. district_id on the mandal layer)."""
        counts = child_layer.gdf.groupby(fk_field).size()
        return {str(k): int(v) for k, v in counts.items()}

    def to_feature_collection(self) -> dict:
        return self.gdf.__geo_interface__

    def _row_to_properties(self, row) -> dict:
        props = row.drop(labels=["geometry"]).to_dict()
        return props


class SpatialRegistry:
    """Loads and holds all processed spatial layers for the API to serve."""

    def __init__(self):
        self.state = SpatialLayer.from_geojson("telangana_state.geojson", id_field="state_id", level="state")
        self.districts = SpatialLayer.from_geojson(
            "telangana_districts.geojson", id_field="district_id", level="district"
        )
        self.mandals = SpatialLayer.from_geojson("telangana_mandals.geojson", id_field="mandal_id", level="mandal")

    def validate_all(self) -> list[ValidationReport]:
        return [self.state.validate(), self.districts.validate(), self.mandals.validate()]

    def locate(self, lon: float, lat: float) -> dict:
        """Full location intelligence resolution: which district and mandal
        contain this point, deterministically, via point-in-polygon."""
        district = self.districts.point_lookup(lon, lat)
        mandal = self.mandals.point_lookup(lon, lat)
        return {
            "query": {"lon": lon, "lat": lat},
            "district": district,
            "mandal": mandal,
            "resolved": district is not None,
        }


_registry: Optional[SpatialRegistry] = None


def get_registry() -> SpatialRegistry:
    global _registry
    if _registry is None:
        _registry = SpatialRegistry()
    return _registry
