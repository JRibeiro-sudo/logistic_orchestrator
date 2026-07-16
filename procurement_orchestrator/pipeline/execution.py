"""Section 3.9 — Execution (deterministic, no AI).

HARD CONSTRAINT (Section 2 / Section 8): no code path may call this module's
execute() without a prior, logged, human-approved decision on that specific
case. execute() enforces this directly — it raises ExecutionNotAuthorizedError
if checkpoint.approved is not True or the checkpoint's case_id doesn't match.
This is asserted by tests/test_hard_constraint.py.
"""

from __future__ import annotations

import logging
import uuid

from schemas import ActionSynthesis, ExecutionResult, HumanCheckpointDecision, ShortageCase

logger = logging.getLogger("execution")


class ExecutionNotAuthorizedError(RuntimeError):
    """Raised when execute() is invoked without a matching, approved human checkpoint decision."""


def mock_send_sap_update(case_id: str, action_type: str, details: dict) -> dict:
    return {
        "confirmation_id": f"SAP-CONF-{uuid.uuid4().hex[:8]}",
        "case_id": case_id,
        "action_type": action_type,
        "status": "sap_updated",
        "details": details,
    }


def mock_book_freight(case_id: str, action_type: str, details: dict) -> dict:
    return {
        "confirmation_id": f"FRT-CONF-{uuid.uuid4().hex[:8]}",
        "case_id": case_id,
        "action_type": action_type,
        "status": "freight_booked",
        "details": details,
    }


def mock_issue_spot_buy(case_id: str, action_type: str, details: dict) -> dict:
    return {
        "confirmation_id": f"SPT-CONF-{uuid.uuid4().hex[:8]}",
        "case_id": case_id,
        "action_type": action_type,
        "status": "spot_buy_issued",
        "details": details,
    }


def mock_request_capacity(case_id: str, action_type: str, details: dict) -> dict:
    return {
        "confirmation_id": f"CAP-CONF-{uuid.uuid4().hex[:8]}",
        "case_id": case_id,
        "action_type": action_type,
        "status": "capacity_requested",
        "details": details,
    }


def mock_reallocate_plan(case_id: str, action_type: str, details: dict) -> dict:
    return {
        "confirmation_id": f"PLN-CONF-{uuid.uuid4().hex[:8]}",
        "case_id": case_id,
        "action_type": action_type,
        "status": "plan_reallocated",
        "details": details,
    }


_ACTION_EXECUTORS = {
    "expedite_freight": mock_book_freight,
    "spot_buy": mock_issue_spot_buy,
    "capacity_request": mock_request_capacity,
    "reallocate_plan": mock_reallocate_plan,
}


def execute(
    case: ShortageCase,
    synthesis: ActionSynthesis,
    checkpoint: HumanCheckpointDecision,
) -> ExecutionResult:
    if checkpoint.case_id != case.case_id:
        raise ExecutionNotAuthorizedError(
            f"Checkpoint case_id {checkpoint.case_id!r} does not match case {case.case_id!r}."
        )
    if not checkpoint.approved:
        raise ExecutionNotAuthorizedError(
            f"Case {case.case_id}: human checkpoint was not approved "
            f"(impact_tier={checkpoint.impact_tier}). Execution refused."
        )
    if synthesis.case_id != case.case_id:
        raise ExecutionNotAuthorizedError(
            f"Synthesis case_id {synthesis.case_id!r} does not match case {case.case_id!r}."
        )
    if synthesis.recommended_action is None:
        raise ExecutionNotAuthorizedError(f"Case {case.case_id}: no recommended_action to execute.")

    action = synthesis.recommended_action
    if action.action == "none":
        raise ExecutionNotAuthorizedError(f"Case {case.case_id}: recommended action type is 'none'.")

    executor = _ACTION_EXECUTORS.get(action.action)
    if executor is None:
        raise ValueError(f"No mocked executor registered for action type {action.action!r}")

    details = {"branch": action.branch, "cost_eur": action.cost_eur}
    mock_send_sap_update(case.case_id, action.action, details)
    action_result = executor(case.case_id, action.action, details)

    logger.info(
        "case=%s action=%s EXECUTED confirmation=%s",
        case.case_id,
        action.action,
        action_result["confirmation_id"],
    )

    return ExecutionResult(
        case_id=case.case_id,
        action_type=action.action,
        executed=True,
        confirmation_id=action_result["confirmation_id"],
    )
