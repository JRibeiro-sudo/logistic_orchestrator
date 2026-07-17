"""Tests for the escalation extension (pipeline/synthesis.py::check_escalation).

When the automated pipeline cannot converge on a trustworthy recommended
action — either because no branch confirmed a root cause, or because the
action guardrail blocked every confirmed action — the case must be flagged
for manual investigation rather than silently closed. This is a
deterministic check, no AI call, and no API key is required to run these.
"""

from __future__ import annotations

from schemas import ActionSynthesis, RankedAction, RecommendedAction, SpecialistDiagnosis
from pipeline.synthesis import check_escalation


def make_diagnosis(branch="supplier_capacity", confirmed=True):
    return SpecialistDiagnosis(
        case_id="CASE-X",
        branch=branch,
        diagnosis={"confirmed": confirmed, "confidence": 0.7, "explanation": "x"},
        proposed_action={
            "type": "spot_buy" if confirmed else "none",
            "description": "d",
            "estimated_cost_eur": 1000 if confirmed else 0,
            "estimated_recovery_days": 2 if confirmed else 0,
        },
    )


def test_no_escalation_when_viable_action_exists():
    synthesis = ActionSynthesis(
        case_id="CASE-X",
        ranked_actions=[RankedAction(branch="transport", action="expedite_freight", cost_eur=400, confidence=0.8)],
        recommended_action=RecommendedAction(branch="transport", action="expedite_freight", cost_eur=400, impact_tier="low"),
        no_viable_action=False,
    )
    escalated, reason = check_escalation([make_diagnosis()], synthesis)
    assert escalated is False
    assert reason is None


def test_escalates_with_guardrail_reason_when_confirmed_actions_were_all_blocked():
    synthesis = ActionSynthesis(case_id="CASE-X", ranked_actions=[], recommended_action=None, no_viable_action=True)
    confirmed = [make_diagnosis("supplier_capacity"), make_diagnosis("upstream_supply")]
    escalated, reason = check_escalation(confirmed, synthesis)
    assert escalated is True
    assert "guardrail" in reason.lower()
    assert "manual" in reason.lower()


def test_escalates_with_no_confirmation_reason_when_nothing_was_confirmed():
    synthesis = ActionSynthesis(case_id="CASE-X", ranked_actions=[], recommended_action=None, no_viable_action=True)
    escalated, reason = check_escalation([], synthesis)
    assert escalated is True
    assert "no specialist branch confirmed" in reason.lower()
    assert "manual" in reason.lower()


def test_case_record_defaults_to_not_escalated():
    from schemas import CaseRecord, ShortageCase, CoverageHorizonDecision
    from datetime import datetime, timezone

    sc = ShortageCase(
        case_id="CASE-X", part_number="PN-X", supplier_id="SUP-X",
        current_stock_units=10, daily_consumption_units=5,
        projected_coverage_hours=30, lead_time_days=5, triggered_at=datetime.now(timezone.utc),
    )
    ch = CoverageHorizonDecision(case_id="CASE-X", lead_time_days=5, band="short", coverage_horizon_hours=48, projected_coverage_hours=30, fired=True)
    record = CaseRecord(case_id="CASE-X", shortage_case=sc, coverage_horizon=ch)
    assert record.escalated_to_manual_review is False
    assert record.escalation_reason is None
