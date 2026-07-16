"""Section 3.1 — Trigger (deterministic, no AI).

Scans synthetic MRP/planning data and fires a ShortageCase whenever
projected material coverage falls below the applicable coverage horizon
(the horizon itself is computed by lead_time_routing.py per Section 3.2).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pipeline import data_access
from pipeline.lead_time_routing import evaluate as evaluate_horizon
from schemas import CoverageHorizonDecision, ShortageCase


def _new_case_id() -> str:
    return f"CASE-{uuid.uuid4().hex[:10].upper()}"


def projected_coverage_hours(current_stock_units: float, daily_consumption_units: float) -> float:
    if daily_consumption_units <= 0:
        return float("inf")
    return (current_stock_units / daily_consumption_units) * 24.0


def check_part(part_number: str, config: dict) -> tuple[ShortageCase, CoverageHorizonDecision] | None:
    """Evaluates a single part. Returns (ShortageCase, CoverageHorizonDecision)
    if the trigger fires, otherwise None."""
    part = data_access.get_part(part_number)
    inv = data_access.get_inventory(part_number)
    if part is None or inv is None:
        return None

    supplier = data_access.get_supplier(part["supplier_id"])
    if supplier is None:
        return None

    coverage_hours = projected_coverage_hours(inv["current_stock_units"], inv["daily_consumption_units"])
    case_id = _new_case_id()
    horizon_decision = evaluate_horizon(case_id, supplier["lead_time_days"], coverage_hours, config)

    if not horizon_decision.fired:
        return None

    shortage_case = ShortageCase(
        case_id=case_id,
        part_number=part_number,
        supplier_id=supplier["supplier_id"],
        current_stock_units=inv["current_stock_units"],
        daily_consumption_units=inv["daily_consumption_units"],
        projected_coverage_hours=coverage_hours,
        lead_time_days=supplier["lead_time_days"],
        triggered_at=datetime.now(timezone.utc),
    )
    return shortage_case, horizon_decision


def scan_all_parts(config: dict) -> list[tuple[ShortageCase, CoverageHorizonDecision]]:
    fired = []
    for part in data_access.parts():
        result = check_part(part["part_number"], config)
        if result is not None:
            fired.append(result)
    return fired
