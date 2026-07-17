"""Pydantic models for every structured record and LLM output in the pipeline.

Every LLM call in this system (Section 3.3, 3.5c, 3.6, 3.7) must validate its
response against one of these models before the value is trusted anywhere
downstream. Nothing free-text from a model is ever parsed with string
matching.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Cause = Literal["supplier_capacity", "upstream_supply", "transport", "demand_deviation"]
ActionType = Literal["expedite_freight", "spot_buy", "capacity_request", "reallocate_plan", "none"]
ImpactTier = Literal["low", "high"]
ApproverRole = Literal["planner", "procurement", "production", "logistics"]


# --------------------------------------------------------------------------
# 3.1 Trigger
# --------------------------------------------------------------------------
class ShortageCase(BaseModel):
    case_id: str
    part_number: str
    supplier_id: str
    current_stock_units: float
    daily_consumption_units: float
    projected_coverage_hours: float
    lead_time_days: float
    # Stub input for the "affects committed production schedule" flag used
    # in 3.7 impact tiering. In a real system this would come from MRP/APS.
    affects_committed_schedule: bool = False
    triggered_at: datetime = Field(default_factory=datetime.utcnow)


# --------------------------------------------------------------------------
# 3.2 Lead-time band routing
# --------------------------------------------------------------------------
class CoverageHorizonDecision(BaseModel):
    case_id: str
    lead_time_days: float
    band: Literal["short", "long"]
    coverage_horizon_hours: float
    projected_coverage_hours: float
    fired: bool  # True if projected_coverage_hours < coverage_horizon_hours


# --------------------------------------------------------------------------
# 3.3 Root-cause triage (AI Assistant tier)
# --------------------------------------------------------------------------
class RankedCause(BaseModel):
    cause: Cause
    likelihood: float = Field(ge=0.0, le=1.0)


class TriageOutput(BaseModel):
    case_id: str
    ranked_causes: list[RankedCause]

    @field_validator("ranked_causes")
    @classmethod
    def must_cover_all_causes(cls, v: list[RankedCause]) -> list[RankedCause]:
        causes = {c.cause for c in v}
        expected = {"supplier_capacity", "upstream_supply", "transport", "demand_deviation"}
        if causes != expected:
            raise ValueError(f"ranked_causes must cover exactly {expected}, got {causes}")
        return v


# --------------------------------------------------------------------------
# 3.4 Orchestrator dispatch (deterministic)
# --------------------------------------------------------------------------
class DispatchedBranch(BaseModel):
    branch: Cause
    likelihood: float
    dispatched: bool


class DispatchDecision(BaseModel):
    case_id: str
    threshold: float
    branches: list[DispatchedBranch]


# --------------------------------------------------------------------------
# 3.5a Evidence gathering
# --------------------------------------------------------------------------
class EvidenceRecord(BaseModel):
    case_id: str
    branch: Cause
    tool: str
    outbound: bool
    request_payload: dict
    response_payload: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# --------------------------------------------------------------------------
# 3.5b Evidence guardrail (outbound branches only)
# --------------------------------------------------------------------------
class EvidenceGuardrailResult(BaseModel):
    case_id: str
    branch: Cause
    tool: str
    passed: bool
    violated_terms: list[str] = Field(default_factory=list)
    rendered_message: str


# --------------------------------------------------------------------------
# 3.5c Diagnosis and action proposal (reasoning tier)
# --------------------------------------------------------------------------
class Diagnosis(BaseModel):
    confirmed: bool
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str


class ProposedAction(BaseModel):
    type: ActionType
    description: str
    estimated_cost_eur: float = Field(ge=0)
    estimated_recovery_days: float = Field(ge=0)


class SpecialistDiagnosis(BaseModel):
    case_id: str
    branch: Cause
    diagnosis: Diagnosis
    proposed_action: ProposedAction

    @field_validator("proposed_action")
    @classmethod
    def none_action_if_unconfirmed(cls, v: ProposedAction, info) -> ProposedAction:
        diagnosis = info.data.get("diagnosis")
        if diagnosis is not None and not diagnosis.confirmed and v.type != "none":
            raise ValueError("proposed_action.type must be 'none' when diagnosis.confirmed is false")
        return v


# --------------------------------------------------------------------------
# 3.6 Action guardrail (reasoning tier)
# --------------------------------------------------------------------------
class ActionGuardrailResult(BaseModel):
    case_id: str
    branch: Cause
    guardrail_triggered: bool
    reason: str | None = None

    @field_validator("reason")
    @classmethod
    def reason_required_if_triggered(cls, v: str | None, info) -> str | None:
        if info.data.get("guardrail_triggered") and not v:
            raise ValueError("reason is required when guardrail_triggered is true")
        return v


# --------------------------------------------------------------------------
# 3.7 Action synthesis (reasoning tier)
# --------------------------------------------------------------------------
class RankedAction(BaseModel):
    branch: Cause
    action: ActionType
    cost_eur: float = Field(ge=0)
    confidence: float = Field(ge=0.0, le=1.0)


class RecommendedAction(BaseModel):
    branch: Cause
    action: ActionType
    cost_eur: float = Field(ge=0)
    impact_tier: ImpactTier


class ActionSynthesis(BaseModel):
    case_id: str
    ranked_actions: list[RankedAction]
    recommended_action: RecommendedAction | None = None
    no_viable_action: bool = False

    @field_validator("no_viable_action")
    @classmethod
    def consistent_with_recommendation(cls, v: bool, info) -> bool:
        rec = info.data.get("recommended_action")
        if v and rec is not None:
            raise ValueError("no_viable_action cannot be true when recommended_action is set")
        return v


# --------------------------------------------------------------------------
# 3.8 Human checkpoint
# --------------------------------------------------------------------------
class ApprovalRecord(BaseModel):
    role: ApproverRole
    approver_name: str
    decision: Literal["approved", "rejected"]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HumanCheckpointDecision(BaseModel):
    case_id: str
    impact_tier: ImpactTier
    approvals: list[ApprovalRecord]
    approved: bool

    @field_validator("approved")
    @classmethod
    def approved_requires_all_roles_approved(cls, v: bool, info) -> bool:
        approvals: list[ApprovalRecord] = info.data.get("approvals", [])
        all_approved = bool(approvals) and all(a.decision == "approved" for a in approvals)
        if v != all_approved:
            raise ValueError("approved must equal AND of all approval decisions")
        return v


# --------------------------------------------------------------------------
# 3.9 Execution (deterministic — only reachable after HumanCheckpointDecision.approved)
# --------------------------------------------------------------------------
class ExecutionResult(BaseModel):
    case_id: str
    action_type: ActionType
    executed: bool
    confirmation_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# --------------------------------------------------------------------------
# 3.10 Full case record persisted to SQLite
# --------------------------------------------------------------------------
class CaseRecord(BaseModel):
    case_id: str
    shortage_case: ShortageCase
    coverage_horizon: CoverageHorizonDecision
    triage: TriageOutput | None = None
    dispatch: DispatchDecision | None = None
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    evidence_guardrail_results: list[EvidenceGuardrailResult] = Field(default_factory=list)
    specialist_diagnoses: list[SpecialistDiagnosis] = Field(default_factory=list)
    action_guardrail_results: list[ActionGuardrailResult] = Field(default_factory=list)
    synthesis: ActionSynthesis | None = None
    checkpoint: HumanCheckpointDecision | None = None
    execution: ExecutionResult | None = None
    recurring_risk: bool = False
    # Extension beyond the original spec (see pipeline/synthesis.py::check_escalation):
    # set whenever synthesis reports no_viable_action, so a case where the
    # automated pipeline can't converge on a trustworthy action is routed to
    # manual investigation instead of being silently closed.
    escalated_to_manual_review: bool = False
    escalation_reason: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
