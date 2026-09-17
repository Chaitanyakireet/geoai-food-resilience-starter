"""Hours 2-5 data + GIS foundation tests.

Covers: geometry loading, geometry validity, expected administrative
hierarchy, CRS consistency, provenance metadata, and spatial lookup/
aggregation -- all against the processed Telangana boundary layers.
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.geoai.spatial_layer import get_registry

client = TestClient(app)


# --- geometry loading -------------------------------------------------


def test_state_layer_loads_one_feature():
    registry = get_registry()
    assert len(registry.state.gdf) == 1


def test_district_layer_loads_33_features():
    registry = get_registry()
    assert len(registry.districts.gdf) == 33


def test_mandal_layer_loads_features():
    registry = get_registry()
    assert len(registry.mandals.gdf) > 0


# --- geometry validity --------------------------------------------------


@pytest.mark.parametrize("layer_name", ["state", "districts", "mandals"])
def test_layer_has_no_invalid_or_null_geometry(layer_name):
    registry = get_registry()
    report = getattr(registry, layer_name).validate()
    assert report.invalid_geometry_ids == []
    assert report.null_geometry_ids == []


# --- CRS consistency -----------------------------------------------------


@pytest.mark.parametrize("layer_name", ["state", "districts", "mandals"])
def test_layer_crs_is_wgs84(layer_name):
    registry = get_registry()
    report = getattr(registry, layer_name).validate()
    assert report.crs_matches_expected, f"{layer_name} CRS is {report.crs}, expected EPSG:4326"


def test_validate_endpoint_reports_all_valid():
    resp = client.get("/gis/validate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["all_valid"] is True
    assert len(body["layers"]) == 3


# --- expected administrative hierarchy -----------------------------------


def test_every_mandal_resolves_to_a_district():
    registry = get_registry()
    assert registry.mandals.gdf["district_id"].isna().sum() == 0


def test_every_mandal_district_id_is_a_real_district():
    registry = get_registry()
    valid_ids = set(registry.districts.gdf["district_id"])
    mandal_district_ids = set(registry.mandals.gdf["district_id"])
    assert mandal_district_ids <= valid_ids


def test_district_endpoint_reports_mandal_count():
    resp = client.get("/gis/districts")
    first_id = resp.json()["features"][0]["properties"]["district_id"]
    detail = client.get(f"/gis/districts/{first_id}").json()
    assert "mandal_count" in detail
    assert detail["mandal_count"] >= 0


def test_unknown_district_returns_404():
    resp = client.get("/gis/districts/not_a_real_district")
    assert resp.status_code == 404


# --- provenance metadata --------------------------------------------------


def test_provenance_endpoint_has_required_fields():
    resp = client.get("/gis/provenance")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["datasets"]) >= 2
    required_fields = {
        "dataset_name",
        "publisher",
        "source_url",
        "access_date",
        "license",
        "geographic_level",
        "crs",
        "processing",
        "truth_status",
        "limitations",
    }
    for dataset in body["datasets"]:
        assert required_fields <= set(dataset.keys())
        assert dataset["truth_status"] in {"OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"}


def test_provenance_documents_the_tgrac_fallback():
    resp = client.get("/gis/provenance")
    body = resp.json()
    rejected_names = [d["dataset_name"] for d in body["evaluated_but_rejected_sources"]]
    assert any("TGRAC" in name for name in rejected_names)


# --- spatial lookup / aggregation -----------------------------------------


def test_point_lookup_resolves_hyderabad():
    # Hyderabad city centre (Charminar area), well inside Hyderabad district.
    resp = client.get("/gis/location", params={"lon": 78.4747, "lat": 17.3616})
    assert resp.status_code == 200
    body = resp.json()
    assert body["resolved"] is True
    assert body["district"]["name"] == "Hyderabad"


def test_point_lookup_outside_telangana_does_not_resolve():
    # Chennai, well outside Telangana's bounding range -- query validation should reject it.
    resp = client.get("/gis/location", params={"lon": 80.2707, "lat": 13.0827})
    assert resp.status_code == 422


def test_aggregate_count_by_matches_manual_groupby():
    registry = get_registry()
    counts = registry.districts.aggregate_count_by(registry.mandals, fk_field="district_id")
    manual = registry.mandals.gdf.groupby("district_id").size()
    assert counts[manual.index[0]] == int(manual.iloc[0])
    assert sum(counts.values()) == len(registry.mandals.gdf)


def test_mandals_filtered_by_district_endpoint():
    registry = get_registry()
    sample_district_id = registry.districts.gdf["district_id"].iloc[0]
    resp = client.get("/gis/mandals", params={"district_id": sample_district_id})
    assert resp.status_code == 200
    features = resp.json()["features"]
    assert len(features) > 0
    assert all(f["properties"]["district_id"] == sample_district_id for f in features)
