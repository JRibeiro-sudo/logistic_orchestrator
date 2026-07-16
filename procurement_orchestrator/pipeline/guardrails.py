"""Section 3.5b (evidence guardrail) and Section 3.6 (action guardrail).

Evidence guardrail: lightweight, deterministic template/content check run
before any outbound mocked "send" (supplier email, internal stakeholder
contact). No LLM call — this is a fixed exclusion-list check plus an
other-supplier-name check, both sourced from config.yaml / supplier master.

Action guardrail: reasoning-tier, low-temperature, structured-output check
run over all confirmed proposed actions for a case before synthesis.
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel

from pipeline import data_access
from pipeline.llm_client import call_structured
from schemas import (
    ActionGuardrailResult,
    Cause,
    EvidenceGuardrailResult,
    ShortageCase,
    SpecialistDiagnosis,
)

logger = logging.getLogger("guardrails")


class ActionGuardrailBatch(BaseModel):
    results: list[ActionGuardrailResult]


# --------------------------------------------------------------------------
# 3.5b Evidence guardrail (deterministic — outbound branches only)
# --------------------------------------------------------------------------
def evidence_guardrail(
    case: ShortageCase,
    branch: Cause,
    tool: str,
    rendered_message: str,
    config: dict,
) -> EvidenceGuardrailResult:
    forbidden_terms: list[str] = config["evidence_guardrail"]["forbidden_terms"]
    lowered = rendered_message.lower()

    violations = [term for term in forbidden_terms if term.lower() in lowered]

    other_suppliers = [
        s["name"] for s in data_access.suppliers() if s["supplier_id"] != case.supplier_id
    ]
    for name in other_suppliers:
        if name.lower() in lowered:
            violations.append(f"other-supplier-reference:{name}")

    passed = len(violations) == 0
    result = EvidenceGuardrailResult(
        case_id=case.case_id,
        branch=branch,
        tool=tool,
        passed=passed,
        violated_terms=violations,
        rendered_message=rendered_message,
    )

    if passed:
        logger.info("case=%s branch=%s tool=%s evidence_guardrail=PASSED", case.case_id, branch, tool)
    else:
        logger.warning(
            "case=%s branch=%s tool=%s evidence_guardrail=REJECTED violated_terms=%s — send blocked",
            case.case_id,
            branch,
            tool,
            violations,
        )
    return result


# --------------------------------------------------------------------------
# 3.6 Action guardrail (reasoning tier, low temperature)
# --------------------------------------------------------------------------
ACTION_GUARDRAIL_SYSTEM_PROMPT = (
    "You are the action guardrail for a synthetic academic-prototype "
    "procurement recovery workflow. You review ALL confirmed proposed "
    "actions for one shortage case together. For EACH action, decide "
    "whether it must be blocked (guardrail_triggered=true) because: "
    "(1) it commits spend or a promise beyond what the evidence supports; "
    "(2) it is missing a cost estimate or the cost estimate is not a "
    "plausible positive number; or (3) it contradicts another proposed "
    "action for the same case (e.g. two branches propose incompatible "
    "actions) without that contradiction being flagged. If triggered, you "
    "MUST give a concrete reason. Be conservative: only trigger when there "
    "is a real, specific problem with that action."
)


def run_action_guardrail(
    case: ShortageCase,
    confirmed_diagnoses: list[SpecialistDiagnosis],
    config: dict,
) -> list[ActionGuardrailResult]:
    """Runs the action guardrail once per confirmed proposed action,
    with full visibility into all other confirmed actions for the same
    case so contradictions can be detected."""
    if not confirmed_diagnoses:
        return []

    all_actions_payload = [
        {
            "branch": d.branch,
            "diagnosis": d.diagnosis.model_dump(),
            "proposed_action": d.proposed_action.model_dump(),
        }
        for d in confirmed_diagnoses
    ]

    user_prompt = (
        f"Case ID: {case.case_id}\n"
        f"All confirmed proposed actions for this case (JSON):\n"
        f"{json.dumps(all_actions_payload, default=str)}\n\n"
        "Return a JSON array, one ActionGuardrailResult object per branch "
        "listed above, in the same order, each with fields: case_id, "
        "branch, guardrail_triggered, reason (null if not triggered)."
    )

    batch = call_structured(
        model_env_var="REASONING_MODEL",
        system_prompt=ACTION_GUARDRAIL_SYSTEM_PROMPT
        + " Respond as a JSON object with a single key 'results' holding the array.",
        user_prompt=user_prompt,
        response_model=ActionGuardrailBatch,
        temperature=config["llm"]["guardrail_temperature"],
        max_tokens=config["llm"]["max_tokens"],
    )

    results = batch.results
    for r in results:
        if r.guardrail_triggered:
            logger.warning("case=%s branch=%s action_guardrail=TRIGGERED reason=%s", r.case_id, r.branch, r.reason)
        else:
            logger.info("case=%s branch=%s action_guardrail=PASSED", r.case_id, r.branch)
    return results
