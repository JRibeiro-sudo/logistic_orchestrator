"""Specialist branch: transport.

Evidence gathering is read-only + external: a carrier tracking lookup.
No evidence guardrail applies (not an outbound message).
"""

from __future__ import annotations

from pipeline import data_access
from pipeline.specialists import mock_tools
from pipeline.specialists.base import SpecialistBranch
from schemas import EvidenceGuardrailResult, EvidenceRecord, ShortageCase

DIAGNOSIS_SYSTEM_PROMPT = (
    "You are the transport investigation specialist for a synthetic "
    "academic-prototype procurement shortage case. Given the gathered "
    "evidence (a carrier tracking lookup), decide whether a transport / "
    "logistics delay is confirmed as the cause of the shortage, with a "
    "confidence 0.0-1.0 and a short explanation. If confirmed, propose "
    "exactly ONE recovery action with a plausible estimated_cost_eur and "
    "estimated_recovery_days. Valid action types: expedite_freight, "
    "spot_buy, capacity_request, reallocate_plan, none. If not confirmed, "
    "proposed_action.type MUST be 'none' and cost/days MUST be 0. This is "
    "entirely synthetic data for an academic exercise — do not invent "
    "facts beyond the evidence provided."
)


class TransportBranch(SpecialistBranch):
    name = "transport"
    outbound = False

    def gather_evidence(
        self, case: ShortageCase, config: dict
    ) -> tuple[list[EvidenceRecord], list[EvidenceGuardrailResult]]:
        po_list = data_access.get_po_status_for_part(case.part_number)
        records: list[EvidenceRecord] = []
        for po in po_list:
            delivery = data_access.get_inbound_for_po(po["po_id"])
            if delivery is None:
                continue
            response = mock_tools.mock_carrier_tracking_lookup(delivery["tracking_number"])
            records.append(
                EvidenceRecord(
                    case_id=case.case_id,
                    branch=self.name,
                    tool="mock_carrier_tracking_lookup",
                    outbound=False,
                    request_payload={"tracking_number": delivery["tracking_number"]},
                    response_payload=response,
                )
            )
        return records, []

    def diagnose(self, case: ShortageCase, evidence: list[EvidenceRecord], config: dict):
        if not evidence:
            return self.no_evidence_diagnosis(case, "No inbound delivery / tracking records found for this part's open POs.")
        return self.call_diagnosis_llm(case, evidence, DIAGNOSIS_SYSTEM_PROMPT, config)
