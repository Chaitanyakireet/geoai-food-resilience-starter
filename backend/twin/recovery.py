"""Deterministic recovery trajectory + metrics. See config/twin.yaml: the
recovery_rate is an ASSUMED daily closure fraction, not fit to any observed
Telangana recovery event -- there is no such historical dataset this sprint.
"""
from __future__ import annotations

from backend.twin.contracts import RecoveryMetrics, RecoveryPoint, RecoveryTrajectory

METHOD_DESCRIPTION = (
    "Deterministic exponential decay: demand_impact_fraction(day) = initial_impact * (1 - recovery_rate)^day; "
    "resilience_score(day) recovers toward the pre-shock baseline resilience by the same decay factor. "
    "recovery_rate is an ASSUMED, documented daily closure fraction (config/twin.yaml), not fit to any "
    "observed Telangana recovery event."
)


def simulate_recovery(
    starting_label: str,
    initial_impact: float,
    initial_resilience: float,
    pre_shock_resilience: float,
    target_resilience_score: float,
    horizon_days: int,
    recovery_rate: float,
    recovery_rate_source: str,
    timestep_days: int,
) -> RecoveryTrajectory:
    days = list(range(0, horizon_days + 1, timestep_days))
    if days[-1] != horizon_days:
        days.append(horizon_days)

    points: list[RecoveryPoint] = []
    for day in days:
        decay = (1 - recovery_rate) ** day
        impact = round(initial_impact * decay, 4)
        resilience = round(pre_shock_resilience - (pre_shock_resilience - initial_resilience) * decay, 4)
        gap = round(target_resilience_score - resilience, 4)
        points.append(
            RecoveryPoint(day=day, demand_impact_fraction=impact, resilience_score=resilience, resilience_gap=gap)
        )

    return RecoveryTrajectory(
        starting_label=starting_label,
        points=points,
        recovery_rate_used=recovery_rate,
        recovery_rate_source=recovery_rate_source,
        timestep_days=timestep_days,
        horizon_days=horizon_days,
        method=METHOD_DESCRIPTION,
        limitations=[
            "This is a simplified, non-validated recovery mechanism for scenario exploration -- it does not "
            "model real logistics, seasonal effects, secondary shocks, or nonlinear recovery dynamics.",
            f"recovery_rate={recovery_rate} is "
            + (
                "an ESTIMATED illustrative default (config/twin.yaml)"
                if recovery_rate_source == "config_default"
                else "an ESTIMATED user-supplied override"
            )
            + ", not a calibrated or historically validated rate.",
        ],
    )


def compute_recovery_metrics(trajectory: RecoveryTrajectory, recovery_threshold: float) -> RecoveryMetrics:
    impacts = [p.demand_impact_fraction for p in trajectory.points]
    peak = max(impacts) if impacts else 0.0
    final = impacts[-1] if impacts else 0.0

    recovery_time_days = None
    for p in trajectory.points:
        if p.demand_impact_fraction <= recovery_threshold:
            recovery_time_days = p.day
            break

    recovery_fraction = round(1 - (final / peak), 4) if peak > 0 else 1.0

    return RecoveryMetrics(
        peak_disruption=round(peak, 4),
        final_disruption=round(final, 4),
        recovery_time_days=recovery_time_days,
        recovery_fraction=recovery_fraction,
        resilience_gap_before=trajectory.points[0].resilience_gap,
        resilience_gap_after=trajectory.points[-1].resilience_gap,
        residual_impact=round(final, 4),
        definitions={
            "peak_disruption": "Maximum modeled demand-node impact_fraction observed across the simulated "
            "trajectory (day 0 in this monotonic-decay model).",
            "final_disruption": "Modeled demand-node impact_fraction at the end of the simulated horizon.",
            "recovery_time_days": f"First simulated day at which impact_fraction falls to or below the "
            f"configured recovery_threshold ({recovery_threshold}); null if never reached within the horizon.",
            "recovery_fraction": "Fraction of peak disruption resolved by the end of the horizon: "
            "1 - (final_disruption / peak_disruption).",
            "resilience_gap_before": "target_resilience_score minus resilience_score at day 0 of this trajectory.",
            "resilience_gap_after": "target_resilience_score minus resilience_score at the end of the horizon.",
            "residual_impact": "Same as final_disruption -- the modeled impact remaining unresolved at the end "
            "of the simulated horizon.",
        },
    )
