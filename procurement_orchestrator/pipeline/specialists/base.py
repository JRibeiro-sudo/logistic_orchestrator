"""Section 3.5 — shared interface for the four specialist branches.

Each branch is an independent module implementing this interface rather
than a single generic "investigate" function. Every branch's `run` does:
  a) evidence gathering (autonomous, no human gate — but logged), and for
     the two outbound branches, the evidence guardrail check happens
     inside gather_evidence before any mocked "send" occurs;
  b) diagnosis + action proposal via the reasoning-tier model.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import ClassVar

from pipeline.llm_client import call_structured
from schemas import EvidenceGuardrailResult, EvidenceRecord, ShortageCase, SpecialistDiagnosis


class SpecialistBranch(ABC):
    name: ClassVar[str]
    outbound: ClassVar[bool] = False

    @abstractmethod
    def gather_evidence(
        self, case: ShortageCase, config: dict
    ) -> tuple[list[EvidenceRecord], list[EvidenceGuardrailResult]]:
        """Calls this branch's mocked tool(s). Returns the evidence records
        produced plus any evidence-guardrail results (empty for read-only
        branches). For outbound branches, if the guardrail check fails the
        mocked send must NOT occur and evidence will be empty."""
        raise NotImplementedError

    @abstractmethod
    def diagnose(
        self, case: ShortageCase, evidence: list[EvidenceRecord], config: dict
    ) -> SpecialistDiagnosis:
        """Reasoning-tier diagnosis + action proposal from gathered evidence."""
        raise NotImplementedError

    def run(
        self, case: ShortageCase, config: dict
    ) -> tuple[list[EvidenceRecord], list[EvidenceGuardrailResult], SpecialistDiagnosis]:
        evidence, guardrail_results = self.gather_evidence(case, config)
        diagnosis = self.diagnose(case, evidence, config)
        return evidence, guardrail_results, diagnosis

    def no_evidence_diagnosis(self, case: ShortageCase, reason: str) -> SpecialistDiagnosis:
        """Used when evidence gathering produced nothing (e.g. the evidence
        guardrail blocked an outbound send) — never call the reasoning
        model on empty evidence, just record an unconfirmed diagnosis."""
        return SpecialistDiagnosis(
            case_id=case.case_id,
            branch=self.name,
            diagnosis={"confirmed": False, "confidence": 0.0, "explanation": reason},
            proposed_action={
                "type": "none",
                "description": "No action proposed — no evidence available.",
                "estimated_cost_eur": 0,
                "estimated_recovery_days": 0,
            },
        )

    def call_diagnosis_llm(
        self,
        case: ShortageCase,
        evidence: list[EvidenceRecord],
        system_prompt: str,
        config: dict,
    ) -> SpecialistDiagnosis:
        evidence_payload = [e.model_dump(mode="json") for e in evidence]
        user_prompt = (
            f"Case ID: {case.case_id}\n"
            f"Part: {case.part_number}\n"
            f"Supplier: {case.supplier_id}\n"
            f"Evidence gathered by this branch (JSON, synthetic):\n"
            f"{json.dumps(evidence_payload, default=str)}"
        )
        result = call_structured(
            model_env_var="REASONING_MODEL",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_model=SpecialistDiagnosis,
            temperature=config["llm"]["reasoning_temperature"],
            max_tokens=config["llm"]["max_tokens"],
        )
        if result.case_id != case.case_id or result.branch != self.name:
            result = result.model_copy(update={"case_id": case.case_id, "branch": self.name})
        return result
