"""Section 3.3 — Root-cause triage (AI Assistant tier, single LLM call).

Runs on every case, so it uses the fast/cheap model tier (TRIAGE_MODEL).
Input is the case plus recent synthetic signals (PO status, inbound
delivery status, inventory-vs-system delta flag, transport tracking).
Output is validated against schemas.TriageOutput.
"""

from __future__ import annotations

import json

from pipeline import data_access
from pipeline.llm_client import call_structured
from schemas import ShortageCase, TriageOutput

SYSTEM_PROMPT = (
    "You are a root-cause triage assistant supporting a manufacturing "
    "procurement shortage case at a synthetic academic-prototype value "
    "stream. Given case data and signals, estimate the likelihood "
    "(0.0-1.0, need not sum to 1.0) that each of exactly these four causes "
    "explains the shortage: supplier_capacity, upstream_supply, transport, "
    "demand_deviation. You must include all four causes in ranked_causes, "
    "each exactly once. Base your ranking only on the evidence provided — "
    "this is entirely synthetic data for an academic exercise, do not "
    "invent additional facts."
)


def _gather_signals(case: ShortageCase) -> dict:
    po_list = data_access.get_po_status_for_part(case.part_number)
    inbound = [d for po in po_list if (d := data_access.get_inbound_for_po(po["po_id"]))]
    inv = data_access.get_inventory(case.part_number)
    consumption = data_access.get_consumption_vs_plan(case.part_number)

    return {
        "part_number": case.part_number,
        "supplier_id": case.supplier_id,
        "projected_coverage_hours": case.projected_coverage_hours,
        "lead_time_days": case.lead_time_days,
        "po_status": po_list,
        "inbound_deliveries": inbound,
        "inventory_system_vs_physical_delta_flag": (inv or {}).get("system_vs_physical_delta_flag"),
        "consumption_vs_plan": consumption,
    }


def run_triage(case: ShortageCase, config: dict) -> TriageOutput:
    signals = _gather_signals(case)
    user_prompt = (
        f"Case ID: {case.case_id}\n"
        f"Signals (JSON, all synthetic):\n{json.dumps(signals, default=str)}"
    )

    result = call_structured(
        model_env_var="TRIAGE_MODEL",
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=TriageOutput,
        temperature=config["llm"]["triage_temperature"],
        max_tokens=config["llm"]["max_tokens"],
    )

    if result.case_id != case.case_id:
        result = result.model_copy(update={"case_id": case.case_id})
    return result
