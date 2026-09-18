"""Hours 39-42 AI Decision Brief / Copilot tests.

Covers: evidence retrieval (found + not-found), provenance/truth-status
propagation, deterministic tool routing, structured (non-fabricated) tool
results cross-checked against direct engine calls, citation attachment,
scenario-context handling, provider-not-configured behavior, deterministic
fallback behavior/determinism, malformed tool-call handling, and the LLM
tool-use loop wired against a fake provider (no real API key needed/used).
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import pytest
from fastapi.testclient import TestClient

from backend.ai.contracts import EvidenceQuery, ScenarioContext
from backend.ai.evidence import retrieve_evidence
from backend.ai.fallback import classify_and_run, compose_fallback_answer
from backend.ai.orchestrator import build_decision_brief, run_query
from backend.ai.provider import LLMProvider, ProviderResponse, ToolUseBlock, get_provider
from backend.ai.tools import invoke_tool
from backend.api.main import app

client = TestClient(app)


# --- Evidence retrieval -------------------------------------------------------


def test_evidence_retrieval_finds_real_matches():
    result = retrieve_evidence(EvidenceQuery(query="risk methodology weights thresholds", top_k=3))
    assert result.found is True
    assert len(result.matches) > 0
    assert result.matches[0].relevance_score > 0


def test_evidence_retrieval_no_match_returns_explicit_not_found():
    result = retrieve_evidence(EvidenceQuery(query="xyzabc12345nonexistentterm qwzxjk", top_k=3))
    assert result.found is False
    assert result.matches == []
    assert any("no corpus document" in l.lower() for l in result.limitations)


def test_evidence_items_carry_provenance_and_truth_status():
    result = retrieve_evidence(EvidenceQuery(query="NASA POWER climate data source", top_k=5))
    assert result.found is True
    for item in result.matches:
        assert item.provenance_id
        assert item.source_name
        assert item.truth_status in ("OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED")


def test_evidence_retrieval_is_deterministic():
    q = EvidenceQuery(query="intervention effectiveness assumptions", top_k=3)
    r1 = retrieve_evidence(q)
    r2 = retrieve_evidence(q)
    assert [m.provenance_id for m in r1.matches] == [m.provenance_id for m in r2.matches]


# --- Tool layer: structured, non-fabricated results ---------------------------


def test_get_risk_tool_matches_direct_engine_call():
    from backend.risk.baseline_model import get_risk as engine_get_risk
    from backend.risk.contracts import RiskInput

    tool_result, error = invoke_tool("get_risk", {"geo_id": "hyderabad"})
    assert error is None
    direct = engine_get_risk(RiskInput(geo_id="hyderabad")).model_dump()
    assert tool_result["risk_score"] == direct["risk_score"]
    assert tool_result["risk_class"] == direct["risk_class"]
    assert tool_result["truth_status"] == direct["truth_status"]


def test_inspect_location_combines_geography_risk_resilience():
    result, error = invoke_tool("inspect_location", {"geo_id": "khammam"})
    assert error is None
    assert result["geo_id"] == "khammam"
    assert result["geo_level"] == "district"
    assert "risk_class" in result["risk"]
    assert "resilience_gap" in result["resilience"]


def test_calculate_impact_matches_direct_twin_engine():
    from backend.graph.contracts import ShockInput
    from backend.twin.contracts import TwinScenario
    from backend.twin.engine import run_twin_scenario

    tool_result, error = invoke_tool(
        "calculate_impact",
        {"geo_id": "hyderabad", "target_node_id": "production_hyderabad", "shock_type": "production_reduction", "severity": 0.4},
    )
    assert error is None
    direct = run_twin_scenario(
        TwinScenario(scenario_id="x", geo_id="hyderabad", shock=ShockInput(target_node_id="production_hyderabad", shock_type="production_reduction", severity=0.4))
    ).model_dump()
    assert tool_result["shocked_state"]["resilience_gap"] == direct["shocked_state"]["resilience_gap"]
    assert tool_result["shock_recovery_metrics"]["peak_disruption"] == direct["shock_recovery_metrics"]["peak_disruption"]


def test_unknown_geo_id_tool_error_not_crash():
    result, error = invoke_tool("get_risk", {"geo_id": "not_a_real_place"})
    assert error is not None
    assert "not_a_real_place" in error


def test_unknown_tool_name_returns_error():
    result, error = invoke_tool("delete_everything", {})
    assert error is not None
    assert "Unknown tool" in error


def test_malformed_tool_arguments_return_error_not_exception():
    # missing required 'geo_id' argument
    result, error = invoke_tool("get_risk", {})
    assert error is not None
    assert "Malformed arguments" in error


# --- Deterministic intent routing ----------------------------------------------


def test_routing_risk_question_calls_inspect_location():
    records, _ = classify_and_run("What is the current risk in Hyderabad?", ScenarioContext(geo_id="hyderabad"))
    tool_names = [r.tool_name for r in records]
    assert "inspect_location" in tool_names


def test_routing_vulnerability_question_calls_location_and_graph():
    records, _ = classify_and_run("Why is this location vulnerable?", ScenarioContext(geo_id="khammam"))
    tool_names = [r.tool_name for r in records]
    assert "inspect_location" in tool_names
    assert "inspect_food_graph" in tool_names


def test_routing_evidence_question_calls_retrieve_evidence():
    records, _ = classify_and_run("Where did this evidence come from?", None)
    assert [r.tool_name for r in records] == ["retrieve_evidence"]


def test_routing_without_geo_context_does_not_crash():
    records, _ = classify_and_run("What is the current risk?", None)
    # No geo_id available -> falls through to the evidence default rather than guessing a geography
    assert len(records) >= 1


def test_routing_shock_question_uses_illustrative_severity_when_unspecified():
    records, _ = classify_and_run("What happens if transport capacity falls?", ScenarioContext(geo_id="hyderabad"))
    shock_records = [r for r in records if r.tool_name == "simulate_shock"]
    assert len(shock_records) == 1
    assert shock_records[0].arguments["transport_capacity_reduction"] == pytest.approx(0.3)


# --- Deterministic fallback: determinism + no fabrication ---------------------


def test_fallback_answer_is_labeled_structured_not_ai_generated():
    records, _ = classify_and_run("What is the current risk in Hyderabad?", ScenarioContext(geo_id="hyderabad"))
    answer = compose_fallback_answer("What is the current risk in Hyderabad?", records)
    assert "Structured system brief" in answer
    assert "AI generation is unavailable" in answer


def test_fallback_is_deterministic_across_repeated_calls():
    q = "What is the current risk in Hyderabad?"
    ctx = ScenarioContext(geo_id="hyderabad")
    r1, _ = classify_and_run(q, ctx)
    r2, _ = classify_and_run(q, ctx)
    a1 = compose_fallback_answer(q, r1)
    a2 = compose_fallback_answer(q, r2)
    assert a1 == a2


# --- Provider configuration -----------------------------------------------------


def test_provider_not_configured_by_default(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    provider = get_provider()
    assert provider.is_configured() is False
    assert provider.name == "none"


def test_provider_configured_when_api_key_present(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-fake-key-not-real")
    provider = get_provider()
    assert provider.is_configured() is True
    assert provider.name == "anthropic"


# --- POST /ai/query and /ai/decision-brief (fallback mode, no key set) --------


def test_ai_query_endpoint_fallback_mode(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.post("/ai/query", json={"question": "What is the current risk in Hyderabad?", "scenario_context": {"geo_id": "hyderabad"}})
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "deterministic_fallback"
    assert "not configured" in body["provider_status"]
    assert len(body["tool_trace"]) > 0
    assert body["tool_trace"][0]["status"] == "ok"


def test_ai_query_rejects_empty_question():
    resp = client.post("/ai/query", json={"question": "   "})
    assert resp.status_code == 400


def test_ai_query_citation_attachment(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.post("/ai/query", json={"question": "What evidence supports the risk methodology?"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["citations"]) > 0
    for c in body["citations"]:
        assert c["provenance_id"]
        assert c["truth_status"]


def test_ai_query_no_fabricated_citation_when_evidence_missing(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.post("/ai/query", json={"question": "Tell me about xyzabc12345nonexistentterm qwzxjk"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["citations"] == []


def test_decision_brief_endpoint_with_full_scenario_context(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.post(
        "/ai/decision-brief",
        json={
            "scenario_context": {
                "geo_id": "hyderabad",
                "food_category": "all_food",
                "shock_field": "production_disruption",
                "severity": 0.4,
                "intervention_types": ["alternative_sourcing"],
            }
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "deterministic_fallback"
    titles = [s["title"] for s in body["sections"]]
    assert "EXECUTIVE SITUATION" in titles
    assert "MODELED PORTFOLIO" in titles
    assert "LIMITATIONS" in titles
    # every numeric claim traces to a tool call in the trace
    assert any(t["tool_name"] == "calculate_impact" and t["status"] == "ok" for t in body["tool_trace"])


def test_decision_brief_with_empty_scenario_context_does_not_crash():
    resp = client.post("/ai/decision-brief", json={"scenario_context": {}})
    assert resp.status_code == 200
    body = resp.json()
    titles = [s["title"] for s in body["sections"]]
    assert "LIMITATIONS" in titles
    assert "EXECUTIVE SITUATION" not in titles  # no geo_id given, so nothing was fabricated for it


def test_ai_tool_endpoint_structured_result():
    resp = client.post("/ai/tool", json={"tool_name": "get_risk", "arguments": {"geo_id": "warangal"}})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["result"]["region_id"] == "warangal"


def test_ai_tool_endpoint_unknown_tool_is_graceful():
    resp = client.post("/ai/tool", json={"tool_name": "not_a_real_tool", "arguments": {}})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "error"
    assert "Unknown tool" in body["error"]


def test_ai_provenance_endpoint_exposes_no_secret(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-should-never-appear-in-response")
    resp = client.get("/ai/provenance")
    assert resp.status_code == 200
    assert "sk-should-never-appear-in-response" not in resp.text
    body = resp.json()
    assert body["provider"]["configured"] is True
    assert len(body["approved_tools"]) == 8


# --- LLM tool-use loop, wired against a fake provider (no real API key) -------


class FakeProvider(LLMProvider):
    name = "fake"

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    def is_configured(self):
        return True

    def complete(self, system, messages, tools):
        response = self._responses[self.calls]
        self.calls += 1
        return response


def test_llm_path_executes_tool_then_returns_final_answer(monkeypatch):
    fake = FakeProvider(
        [
            ProviderResponse(tool_uses=[ToolUseBlock(id="t1", name="get_risk", input={"geo_id": "hyderabad"})]),
            ProviderResponse(text_blocks=["Risk in Hyderabad is moderate. [Source: Risk configuration]"]),
        ]
    )
    monkeypatch.setattr("backend.ai.orchestrator.get_provider", lambda: fake)
    result = run_query("What is the current risk in Hyderabad?", ScenarioContext(geo_id="hyderabad"))
    assert result.mode == "llm"
    assert fake.calls == 2
    assert result.tool_trace[0].tool_name == "get_risk"
    assert result.tool_trace[0].status == "ok"
    assert "moderate" in result.answer


def test_llm_path_falls_back_on_provider_error(monkeypatch):
    class ExplodingProvider(LLMProvider):
        name = "exploding"

        def is_configured(self):
            return True

        def complete(self, system, messages, tools):
            raise RuntimeError("simulated network failure")

    monkeypatch.setattr("backend.ai.orchestrator.get_provider", lambda: ExplodingProvider())
    result = run_query("What is the current risk in Hyderabad?", ScenarioContext(geo_id="hyderabad"))
    assert result.mode == "deterministic_fallback"
    assert "call failed" in result.provider_status


def test_llm_tool_call_error_recorded_not_crashed(monkeypatch):
    fake = FakeProvider(
        [
            ProviderResponse(tool_uses=[ToolUseBlock(id="t1", name="get_risk", input={"geo_id": "not_a_real_place"})]),
            ProviderResponse(text_blocks=["That geography was not recognized."]),
        ]
    )
    monkeypatch.setattr("backend.ai.orchestrator.get_provider", lambda: fake)
    result = run_query("What is the risk somewhere invalid?", None)
    assert result.tool_trace[0].status == "error"
    assert result.mode == "llm"  # the loop itself didn't crash despite the tool error


def test_llm_decision_brief_falls_back_to_deterministic_sections_on_bad_json(monkeypatch):
    fake = FakeProvider([ProviderResponse(text_blocks=["not valid json at all"])])
    monkeypatch.setattr("backend.ai.orchestrator.get_provider", lambda: fake)
    result = build_decision_brief(ScenarioContext(geo_id="hyderabad"))
    assert result.mode == "llm"
    # narration parse failed -> deterministic sections were used as-is
    assert any(s.title == "EXECUTIVE SITUATION" for s in result.sections)
