"""Specialist branch: supplier_capacity.

Evidence gathering is outbound + external: a fixed, pre-approved email
template requesting a capacity/delivery status update from the supplier.
Must pass the evidence guardrail before the mocked send occurs.
"""

from __future__ import annotations

import logging

from pipeline import data_access
from pipeline.guardrails import evidence_guardrail
from pipeline.specialists import mock_tools
from pipeline.specialists.base import SpecialistBranch
from schemas import EvidenceGuardrailResult, EvidenceRecord, ShortageCase

logger = logging.getLogger("specialists.supplier_capacity")

EMAIL_TEMPLATE = (
    "Subject: Delivery status request for PO {po_id}\n\n"
    "Hello,\n\n"
    "We are requesting an updated capacity and delivery status for PO "
    "{po_id} (part {part_number}). Please confirm your current production "
    "capacity and expected ship date at your earliest convenience.\n\n"
    "Thank you."
)

DIAGNOSIS_SYSTEM_PROMPT = (
    "You are the supplier-capacity investigation specialist for a "
    "synthetic academic-prototype procurement shortage case. Given the "
    "gathered evidence (a simulated supplier email exchange), decide "
    "whether supplier capacity constraints are confirmed as the cause of "
    "the shortage, with a confidence 0.0-1.0 and a short explanation. If "
    "confirmed, propose exactly ONE recovery action with a plausible "
    "estimated_cost_eur and estimated_recovery_days. Valid action types: "
    "expedite_freight, spot_buy, capacity_request, reallocate_plan, none. "
    "If not confirmed, proposed_action.type MUST be 'none' and cost/days "
    "MUST be 0. This is entirely synthetic data for an academic exercise — "
    "do not invent facts beyond the evidence provided."
)


class SupplierCapacityBranch(SpecialistBranch):
    name = "supplier_capacity"
    outbound = True

    def gather_evidence(
        self, case: ShortageCase, config: dict
    ) -> tuple[list[EvidenceRecord], list[EvidenceGuardrailResult]]:
        po_list = data_access.get_po_status_for_part(case.part_number)
        po_id = po_list[0]["po_id"] if po_list else "UNKNOWN-PO"
        rendered = EMAIL_TEMPLATE.format(po_id=po_id, part_number=case.part_number)

        guardrail_result = evidence_guardrail(case, self.name, "mock_send_supplier_email", rendered, config)
        if not guardrail_result.passed:
            logger.warning("case=%s supplier_capacity evidence guardrail blocked send", case.case_id)
            return [], [guardrail_result]

        response = mock_tools.mock_send_supplier_email(rendered, po_id)
        evidence = EvidenceRecord(
            case_id=case.case_id,
            branch=self.name,
            tool="mock_send_supplier_email",
            outbound=True,
            request_payload={"template": rendered, "po_id": po_id},
            response_payload=response,
        )
        return [evidence], [guardrail_result]

    def diagnose(self, case: ShortageCase, evidence: list[EvidenceRecord], config: dict):
        if not evidence:
            return self.no_evidence_diagnosis(case, "Evidence guardrail blocked the outbound supplier email; no evidence available.")
        return self.call_diagnosis_llm(case, evidence, DIAGNOSIS_SYSTEM_PROMPT, config)
