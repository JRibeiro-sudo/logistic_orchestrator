"""End-to-end pipeline test with the Anthropic client mocked out.

This does NOT require ANTHROPIC_API_KEY / network access. It verifies the
plumbing between every stage (schema validation, dispatch, evidence
guardrail, action guardrail, synthesis, checkpoint, execution, case log) is
wired correctly by substituting a fake Anthropic client that returns
scripted structured JSON. It is a test of the pipeline's glue code, not a
substitute for running against the real model.
"""

from __future__ import annotations

import json
import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest

os.environ.setdefault("TRIAGE_MODEL", "test-triage-model")
os.environ.setdefault("REASONING_MODEL", "test-reasoning-model")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-used")

from pipeline import execution, human_checkpoint
from pipeline.config_loader import load_config
from pipeline.guardrails import run_action_guardrail
from pipeline.orchestrator import dispatch, dispatched_branch_names
from pipeline.specialists import BRANCH_REGISTRY
from pipeline.synthesis import synthesize
from pipeline.trigger import check_part
from pipeline import llm_client


class _FakeTextBlock:
    def __init__(self, text: str):
        self.type = "text"
        self.text = text


class _ScriptedAnthropicClient:
    """Returns the next canned JSON payload from `script` on each call,
    matched by a substring of the system prompt (so triage vs diagnosis vs
    guardrail vs synthesis calls each get their own scripted response)."""

    def __init__(self, script: dict[str, dict]):
        self.script = script
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, *, model, max_tokens, temperature, system, messages):
        for marker, payload in self.script.items():
            if marker in system:
                return SimpleNamespace(content=[_FakeTextBlock(json.dumps(payload))])
        raise AssertionError(f"No scripted response matched system prompt: {system[:200]}")


@pytest.fixture(autouse=True)
def _clear_llm_client_singleton():
    llm_client._client = None
    yield
    llm_client._client = None


def _script_low_impact_transport():
    return {
        "root-cause triage": {
            "case_id": "PLACEHOLDER",
            "ranked_causes": [
                {"cause": "supplier_capacity", "likelihood": 0.1},
                {"cause": "upstream_supply", "likelihood": 0.05},
                {"cause": "transport", "likelihood": 0.8},
                {"cause": "demand_deviation", "likelihood": 0.1},
            ],
        },
        "transport investigation specialist": {
            "case_id": "PLACEHOLDER",
            "branch": "transport",
            "diagnosis": {"confirmed": True, "confidence": 0.85, "explanation": "Carrier tracking shows a confirmed delay."},
            "proposed_action": {
                "type": "expedite_freight",
                "description": "Book expedited freight for the delayed shipment.",
                "estimated_cost_eur": 450,
                "estimated_recovery_days": 1,
            },
        },
        "action guardrail": {
            "results": [
                {"case_id": "PLACEHOLDER", "branch": "transport", "guardrail_triggered": False, "reason": None},
            ]
        },
        "action synthesis": {
            "case_id": "PLACEHOLDER",
            "ranked_actions": [{"branch": "transport", "action": "expedite_freight", "cost_eur": 450, "confidence": 0.85}],
            "recommended_action": {"branch": "transport", "action": "expedite_freight", "cost_eur": 450},
            "no_viable_action": False,
        },
    }


def test_full_pipeline_low_impact_scenario_with_mocked_llm():
    config = load_config()
    case, horizon = check_part("DEMO-PN-9001", config)
    assert horizon.fired is True
    assert horizon.band == "short"

    script = _script_low_impact_transport()
    for payload in script.values():
        if "case_id" in payload:
            payload["case_id"] = case.case_id
        elif "results" in payload:
            for r in payload["results"]:
                r["case_id"] = case.case_id

    fake_client = _ScriptedAnthropicClient(script)
    with patch.object(llm_client, "get_client", return_value=fake_client):
        from pipeline import triage as triage_module

        triage_output = triage_module.run_triage(case, config)
        assert triage_output.case_id == case.case_id
        dispatch_decision = dispatch(triage_output, config)
        dispatched = dispatched_branch_names(dispatch_decision)
        assert dispatched == ["transport"]

        branch = BRANCH_REGISTRY["transport"]
        evidence, guardrail_results, diagnosis = branch.run(case, config)
        assert guardrail_results == []  # transport is read-only, no evidence guardrail
        assert diagnosis.diagnosis.confirmed is True
        assert diagnosis.proposed_action.type == "expedite_freight"

        action_guardrail_results = run_action_guardrail(case, [diagnosis], config)
        assert all(not r.guardrail_triggered for r in action_guardrail_results)

        synthesis_result = synthesize(case, [diagnosis], config)
        assert synthesis_result.recommended_action is not None
        assert synthesis_result.recommended_action.impact_tier == "low"  # 450 EUR < 2000 threshold

        checkpoint = human_checkpoint.run_checkpoint(case, synthesis_result, config, input_fn=lambda role, prompt: "y")
        assert [a.role for a in checkpoint.approvals] == ["planner"]
        assert checkpoint.approved is True

        exec_result = execution.execute(case, synthesis_result, checkpoint)
        assert exec_result.executed is True


def test_action_guardrail_batch_rejects_a_flagged_branch():
    config = load_config()
    case, _ = check_part("DEMO-PN-9003", config)

    from schemas import SpecialistDiagnosis

    diag_a = SpecialistDiagnosis(
        case_id=case.case_id,
        branch="supplier_capacity",
        diagnosis={"confirmed": True, "confidence": 0.7, "explanation": "x"},
        proposed_action={"type": "spot_buy", "description": "Buy spot stock.", "estimated_cost_eur": 3000, "estimated_recovery_days": 2},
    )
    diag_b = SpecialistDiagnosis(
        case_id=case.case_id,
        branch="demand_deviation",
        diagnosis={"confirmed": True, "confidence": 0.6, "explanation": "y"},
        proposed_action={"type": "reallocate_plan", "description": "Pull stock away.", "estimated_cost_eur": 0, "estimated_recovery_days": 0},
    )

    script = {
        "action guardrail": {
            "results": [
                {"case_id": case.case_id, "branch": "supplier_capacity", "guardrail_triggered": True, "reason": "Contradicts demand_deviation's reallocate_plan action."},
                {"case_id": case.case_id, "branch": "demand_deviation", "guardrail_triggered": True, "reason": "Contradicts supplier_capacity's spot_buy action."},
            ]
        }
    }
    fake_client = _ScriptedAnthropicClient(script)
    with patch.object(llm_client, "get_client", return_value=fake_client):
        results = run_action_guardrail(case, [diag_a, diag_b], config)
        assert all(r.guardrail_triggered for r in results)

        synthesis_result = synthesize(case, [], config)  # nothing passed the guardrail
        assert synthesis_result.recommended_action is None
        assert synthesis_result.no_viable_action is True
