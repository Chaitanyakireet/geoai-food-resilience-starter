"""GET /ai/provenance -- describes the AI layer's own methodology and
sources, matching the pattern of every other module's provenance endpoint.
No secrets (API keys) are ever included here."""
from __future__ import annotations

from backend.ai.corpus import build_evidence_corpus
from backend.ai.provider import get_provider
from backend.ai.tools import TOOL_REGISTRY


def build_ai_provenance() -> dict:
    provider = get_provider()
    corpus = build_evidence_corpus()

    return {
        "nature": (
            "This layer is explanation + evidence + orchestration only. It computes no new numeric results: "
            "every tool call composes an existing, separately-provenanced deterministic engine (backend/risk, "
            "backend/geoai, backend/graph, backend/intervention, backend/optimization, backend/twin). The LLM "
            "(when configured) narrates and selects tools over those results; it never invents a number, "
            "overrides a backend output, or fabricates a citation."
        ),
        "provider": {
            "name": provider.name,
            "configured": provider.is_configured(),
            "note": "Provider identity/configuration status only -- no API key or secret is ever exposed here or anywhere else in a response.",
        },
        "approved_tools": sorted(TOOL_REGISTRY.keys()),
        "evidence_corpus": {
            "document_count": len(corpus),
            "method": "Deterministic keyword-overlap retrieval (backend/ai/evidence.py) over this corpus -- not semantic/embedding search, not an external literature search.",
            "sources_by_module": sorted({tag for doc in corpus for tag in doc.tags}),
        },
        "truth_status_discipline": [
            "OBSERVED and DERIVED values are only ever copied from an upstream module's own provenance-labeled output.",
            "ESTIMATED covers assumed/illustrative configuration (weights, thresholds, effectiveness defaults) surfaced via retrieve_evidence.",
            "COUNTERFACTUAL and SIMULATED cover shock/intervention/optimization/twin scenario outputs -- never presented as observed or measured.",
        ],
        "limitations": [
            "This module was added in Hours 39-42; it has not been independently red-teamed for prompt-injection "
            "resistance beyond the structural guardrail that tool results are always Python-computed ground truth.",
            "The evidence corpus is limited to this project's own provenance/config/methodology documents -- it "
            "is not a general web or literature search.",
            "When no LLM provider is configured, all answers/briefs are deterministic template compositions, "
            "clearly labeled as such rather than AI-generated prose.",
        ],
    }
