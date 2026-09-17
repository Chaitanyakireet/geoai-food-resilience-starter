"""Run the risk baseline validation diagnostics and write the report served
at GET /risk/validation-report. See backend/risk/validation.py for what each
check does and, importantly, does not claim.

Re-run with: .venv\\Scripts\\python scripts\\validate_risk_baseline.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.risk.validation import leakage_check, spatial_smoothness_check, temporal_spot_check  # noqa: E402

# Geographically spread sample to keep the extra NASA POWER calls small
# (this diagnostic makes 2 additional API calls per district).
TEMPORAL_SAMPLE_DISTRICTS = ["hyderabad", "adilabad", "khammam", "nizamabad", "mahabubnagar"]


def main() -> None:
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "spatial_smoothness": spatial_smoothness_check(),
        "temporal_spot_check": temporal_spot_check(TEMPORAL_SAMPLE_DISTRICTS),
        "leakage_check": leakage_check(),
        "scope_note": (
            "No classical ML validation (temporal/spatial holdout accuracy, cross-validation) is "
            "reported because no labeled food-system-disruption outcome dataset exists to validate "
            "against. These are sanity diagnostics over a deterministic formula, not accuracy metrics."
        ),
    }
    out_path = REPO_ROOT / "data" / "processed" / "risk_validation_report.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    print(f"Spatial: mean_abs_neighbor_diff={report['spatial_smoothness']['mean_abs_neighbor_diff']}")
    print(f"Leakage check passed: {report['leakage_check']['passed']}")


if __name__ == "__main__":
    main()
