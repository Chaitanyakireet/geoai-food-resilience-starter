"""Hours 5-8 GeoAI + risk engine tests.

Covers: feature schema, deterministic calculations, missing-data handling,
geographic alignment, food-category dimension, risk output schema,
uncertainty fields, provenance, and no-data/fallback behavior.
"""
import copy
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.geoai.spatial_layer import get_registry
from backend.risk.baseline_model import compute_risk_for_district, get_risk
from backend.risk.contracts import RiskInput
from backend.risk.features import (
    REQUIRED_FEATURE_SCHEMA_KEYS,
    get_district_feature_row,
    load_climate_feature_table,
    load_features_config,
)

client = TestClient(app)

SAMPLE_ROW = {
    "geo_id": "test_district",
    "geo_level": "district",
    "date": "20260914",
    "observed": {"t2m_mean_c": 26.0, "t2m_max_mean_c": 30.0, "precip_mean_mm_day": 4.0, "truth_status": "OBSERVED"},
    "climatology_baseline": {
        "t2m_mean_c": 25.0,
        "t2m_max_mean_c": 30.0,
        "precip_mean_mm_day": 5.0,
        "period": "2001-2020",
        "truth_status": "OBSERVED",
    },
    "data_coverage": {"requested_days": 30, "available_days": 30, "coverage_ratio": 1.0},
}


# --- feature schema --------------------------------------------------------


def test_all_district_feature_rows_have_required_schema_keys():
    table = load_climate_feature_table()
    assert len(table) == 33
    for row in table.values():
        assert REQUIRED_FEATURE_SCHEMA_KEYS <= set(row.keys())


def test_feature_row_truth_status_is_observed_for_raw_inputs():
    row = get_district_feature_row("hyderabad")
    assert row["observed"]["truth_status"] == "OBSERVED"
    assert row["climatology_baseline"]["truth_status"] == "OBSERVED"


# --- deterministic calculations --------------------------------------------


def test_same_input_produces_same_risk_score():
    result_a = compute_risk_for_district(RiskInput(geo_id="test_district"), SAMPLE_ROW)
    result_b = compute_risk_for_district(RiskInput(geo_id="test_district"), SAMPLE_ROW)
    assert result_a.risk_score == result_b.risk_score
    assert result_a.risk_class == result_b.risk_class


def test_risk_score_matches_hand_computed_formula():
    # rainfall deficit: (5.0 - 4.0) / 5.0 = 0.20; threshold 0.30 -> component 0.6667
    # heat stress: (26.0 - 25.0) / 25.0 = 0.04; threshold 0.15 -> component 0.2667
    # score = 0.6*0.6667 + 0.4*0.2667 = 0.4 + 0.1067 = 0.5067
    result = compute_risk_for_district(RiskInput(geo_id="test_district"), SAMPLE_ROW)
    assert result.risk_score == pytest.approx(0.5067, abs=1e-3)


def test_t2m_max_is_reported_but_excluded_from_score():
    result = compute_risk_for_district(RiskInput(geo_id="test_district"), SAMPLE_ROW)
    t2m_max_driver = next(d for d in result.major_drivers if d.feature == "heat_stress_t2m_max_context")
    assert t2m_max_driver.used_in_score is False
    assert t2m_max_driver.note is not None


# --- missing-data / no-data / fallback behavior -----------------------------


def test_low_coverage_returns_insufficient_data_class():
    row = copy.deepcopy(SAMPLE_ROW)
    row["data_coverage"] = {"requested_days": 30, "available_days": 5, "coverage_ratio": 0.167}
    result = compute_risk_for_district(RiskInput(geo_id="test_district"), row)
    assert result.risk_class == "insufficient_data"
    assert result.risk_score is None
    assert result.confidence == "low"


def test_full_coverage_does_not_return_insufficient_data():
    result = compute_risk_for_district(RiskInput(geo_id="test_district"), SAMPLE_ROW)
    assert result.risk_class != "insufficient_data"
    assert result.risk_score is not None


def test_unknown_geo_id_raises_keyerror():
    with pytest.raises(KeyError):
        get_risk(RiskInput(geo_id="not_a_real_place"))


def test_risk_endpoint_404_for_unknown_geo_id():
    resp = client.get("/risk", params={"geo_id": "not_a_real_place"})
    assert resp.status_code == 404


# --- geographic alignment ---------------------------------------------------


def test_district_level_risk_resolves_directly():
    result = get_risk(RiskInput(geo_id="hyderabad"))
    assert result.geo_level == "district"
    assert result.resolved_via == "district_centroid_direct"
    assert result.region_id == "hyderabad"


def test_mandal_level_risk_inherits_from_parent_district():
    registry = get_registry()
    sample_mandal_id = registry.mandals.gdf["mandal_id"].iloc[0]
    parent_district_id = registry.mandals.gdf["district_id"].iloc[0]

    result = get_risk(RiskInput(geo_id=sample_mandal_id))
    assert result.geo_level == "mandal"
    assert result.region_id == sample_mandal_id
    assert parent_district_id in result.resolved_via
    assert any("inherited" in lim.lower() for lim in result.limitations)


def test_state_summary_covers_all_33_districts():
    resp = client.get("/risk/state")
    assert resp.status_code == 200
    body = resp.json()
    assert body["district_count"] == 33
    assert body["truth_status"] == "DERIVED"


# --- food-category dimension ------------------------------------------------


def test_all_configured_food_categories_accepted():
    config = load_features_config()
    for category in config["food_categories"]:
        result = compute_risk_for_district(RiskInput(geo_id="test_district", food_category=category), SAMPLE_ROW)
        assert result.food_scope == category


def test_unknown_food_category_rejected():
    with pytest.raises(ValueError):
        compute_risk_for_district(RiskInput(geo_id="test_district", food_category="not_a_real_category"), SAMPLE_ROW)


def test_risk_endpoint_rejects_unknown_food_category():
    resp = client.get("/risk", params={"geo_id": "hyderabad", "food_category": "not_a_real_category"})
    assert resp.status_code == 400


def test_food_category_defaults_to_all_food():
    resp = client.get("/risk", params={"geo_id": "hyderabad"})
    assert resp.json()["food_scope"] == "all_food"


# --- risk output schema / uncertainty fields --------------------------------


def test_risk_endpoint_response_schema():
    resp = client.get("/risk", params={"geo_id": "hyderabad"})
    assert resp.status_code == 200
    body = resp.json()
    required_top_level = {
        "region_id",
        "geo_level",
        "food_scope",
        "horizon",
        "date",
        "risk_score",
        "risk_class",
        "confidence",
        "uncertainty_interval",
        "major_drivers",
        "data_coverage",
        "model_version",
        "run_id",
        "truth_status",
        "resolved_via",
        "provenance_refs",
        "limitations",
    }
    assert required_top_level <= set(body.keys())


def test_uncertainty_interval_brackets_risk_score():
    resp = client.get("/risk", params={"geo_id": "hyderabad"})
    body = resp.json()
    lo, hi = body["uncertainty_interval"]
    assert lo <= body["risk_score"] <= hi
    assert lo >= 0.0 and hi <= 1.0


def test_confidence_is_one_of_allowed_values():
    resp = client.get("/risk", params={"geo_id": "hyderabad"})
    assert resp.json()["confidence"] in {"low", "medium", "high"}


def test_naked_risk_number_is_never_returned_alone():
    resp = client.get("/risk", params={"geo_id": "hyderabad"})
    body = resp.json()
    assert body["major_drivers"]
    assert body["data_coverage"] is not None
    assert body["truth_status"] is not None


# --- provenance --------------------------------------------------------------


def test_risk_provenance_endpoint_has_required_fields():
    resp = client.get("/risk/provenance")
    assert resp.status_code == 200
    body = resp.json()
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


def test_risk_result_provenance_refs_match_provenance_dataset_names():
    provenance = client.get("/risk/provenance").json()
    known_names = {d["dataset_name"] for d in provenance["datasets"]}
    result = client.get("/risk", params={"geo_id": "hyderabad"}).json()
    assert set(result["provenance_refs"]) <= known_names


def test_validation_report_endpoint_available():
    resp = client.get("/risk/validation-report")
    assert resp.status_code == 200
    body = resp.json()
    assert "spatial_smoothness" in body
    assert "temporal_spot_check" in body
    assert "leakage_check" in body
    assert body["leakage_check"]["passed"] is True
