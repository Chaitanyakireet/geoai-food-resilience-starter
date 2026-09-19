"""Food-System Carbon Impact Calculator tests.

Covers: deterministic arithmetic (distance x factor x activity), unit
handling, missing-factor (not_modeled) behavior, missing-geo-id behavior,
provenance completeness, truth-status labeling, zero/edge cases (same
origin/destination, no activity_tonnes, zero baseline in comparisons), and
API/UI integration via the FastAPI TestClient.
"""
import sys
from math import isclose
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.carbon.calculator import calculate_carbon_comparison, calculate_transport_carbon, haversine_km
from backend.carbon.registry import get_factor, list_factors

client = TestClient(app)

TRANSPORT_FACTOR_ID = "road_freight_hgv_rigid_gt17t_avg_laden_uk_2021"
NOT_MODELED_FACTOR_ID = "cold_chain_storage_electricity"


# --- Registry ----------------------------------------------------------------


def test_registry_has_one_available_and_one_not_modeled_factor():
    factors = {f.factor_id: f for f in list_factors()}
    assert factors[TRANSPORT_FACTOR_ID].status == "available"
    assert factors[NOT_MODELED_FACTOR_ID].status == "not_modeled"
    assert factors[NOT_MODELED_FACTOR_ID].factor_value is None


def test_available_factor_has_full_provenance_fields():
    factor = get_factor(TRANSPORT_FACTOR_ID)
    assert factor.source_name and "BEIS" in factor.source_name
    assert factor.source_url.startswith("https://")
    assert factor.unit == "kg CO2e per tonne-km"
    assert factor.geography
    assert factor.year == 2021
    assert factor.methodology
    assert factor.uncertainty_limitations


def test_unknown_factor_id_raises():
    with pytest.raises(KeyError):
        calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=1, factor_id="not_a_real_factor")


# --- Haversine distance --------------------------------------------------------


def test_haversine_zero_distance_for_identical_points():
    assert haversine_km(78.0, 17.0, 78.0, 17.0) == 0.0


def test_haversine_known_distance_hyderabad_delhi_order_of_magnitude():
    # Hyderabad (~78.47, 17.38) to Delhi (~77.21, 28.61) is a real ~1250-1300km
    # great-circle distance (matches published flight distances) -- sanity-
    # checks the formula's magnitude/units.
    d = haversine_km(78.47, 17.38, 77.21, 28.61)
    assert 1200 < d < 1350


# --- Deterministic arithmetic --------------------------------------------------


def test_transport_carbon_arithmetic_is_exact():
    result = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=10)
    factor = get_factor(TRANSPORT_FACTOR_ID)
    expected_intensity = round(result.distance_km * factor.factor_value, 4)
    expected_total = round(expected_intensity * 10, 3)
    assert result.carbon_intensity_kg_per_tonne == expected_intensity
    assert result.total_carbon_kg == expected_total


def test_transport_carbon_is_deterministic_repeatable():
    r1 = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=10)
    r2 = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=10)
    assert r1.distance_km == r2.distance_km
    assert r1.total_carbon_kg == r2.total_carbon_kg


def test_transport_carbon_scales_linearly_with_tonnage():
    r1 = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=1)
    r10 = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=10)
    # rel_tol allows for the deliberate 3-decimal-place rounding applied to
    # each result independently (not a compounding error).
    assert isclose(r10.total_carbon_kg, r1.total_carbon_kg * 10, rel_tol=1e-3)


def test_transport_carbon_mandal_resolves_via_centroid():
    # A real mandal id (Serilingampalle, Ranga Reddy) should resolve just
    # like a district id -- distance is a geometric fact, not gated behind
    # district-level inheritance rules like risk scoring is.
    result = calculate_transport_carbon("hyderabad", "serilingampalle_mandal_9832843", activity_tonnes=1)
    assert result.available
    assert result.distance_km is not None and result.distance_km > 0


# --- Missing-factor / missing-geo behavior --------------------------------------


def test_not_modeled_factor_returns_unavailable_not_fabricated():
    result = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=10, factor_id=NOT_MODELED_FACTOR_ID)
    assert result.available is False
    assert result.total_carbon_kg is None
    assert result.carbon_intensity_kg_per_tonne is None
    assert result.unavailable_reason is not None


def test_unknown_geo_id_returns_unavailable_with_reason():
    result = calculate_transport_carbon("hyderabad", "not_a_real_geo_id", activity_tonnes=10)
    assert result.available is False
    assert result.distance_km is None
    assert "not_a_real_geo_id" in result.unavailable_reason


# --- Missing activity_tonnes (intensity-only) -----------------------------------


def test_no_activity_tonnes_gives_intensity_only():
    result = calculate_transport_carbon("hyderabad", "khammam")
    assert result.available is True
    assert result.total_carbon_kg is None
    assert result.carbon_intensity_kg_per_tonne is not None
    assert result.truth_status == "DERIVED"


def test_activity_tonnes_supplied_marks_result_estimated():
    result = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=10)
    assert result.truth_status == "ESTIMATED"


# --- Zero / edge cases -----------------------------------------------------------


def test_same_origin_and_destination_is_zero_not_an_error():
    result = calculate_transport_carbon("hyderabad", "hyderabad", activity_tonnes=5)
    assert result.available is True
    assert result.distance_km == 0.0
    assert result.total_carbon_kg == 0.0


def test_zero_activity_tonnes_gives_zero_total_not_none():
    result = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=0)
    assert result.total_carbon_kg == 0.0


# --- Compare Worlds (baseline vs scenario) --------------------------------------


def test_compare_worlds_baseline_is_zero_and_available():
    comparison = calculate_carbon_comparison("hyderabad", "khammam", activity_tonnes=10)
    assert comparison.world_a.total_carbon_kg == 0.0
    assert comparison.world_a.available is True


def test_compare_worlds_no_alternate_geo_makes_scenario_unavailable():
    comparison = calculate_carbon_comparison("hyderabad", None)
    assert comparison.world_b.available is False
    assert comparison.delta_carbon_kg is None
    assert comparison.pct_change is None


def test_compare_worlds_pct_change_none_when_baseline_zero():
    # World A is always 0 by definition, so pct_change (division by baseline)
    # must never be computed -- only the absolute delta is meaningful.
    comparison = calculate_carbon_comparison("hyderabad", "khammam", activity_tonnes=10)
    assert comparison.world_a.total_carbon_kg == 0.0
    assert comparison.pct_change is None
    assert comparison.delta_carbon_kg == comparison.world_b.total_carbon_kg


def test_compare_worlds_delta_matches_detail_total():
    comparison = calculate_carbon_comparison("hyderabad", "khammam", activity_tonnes=10)
    assert comparison.delta_carbon_kg == comparison.detail.total_carbon_kg


def test_compare_worlds_unavailable_scenario_has_no_delta():
    comparison = calculate_carbon_comparison("hyderabad", "khammam", activity_tonnes=10, factor_id=NOT_MODELED_FACTOR_ID)
    assert comparison.world_b.available is False
    assert comparison.delta_carbon_kg is None


# --- Provenance completeness -----------------------------------------------------


def test_available_result_carries_full_provenance_chain():
    result = calculate_transport_carbon("hyderabad", "khammam", activity_tonnes=10)
    assert result.factor.source_name and result.factor.source_url and result.factor.year
    assert len(result.limitations) > 0
    assert result.distance_truth_status == "DERIVED"
    assert result.truth_status in {"OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"}


# --- API integration ---------------------------------------------------------------


def test_api_get_factors():
    resp = client.get("/carbon/factors")
    assert resp.status_code == 200
    ids = {f["factor_id"] for f in resp.json()}
    assert TRANSPORT_FACTOR_ID in ids
    assert NOT_MODELED_FACTOR_ID in ids


def test_api_post_calculate():
    resp = client.post(
        "/carbon/calculate",
        json={"origin_geo_id": "hyderabad", "destination_geo_id": "khammam", "activity_tonnes": 10},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["total_carbon_kg"] > 0


def test_api_post_calculate_unknown_factor_returns_404():
    resp = client.post(
        "/carbon/calculate",
        json={"origin_geo_id": "hyderabad", "destination_geo_id": "khammam", "factor_id": "nope"},
    )
    assert resp.status_code == 404


def test_api_post_compare():
    resp = client.post(
        "/carbon/compare",
        json={"geo_id": "hyderabad", "alternate_geo_id": "khammam", "activity_tonnes": 10},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["world_a"]["total_carbon_kg"] == 0.0
    assert body["world_b"]["total_carbon_kg"] > 0


def test_api_post_compare_missing_alternate_geo_is_valid_and_unavailable():
    resp = client.post("/carbon/compare", json={"geo_id": "hyderabad"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["world_b"]["available"] is False
