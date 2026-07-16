"""Specialist branch: demand_deviation.

Evidence gathering is read-only + internal: a mocked SAP consumption-vs-plan
query. No evidence guardrail applies (not an outbound message).
"""

from __future__ import annotations

from pipeline.specialists import mock_tools
from pipeline.specialists.base import SpecialistBranch
from schemas import EvidenceGuardrailResult, EvidenceRecord, ShortageCase

DIAGNOSIS_SYSTEM_PROMPT = (
    "You are the demand-deviation investigation specialist for a "
    "synthetic academic-prototype procurement shortage case. Given the "
    "gathered evidence (a mocked SAP consumption-vs-plan query), decide "
    "whether demand deviating from the plan is confirmed as the cause of "
    "the shortage, with a confidence 0.0-1.0 and a short explanation. If "
    "confirmed, propose exactly ONE recovery action with a plausible "
    "estimated_cost_eur and estimated_recovery_days. Valid action types: "
    "expedite_freight, spot_buy, capacity_request, reallocate_plan, none. "
    "If not confirmed, proposed_action.type MUST be 'none' and cost/days "
    "MUST be 0. This is entirely synthetic data for an academic exercise "
    "— do not invent facts beyond the evidence provided."
)


class DemandDeviationBranch(SpecialistBranch):
    name = "demand_deviation"
    outbound = False

    def gather_evidence(
        self, case: ShortageCase, config: dict
    ) -> tuple[list[EvidenceRecord], list[EvidenceGuardrailResult]]:
        response = mock_tools.mock_sap_query(case.part_number, "consumption_vs_plan")
        evidence = EvidenceRecord(
            case_id=case.case_id,
            branch=self.name,
            tool="mock_sap_query",
            outbound=False,
            request_payload={"part_id": case.part_number, "query_type": "consumption_vs_plan"},
            response_payload=response,
        )
        return [evidence], []

    def diagnose(self, case: ShortageCase, evidence: list[EvidenceRecord], config: dict):
        if not evidence:
            return self.no_evidence_diagnosis(case, "No consumption-vs-plan data available for this part.")
        return self.call_diagnosis_llm(case, evidence, DIAGNOSIS_SYSTEM_PROMPT, config)
