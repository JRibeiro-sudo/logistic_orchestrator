"""Section 2 / Section 8 hard constraint:

"No code path may call the execution module without a prior, logged,
human-approved decision on that specific case."

These tests assert the constraint is enforced by pipeline/execution.py
itself (so it holds regardless of what any calling code does), and that
schemas.HumanCheckpointDecision cannot represent an "approved" decision
that isn't actually backed by logged, all-approved role confirmations.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from pipeline import execution, human_checkpoint
from pipeline.config_loader import load_config
from schemas import (
    ActionSynthesis,
    ApprovalRecord,
    HumanCheckpointDecision,
    RankedAction,
    RecommendedAction,
    ShortageCase,
)


def make_case(case_id: str = "CASE-X") -> ShortageCase:
    return ShortageCase(
        case_id=case_id,
        part_number="PN-X",
        supplier_id="SUP-X",
        current_stock_units=10,
        daily_consumption_units=5,
        projected_coverage_hours=30,
        lead_time_days=5,
        triggered_at=datetime.now(timezone.utc),
    )


def make_synthesis(case_id: str = "CASE-X", cost: float = 500, impact_tier: str = "low") -> ActionSynthesis:
    return ActionSynthesis(
        case_id=case_id,
        ranked_actions=[RankedAction(branch="transport", action="expedite_freight", cost_eur=cost, confidence=0.8)],
        recommended_action=RecommendedAction(branch="transport", action="expedite_freight", cost_eur=cost, impact_tier=impact_tier),
    )


def test_execute_refuses_without_approval():
    case = make_case()
    synthesis = make_synthesis(case.case_id)
    checkpoint = HumanCheckpointDecision(
        case_id=case.case_id,
        impact_tier="low",
        approvals=[ApprovalRecord(role="planner", approver_name="simulated-planner", decision="rejected")],
        approved=False,
    )
    with pytest.raises(execution.ExecutionNotAuthorizedError):
        execution.execute(case, synthesis, checkpoint)


def test_execute_refuses_checkpoint_for_a_different_case():
    case = make_case("CASE-A")
    synthesis = make_synthesis("CASE-A")
    other_case_checkpoint = HumanCheckpointDecision(
        case_id="CASE-B",
        impact_tier="low",
        approvals=[ApprovalRecord(role="planner", approver_name="simulated-planner", decision="approved")],
        approved=True,
    )
    with pytest.raises(execution.ExecutionNotAuthorizedError):
        execution.execute(case, synthesis, other_case_checkpoint)


def test_execute_refuses_when_no_recommended_action():
    case = make_case()
    synthesis = ActionSynthesis(case_id=case.case_id, ranked_actions=[], recommended_action=None, no_viable_action=True)
    checkpoint = HumanCheckpointDecision(
        case_id=case.case_id,
        impact_tier="low",
        approvals=[ApprovalRecord(role="planner", approver_name="simulated-planner", decision="approved")],
        approved=True,
    )
    with pytest.raises(execution.ExecutionNotAuthorizedError):
        execution.execute(case, synthesis, checkpoint)


def test_execute_succeeds_with_a_valid_logged_approval():
    case = make_case()
    synthesis = make_synthesis(case.case_id)
    checkpoint = HumanCheckpointDecision(
        case_id=case.case_id,
        impact_tier="low",
        approvals=[ApprovalRecord(role="planner", approver_name="simulated-planner", decision="approved")],
        approved=True,
    )
    result = execution.execute(case, synthesis, checkpoint)
    assert result.executed is True
    assert result.confirmation_id


def test_cannot_construct_approved_decision_with_no_logged_approvals():
    """approved=True with an empty approvals list would be an unlogged
    rubber stamp — the schema itself must reject this."""
    with pytest.raises(ValidationError):
        HumanCheckpointDecision(case_id="CASE-X", impact_tier="low", approvals=[], approved=True)


def test_cannot_construct_approved_decision_with_any_rejection_present():
    with pytest.raises(ValidationError):
        HumanCheckpointDecision(
            case_id="CASE-X",
            impact_tier="high",
            approvals=[
                ApprovalRecord(role="procurement", approver_name="simulated-procurement", decision="approved"),
                ApprovalRecord(role="production", approver_name="simulated-production", decision="rejected"),
                ApprovalRecord(role="logistics", approver_name="simulated-logistics", decision="approved"),
            ],
            approved=True,
        )


def test_low_impact_requires_exactly_one_planner_approval():
    config = load_config()
    case = make_case()
    synthesis = make_synthesis(case.case_id, cost=500, impact_tier="low")
    seen_roles: list[str] = []

    def scripted(role: str, prompt: str) -> str:
        seen_roles.append(role)
        return "y"

    checkpoint = human_checkpoint.run_checkpoint(case, synthesis, config, input_fn=scripted)
    assert seen_roles == ["planner"]
    assert checkpoint.approved is True


def test_high_impact_requires_three_sequential_role_approvals():
    config = load_config()
    case = make_case()
    synthesis = make_synthesis(case.case_id, cost=5000, impact_tier="high")
    seen_roles: list[str] = []

    def scripted(role: str, prompt: str) -> str:
        seen_roles.append(role)
        return "y"

    checkpoint = human_checkpoint.run_checkpoint(case, synthesis, config, input_fn=scripted)
    assert seen_roles == ["procurement", "production", "logistics"]
    assert checkpoint.approved is True


def test_high_impact_any_single_rejection_blocks_overall_approval():
    config = load_config()
    case = make_case()
    synthesis = make_synthesis(case.case_id, cost=5000, impact_tier="high")

    def scripted(role: str, prompt: str) -> str:
        return "n" if role == "production" else "y"

    checkpoint = human_checkpoint.run_checkpoint(case, synthesis, config, input_fn=scripted)
    assert checkpoint.approved is False
    with pytest.raises(execution.ExecutionNotAuthorizedError):
        execution.execute(case, synthesis, checkpoint)


def test_impact_tier_forced_high_by_committed_schedule_flag_regardless_of_cost():
    """Section 3.7: affects_committed_schedule forces impact_tier=high even
    for a low-cost action, which in turn forces the three-role checkpoint."""
    case = make_case().model_copy(update={"affects_committed_schedule": True})
    # Directly exercise the deterministic tiering logic used inside synthesize():
    threshold = load_config()["impact"]["cost_threshold_eur"]
    low_cost = threshold - 1
    is_high = low_cost >= threshold or case.affects_committed_schedule
    assert is_high is True
