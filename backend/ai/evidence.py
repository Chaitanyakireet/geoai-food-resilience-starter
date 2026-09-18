"""Deterministic evidence retrieval (EvidenceQuery -> EvidenceResult).

This is keyword-overlap matching over backend/ai/corpus.py's documents --
not a semantic/embedding search and not an external literature search. It
is deterministic and reproducible, and it never returns a fabricated or
loosely-related match dressed up as a hit: a query with no term overlap
against any corpus document returns `found=False` with zero matches.
"""
from __future__ import annotations

import re

from backend.ai.contracts import EvidenceItem, EvidenceQuery, EvidenceResult
from backend.ai.corpus import EvidenceDocument, build_evidence_corpus

STOPWORDS = {
    "the", "is", "are", "a", "an", "of", "to", "in", "for", "and", "or", "what",
    "how", "why", "this", "that", "does", "do", "on", "at", "by", "with", "was",
    "were", "be", "it", "its", "as", "from", "which", "when", "will", "can",
    "should", "would", "could", "about", "into", "than", "then", "there",
}

# The corpus is rebuilt from other modules' provenance/config, all of which
# are deterministic per-process; caching avoids re-reading/re-parsing
# docs/MASTER_HANDOFF.md and every provenance module on every query.
_CORPUS_CACHE: list[EvidenceDocument] | None = None


def _get_corpus() -> list[EvidenceDocument]:
    global _CORPUS_CACHE
    if _CORPUS_CACHE is None:
        _CORPUS_CACHE = build_evidence_corpus()
    return _CORPUS_CACHE


def _tokenize(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9_]+", text.lower()) if len(w) >= 3 and w not in STOPWORDS}


def retrieve_evidence(query: EvidenceQuery) -> EvidenceResult:
    corpus = _get_corpus()
    q_terms = _tokenize(query.query)

    scored: list[tuple[float, EvidenceDocument, set[str]]] = []
    for doc in corpus:
        doc_terms = _tokenize(f"{doc.source_name} {doc.text}")
        overlap = q_terms & doc_terms
        score: float = len(overlap)
        if query.geo_id and query.geo_id.replace("_", " ") in doc.text.lower():
            score += 1
        if score > 0:
            scored.append((score, doc, overlap))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[: max(query.top_k, 0)]

    matches = [
        EvidenceItem(
            provenance_id=doc.provenance_id,
            source_name=doc.source_name,
            source_url=doc.source_url,
            access_date=doc.access_date,
            truth_status=doc.truth_status,
            excerpt=doc.text[:400],
            relevance_score=round(score / max(len(q_terms), 1), 3),
            matched_terms=sorted(overlap),
        )
        for score, doc, overlap in top
    ]

    limitations = [
        "Retrieval is deterministic keyword-overlap matching over the project's own provenance/config/methodology "
        "documents, not a semantic/embedding search and not an external literature search.",
    ]
    if not matches:
        limitations.append(
            "No corpus document shared a matching term with this query -- returning no evidence rather than a "
            "fabricated or loosely related match."
        )

    return EvidenceResult(query=query.query, matches=matches, found=len(matches) > 0, limitations=limitations)
