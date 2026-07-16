"""Section 3.4 — Orchestrator (deterministic dispatch logic, no AI).

Reads triage output and dispatches to every cause above the configurable
likelihood threshold. Logs which branches were dispatched and why, for
auditability.
"""

from __future__ import annotations

import logging

from schemas import DispatchDecision, DispatchedBranch, TriageOutput

logger = logging.getLogger("orchestrator")


def dispatch(triage: TriageOutput, config: dict) -> DispatchDecision:
    threshold = config["dispatch"]["likelihood_threshold"]
    branches: list[DispatchedBranch] = []

    for ranked_cause in triage.ranked_causes:
        is_dispatched = ranked_cause.likelihood >= threshold
        branches.append(
            DispatchedBranch(
                branch=ranked_cause.cause,
                likelihood=ranked_cause.likelihood,
                dispatched=is_dispatched,
            )
        )
        logger.info(
            "case=%s branch=%s likelihood=%.2f threshold=%.2f dispatched=%s",
            triage.case_id,
            ranked_cause.cause,
            ranked_cause.likelihood,
            threshold,
            is_dispatched,
        )

    return DispatchDecision(case_id=triage.case_id, threshold=threshold, branches=branches)


def dispatched_branch_names(decision: DispatchDecision) -> list[str]:
    return [b.branch for b in decision.branches if b.dispatched]
