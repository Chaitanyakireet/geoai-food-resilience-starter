"""Hours 0-2 foundation smoke test: the backend boots and reflects the
locked project configuration via /health. No analytical logic is under
test yet -- that arrives with each subsequent module."""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


def test_health_reflects_locked_config():
    body = client.get("/health").json()
    project = body["project"]
    assert project["region"] == "Hyderabad–Telangana"
    assert project["food_scope"] == "multi_food_food_agnostic"
    assert project["primary_sdg"] == "SDG 2"


def test_health_exposes_full_core_loop():
    body = client.get("/health").json()
    assert body["loop_stages"] == [
        "sense",
        "predict",
        "diagnose_trace",
        "reason",
        "optimize",
        "simulate",
        "recover",
        "verify_impact",
        "explain",
        "human_review",
    ]


def test_health_exposes_truth_status_labels():
    body = client.get("/health").json()
    assert body["truth_status_labels"] == [
        "OBSERVED",
        "DERIVED",
        "ESTIMATED",
        "COUNTERFACTUAL",
        "SIMULATED",
    ]
