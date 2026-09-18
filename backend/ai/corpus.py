"""Builds the evidence corpus the RAG layer retrieves over.

Every document here is either a direct read of an existing provenance/config
module (already the authoritative source for that data) or a chunk of
docs/MASTER_HANDOFF.md (the project's own locked specification). Nothing is
invented here -- this module only reformats what backend/geoai, backend/risk,
backend/graph, backend/intervention, backend/optimization, and backend/twin
already expose via their own provenance endpoints.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]

REPO_ROOT = Path(__file__).resolve().parents[2]
MASTER_HANDOFF_PATH = REPO_ROOT / "docs" / "MASTER_HANDOFF.md"


@dataclass
class EvidenceDocument:
    provenance_id: str
    source_name: str
    text: str
    truth_status: TruthStatus
    source_url: Optional[str] = None
    access_date: Optional[str] = None
    tags: list[str] = field(default_factory=list)


def _dataset_documents(provenance: dict, module_prefix: str) -> list[EvidenceDocument]:
    docs: list[EvidenceDocument] = []
    for i, ds in enumerate(provenance.get("datasets", [])):
        text = f"{ds.get('processing', '')} {ds.get('limitations', '')}".strip()
        docs.append(
            EvidenceDocument(
                provenance_id=f"{module_prefix}.dataset.{i}",
                source_name=ds["dataset_name"],
                text=text,
                truth_status=ds.get("truth_status", "DERIVED"),
                source_url=ds.get("source_url") if ds.get("source_url", "").startswith("http") else None,
                access_date=ds.get("access_date"),
                tags=[module_prefix],
            )
        )
    return docs


def _config_disclosure_document(module_prefix: str, source_name: str, provenance: dict) -> EvidenceDocument:
    parts = [provenance.get("nature", "")]
    parts.extend(provenance.get("assumption_disclosure", []))
    return EvidenceDocument(
        provenance_id=f"{module_prefix}.disclosure",
        source_name=source_name,
        text=" ".join(p for p in parts if p),
        truth_status="ESTIMATED",
        tags=[module_prefix, "methodology", "assumptions"],
    )


def _master_handoff_documents() -> list[EvidenceDocument]:
    if not MASTER_HANDOFF_PATH.exists():
        return []
    text = MASTER_HANDOFF_PATH.read_text(encoding="utf-8")
    sections = text.split("\n## ")
    docs: list[EvidenceDocument] = []
    for i, section in enumerate(sections):
        section = section.strip()
        if not section:
            continue
        heading = section.split("\n", 1)[0].lstrip("# ").strip()
        body = section.split("\n", 1)[1] if "\n" in section else ""
        docs.append(
            EvidenceDocument(
                provenance_id=f"master_handoff.section.{i}",
                source_name=f"Project methodology: {heading}",
                text=body.strip() or heading,
                truth_status="DERIVED",
                source_url=None,
                tags=["methodology", "project_locks"],
            )
        )
    return docs


def build_evidence_corpus() -> list[EvidenceDocument]:
    docs: list[EvidenceDocument] = []

    try:
        from backend.geoai.provenance import load_provenance

        docs.extend(_dataset_documents(load_provenance(), "gis"))
    except Exception:
        pass

    try:
        from backend.risk.provenance import load_climate_provenance

        docs.extend(_dataset_documents(load_climate_provenance(), "risk"))
    except Exception:
        pass

    try:
        from backend.risk.features import load_features_config

        cfg = load_features_config()
        model = cfg.get("risk_model", {})
        docs.append(
            EvidenceDocument(
                provenance_id="risk.methodology",
                source_name="Risk baseline methodology (config/features.yaml)",
                text=(
                    f"Model version {model.get('model_version', 'n/a')}. Weights: {model.get('weights', {})}. "
                    f"Thresholds: {model.get('thresholds', {})}. Risk class bins: {model.get('risk_class_bins', {})}. "
                    "These are documented calibration choices, not fit to labeled outcome data -- no historical "
                    "food-system-disruption dataset exists for Telangana this sprint."
                ),
                truth_status="ESTIMATED",
                tags=["risk", "methodology"],
            )
        )
    except Exception:
        pass

    try:
        from backend.graph.graph_builder import load_food_graph_provenance

        docs.extend(_dataset_documents(load_food_graph_provenance(), "graph"))
    except Exception:
        pass

    try:
        from backend.intervention.provenance import build_intervention_provenance

        prov = build_intervention_provenance()
        docs.append(_config_disclosure_document("intervention", "Intervention engine methodology", prov))
        for key, t in prov.get("intervention_type_catalog", {}).items():
            docs.append(
                EvidenceDocument(
                    provenance_id=f"intervention.catalog.{key}",
                    source_name=f"Intervention type: {t['label']}",
                    text=f"{t['mechanism']} Default effectiveness (ESTIMATED, illustrative): {t['default_effectiveness']}. Applicable shock types: {', '.join(t['applicable_shock_types'])}.",
                    truth_status="ESTIMATED",
                    tags=["intervention", "catalog"],
                )
            )
    except Exception:
        pass

    try:
        from backend.optimization.provenance import build_optimization_provenance

        docs.append(_config_disclosure_document("optimization", "Multi-objective optimizer methodology", build_optimization_provenance()))
    except Exception:
        pass

    try:
        from backend.twin.provenance import build_twin_provenance

        docs.append(_config_disclosure_document("twin", "Digital Twin + recovery methodology", build_twin_provenance()))
    except Exception:
        pass

    docs.extend(_master_handoff_documents())

    return docs
