"""Section 3.7 — Action synthesis (reasoning tier).

Input: all guardrail-passed proposed actions for the case. The LLM ranks
them by cost and confidence and proposes a single recommended action (or
states no viable action was found). impact_tier itself is NOT decided by
the model — it is computed deterministically afterwards from the
configurable cost/impact threshold and the cross-functional schedule flag,
so a model can't quietly reclassify a high-impact action as low-impact.
"""

from __future__ import annotations

import json

from pydantic import BaseModel, Field

from pipeline.llm_client import call_structured
from schemas import ActionSynthesis, Cause, ActionType, RankedAction, RecommendedAction, ShortageCase, SpecialistDiagnosis

SYNTHESIS_SYSTEM_PROMPT = (
    "You are the action synthesis stage for a synthetic academic-prototype "
    "procurement recovery workflow. You are given all guardrail-passed "
    "proposed actions for one shortage case. Rank them by a combination of "
    "lower cost and higher confidence (best first). Then pick ONE "
    "recommended_action (branch, action, cost_eur) from that ranking, or "
    "set no_viable_action=true and leave recommended_action null if none "
    "of the actions are worth pursuing (e.g. all low confidence or no "
    "actions provided). Do not invent actions not present in the input."
)


class _RecommendedActionCandidate(BaseModel):
    branch: Cause
    action: ActionType
    cost_eur: float = Field(ge=0)


class _SynthesisLLMOutput(BaseModel):
    case_id: str
    ranked_actions: list[RankedAction]
    recommended_action: _RecommendedActionCandidate | None = None
    no_viable_action: bool = False


def synthesize(
    case: ShortageCase,
    guardrail_passed_diagnoses: list[SpecialistDiagnosis],
    config: dict,
) -> ActionSynthesis:
    if not guardrail_passed_diagnoses:
        return ActionSynthesis(case_id=case.case_id, ranked_actions=[], recommended_action=None, no_viable_action=True)

    candidates = [
        {
            "branch": d.branch,
            "action": d.proposed_action.type,
            "cost_eur": d.proposed_action.estimated_cost_eur,
            "confidence": d.diagnosis.confidence,
            "recovery_days": d.proposed_action.estimated_recovery_days,
            "description": d.proposed_action.description,
        }
        for d in guardrail_passed_diagnoses
    ]

    user_prompt = (
        f"Case ID: {case.case_id}\n"
        f"Guardrail-passed candidate actions (JSON):\n{json.dumps(candidates, default=str)}"
    )

    llm_output = call_structured(
        model_env_var="REASONING_MODEL",
        system_prompt=SYNTHESIS_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=_SynthesisLLMOutput,
        temperature=config["llm"]["reasoning_temperature"],
        max_tokens=config["llm"]["max_tokens"],
    )

    recommended_action = None
    no_viable_action = llm_output.no_viable_action
    if llm_output.recommended_action is not None and not no_viable_action:
        cost = llm_output.recommended_action.cost_eur
        threshold = config["impact"]["cost_threshold_eur"]
        is_high = cost >= threshold or case.affects_committed_schedule
        recommended_action = RecommendedAction(
            branch=llm_output.recommended_action.branch,
            action=llm_output.recommended_action.action,
            cost_eur=cost,
            impact_tier="high" if is_high else "low",
        )
    elif llm_output.recommended_action is None:
        no_viable_action = True

    return ActionSynthesis(
        case_id=case.case_id,
        ranked_actions=llm_output.ranked_actions,
        recommended_action=recommended_action,
        no_viable_action=no_viable_action,
    )
