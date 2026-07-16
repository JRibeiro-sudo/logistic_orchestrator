"""Specialist branch: upstream_supply.

Evidence gathering is outbound + internal: a fixed, pre-approved template
pinging an internal stakeholder about upstream component availability.
Must pass the evidence guardrail before the mocked send occurs.
"""

from __future__ import annotations

import logging

from pipeline.guardrails import evidence_guardrail
from pipeline.specialists import mock_tools
from pipeline.specialists.base import SpecialistBranch
from schemas import EvidenceGuardrailResult, EvidenceRecord, ShortageCase

logger = logging.getLogger("specialists.upstream_supply")

STAKEHOLDER_TEMPLATE = (
    "To: Upstream Planning\n\n"
    "Requesting confirmation of upstream raw-material / component "
    "availability status for part {part_number} to support inbound PO "
    "fulfillment. Please confirm whether upstream supply is on track."
)

DIAGNOSIS_SYSTEM_PROMPT = (
    "You are the upstream-supply investigation specialist for a synthetic "
    "academic-prototype procurement shortage case. Given the gathered "
    "evidence (a simulated internal stakeholder exchange), decide whether "
    "an upstream supply constraint (e.g. a component feeding this part's "
    "supplier) is confirmed as the cause of the shortage, with a "
    "confidence 0.0-1.0 and a short explanation. If confirmed, propose "
    "exactly ONE recovery action with a plausible estimated_cost_eur and "
    "estimated_recovery_days. Valid action types: expedite_freight, "
    "spot_buy, capacity_request, reallocate_plan, none. If not confirmed, "
    "proposed_action.type MUST be 'none' and cost/days MUST be 0. This is "
    "entirely synthetic data for an academic exercise — do not invent "
    "facts beyond the evidence provided."
)


class UpstreamSupplyBranch(SpecialistBranch):
    name = "upstream_supply"
    outbound = True

    def gather_evidence(
        self, case: ShortageCase, config: dict
    ) -> tuple[list[EvidenceRecord], list[EvidenceGuardrailResult]]:
        rendered = STAKEHOLDER_TEMPLATE.format(part_number=case.part_number)

        guardrail_result = evidence_guardrail(case, self.name, "mock_contact_internal_stakeholder", rendered, config)
        if not guardrail_result.passed:
            logger.warning("case=%s upstream_supply evidence guardrail blocked send", case.case_id)
            return [], [guardrail_result]

        response = mock_tools.mock_contact_internal_stakeholder(rendered, case.part_number)
        evidence = EvidenceRecord(
            case_id=case.case_id,
            branch=self.name,
            tool="mock_contact_internal_stakeholder",
            outbound=True,
            request_payload={"template": rendered, "part_id": case.part_number},
            response_payload=response,
        )
        return [evidence], [guardrail_result]

    def diagnose(self, case: ShortageCase, evidence: list[EvidenceRecord], config: dict):
        if not evidence:
            return self.no_evidence_diagnosis(case, "Evidence guardrail blocked the outbound internal stakeholder contact; no evidence available.")
        return self.call_diagnosis_llm(case, evidence, DIAGNOSIS_SYSTEM_PROMPT, config)
