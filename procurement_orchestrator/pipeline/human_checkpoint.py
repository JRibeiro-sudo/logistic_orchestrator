"""Section 3.8 — Human checkpoint (CLI-simulated, mandatory, tiered).

low impact_tier   -> one simulated "planner" approval (single CLI prompt).
high impact_tier  -> simulated cross-functional approval: three sequential
                      CLI prompts (procurement, production, logistics).

No path may skip this step, and every decision, approver role, and
timestamp is logged into the returned HumanCheckpointDecision.

`input_fn` is injectable so demo scenarios and tests can drive this
deterministically without a real terminal; main.py's interactive CLI path
uses the default, which calls Python's builtin input().
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timezone

from schemas import ActionSynthesis, ApprovalRecord, HumanCheckpointDecision, ShortageCase

logger = logging.getLogger("human_checkpoint")

ApproverInputFn = Callable[[str, str], str]

LOW_TIER_ROLES = ["planner"]
HIGH_TIER_ROLES = ["procurement", "production", "logistics"]


def _default_input(role: str, prompt_text: str) -> str:
    return input(prompt_text)


def run_checkpoint(
    case: ShortageCase,
    synthesis: ActionSynthesis,
    config: dict,
    input_fn: ApproverInputFn = _default_input,
) -> HumanCheckpointDecision:
    if synthesis.recommended_action is None:
        raise ValueError(
            f"Case {case.case_id}: run_checkpoint requires synthesis.recommended_action to be set."
        )

    impact_tier = synthesis.recommended_action.impact_tier
    roles = LOW_TIER_ROLES if impact_tier == "low" else HIGH_TIER_ROLES

    approvals: list[ApprovalRecord] = []
    for role in roles:
        prompt_text = (
            f"[HUMAN CHECKPOINT] Case {case.case_id} — role '{role}' approval required.\n"
            f"  Recommended action: {synthesis.recommended_action.action} "
            f"(branch={synthesis.recommended_action.branch}, "
            f"cost_eur={synthesis.recommended_action.cost_eur:.2f}, "
            f"impact_tier={impact_tier})\n"
            f"  Approve? [y/n]: "
        )
        raw = input_fn(role, prompt_text).strip().lower()
        decision = "approved" if raw in ("y", "yes") else "rejected"
        record = ApprovalRecord(
            role=role,
            approver_name=f"simulated-{role}",
            decision=decision,
            timestamp=datetime.now(timezone.utc),
        )
        approvals.append(record)
        logger.info(
            "case=%s role=%s decision=%s timestamp=%s",
            case.case_id,
            role,
            decision,
            record.timestamp.isoformat(),
        )

    approved = bool(approvals) and all(a.decision == "approved" for a in approvals)
    decision = HumanCheckpointDecision(
        case_id=case.case_id,
        impact_tier=impact_tier,
        approvals=approvals,
        approved=approved,
    )
    logger.info("case=%s impact_tier=%s FINAL_DECISION=%s", case.case_id, impact_tier, "APPROVED" if approved else "REJECTED")
    return decision
