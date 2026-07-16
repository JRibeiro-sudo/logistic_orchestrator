"""Section 3.2 — Lead-time band routing (deterministic, no AI).

Config-driven rule table: short lead-time parts get a flat coverage horizon;
long lead-time parts get a horizon that scales with lead time. Nothing here
is hardcoded per part — every threshold comes from config.yaml.
"""

from __future__ import annotations

from schemas import CoverageHorizonDecision


def compute_coverage_horizon(lead_time_days: float, config: dict) -> tuple[float, str]:
    """Returns (coverage_horizon_hours, band)."""
    horizon_cfg = config["coverage_horizon"]
    short_max_days = horizon_cfg["short_lead_time_max_days"]

    if lead_time_days <= short_max_days:
        return float(horizon_cfg["short_band_horizon_hours"]), "short"

    multiplier = horizon_cfg["long_band_multiplier"]
    horizon_hours = lead_time_days * 24 * multiplier
    return float(horizon_hours), "long"


def evaluate(
    case_id: str,
    lead_time_days: float,
    projected_coverage_hours: float,
    config: dict,
) -> CoverageHorizonDecision:
    horizon_hours, band = compute_coverage_horizon(lead_time_days, config)
    fired = projected_coverage_hours < horizon_hours
    return CoverageHorizonDecision(
        case_id=case_id,
        lead_time_days=lead_time_days,
        band=band,
        coverage_horizon_hours=horizon_hours,
        projected_coverage_hours=projected_coverage_hours,
        fired=fired,
    )
