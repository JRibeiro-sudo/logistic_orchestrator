"""demo_scenarios.py — named, reproducible walkthroughs of the pipeline.

Each scenario is runnable independently:

    python demo_scenarios.py low_impact
    python demo_scenarios.py high_impact
    python demo_scenarios.py guardrail_rejection
    python demo_scenarios.py recurring_risk
    python demo_scenarios.py all

Every scenario uses the hand-crafted DEMO-PN-* fixtures from
generate_mock_data.py so the *shape* of each case (lead-time band, which
signals are present) is reproducible. What each specialist branch actually
diagnoses and proposes is still a REAL Anthropic API call — nothing about
the diagnosis, action guardrail, or synthesis content is scripted or
string-matched. Only Scenario 3 additionally injects one clearly-labeled
synthetic diagnosis (see comment there) so the guardrail's cross-branch
contradiction check can be demonstrated deterministically rather than
hoping two live branches happen to disagree on a given run.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

from main import process_case
from pipeline import trigger
from pipeline.config_loader import load_config
from schemas import SpecialistDiagnosis

ALL_CAUSES = ["supplier_capacity", "upstream_supply", "transport", "demand_deviation"]


def _approve_all(role: str, prompt_text: str) -> str:
    print(prompt_text, end="")
    print("y   [auto-approved by demo scenario]")
    return "y"


def _reject_all(role: str, prompt_text: str) -> str:
    print(prompt_text, end="")
    print("n   [auto-rejected by demo scenario]")
    return "n"


def _load_case(part_number: str, config: dict, affects_committed_schedule: bool = False, triggered_at=None):
    result = trigger.check_part(part_number, config)
    if result is None:
        raise RuntimeError(
            f"{part_number} did not trip the trigger against current mock data — "
            "run `python generate_mock_data.py` to regenerate fixtures."
        )
    shortage_case, horizon_decision = result
    updates: dict = {}
    if affects_committed_schedule:
        updates["affects_committed_schedule"] = True
    if triggered_at is not None:
        updates["triggered_at"] = triggered_at
    if updates:
        shortage_case = shortage_case.model_copy(update=updates)
    return shortage_case, horizon_decision


def scenario_low_impact() -> None:
    """1. Low-impact, single/few-branch, planner approves, executes.

    DEMO-PN-9001: short lead time (3d, 48h horizon). PO is CONFIRMED by the
    supplier (rules out supplier_capacity) but carrier tracking shows a
    hard delay and consumption is exactly on plan (rules out demand
    deviation) — an unambiguous transport signal. affects_committed_schedule
    is left False, so if the model's proposed cost stays under the
    €2,000 impact threshold this lands as low-impact -> single planner
    approval -> execution.
    """
    print("\n### SCENARIO 1: Low-impact, single-branch, planner-approved ###")
    config = load_config()
    shortage_case, horizon_decision = _load_case("DEMO-PN-9001", config)
    process_case(shortage_case, horizon_decision, config, input_fn=_approve_all)


def scenario_high_impact() -> None:
    """2. High-impact, multi-branch, cross-functional approval.

    DEMO-PN-9002: long lead time (21d, 756h horizon). Supplier itself has
    flagged the PO as at_risk and nothing has shipped yet (no inbound
    delivery record at all) — an unambiguous supplier-capacity signal.
    affects_committed_schedule is forced True, which per Section 3.7
    deterministically forces impact_tier=high regardless of the model's
    proposed cost, so this reliably requires all three cross-functional
    approvals (procurement, production, logistics).
    """
    print("\n### SCENARIO 2: High-impact, multi-branch, cross-functional approval ###")
    config = load_config()
    shortage_case, horizon_decision = _load_case("DEMO-PN-9002", config, affects_committed_schedule=True)
    process_case(shortage_case, horizon_decision, config, input_fn=_approve_all)


def scenario_guardrail_rejection() -> None:
    """3. Guardrail rejection — contradictory actions, escalated to manual review.

    DEMO-PN-9003 runs the full LIVE pipeline through triage, dispatch, and
    every dispatched specialist branch's real evidence gathering and
    real reasoning-tier diagnosis. To reliably demonstrate the action
    guardrail's cross-branch contradiction check (rather than hoping two
    live branches happen to disagree on any given run), this scenario also
    injects ONE clearly-labeled synthetic diagnosis for whichever cause was
    NOT live-dispatched, proposing to reallocate this part's remaining
    stock away to a higher-priority order — which directly contradicts any
    live branch proposing to expedite/spot-buy to COVER this shortage. The
    REAL action-guardrail LLM call then evaluates all of them together and
    is expected to flag the contradiction, excluding it from synthesis so
    no execution occurs.

    Critically, the case is NOT simply closed at that point: the shortage
    risk is still real, so pipeline/synthesis.py::check_escalation flags it
    escalated_to_manual_review=True and the case log records why, routing
    it to the standard (non-AI) procurement recovery process instead of
    silently dropping it.
    """
    print("\n### SCENARIO 3: Guardrail rejection (contradictory actions) ###")
    config = load_config()
    shortage_case, horizon_decision = _load_case("DEMO-PN-9003", config)

    print(f"\n{'=' * 78}\nCASE {shortage_case.case_id} — part {shortage_case.part_number}\n{'=' * 78}")
    print(f"[3.1 Trigger] projected_coverage_hours={shortage_case.projected_coverage_hours:.1f}")
    print(f"[3.2 Lead-time band routing] band={horizon_decision.band} horizon_hours={horizon_decision.coverage_horizon_hours:.1f}")

    from pipeline import triage as triage_module
    from pipeline.orchestrator import dispatch, dispatched_branch_names
    from pipeline.specialists import BRANCH_REGISTRY

    print("[3.3 Triage] fast-tier model ranking root causes...")
    triage_output = triage_module.run_triage(shortage_case, config)
    for rc in triage_output.ranked_causes:
        print(f"    {rc.cause:<18} likelihood={rc.likelihood:.2f}")

    print("[3.4 Orchestrator] deterministic dispatch")
    dispatch_decision = dispatch(triage_output, config)
    live_dispatched = dispatched_branch_names(dispatch_decision)
    print(f"    dispatched_branches={live_dispatched}")

    confirmed_diagnoses: list[SpecialistDiagnosis] = []
    for branch_name in live_dispatched:
        branch = BRANCH_REGISTRY[branch_name]
        print(f"[3.5 Specialist: {branch_name}] gathering evidence + diagnosing (LIVE)...")
        _, guardrail_results, diagnosis = branch.run(shortage_case, config)
        for gr in guardrail_results:
            print(f"    evidence_guardrail: passed={gr.passed}")
        print(f"    diagnosis: confirmed={diagnosis.diagnosis.confirmed} confidence={diagnosis.diagnosis.confidence:.2f} -> action={diagnosis.proposed_action.type}")
        if diagnosis.diagnosis.confirmed:
            confirmed_diagnoses.append(diagnosis)

    injected_branch = next((c for c in ALL_CAUSES if c not in live_dispatched), None)
    if injected_branch is not None:
        injected = SpecialistDiagnosis(
            case_id=shortage_case.case_id,
            branch=injected_branch,
            diagnosis={
                "confirmed": True,
                "confidence": 0.75,
                "explanation": (
                    "[DEMO INJECTED — not a live LLM call] A concurrent investigation "
                    "stream reports this part's committed production plan is being "
                    "reallocated toward a higher-priority order."
                ),
            },
            proposed_action={
                "type": "reallocate_plan",
                "description": (
                    "[DEMO INJECTED] Reallocate this part's remaining safety stock "
                    "away to a higher-priority order."
                ),
                "estimated_cost_eur": 0,
                "estimated_recovery_days": 0,
            },
        )
        print(f"[3.5 Specialist: {injected_branch}] [DEMO INJECTED — synthetic fixture, not a live call] confirmed=True -> action=reallocate_plan")
        confirmed_diagnoses.append(injected)

    print("[3.6 Action guardrail] REAL reasoning-tier check over confirmed proposed actions (including the injected one)...")
    from pipeline.guardrails import run_action_guardrail

    action_guardrail_results = run_action_guardrail(shortage_case, confirmed_diagnoses, config)
    passed_branches = {r.branch for r in action_guardrail_results if not r.guardrail_triggered}
    any_triggered = False
    for r in action_guardrail_results:
        status = f"TRIGGERED — {r.reason}" if r.guardrail_triggered else "passed"
        if r.guardrail_triggered:
            any_triggered = True
        print(f"    {r.branch:<18} {status}")

    guardrail_passed = [d for d in confirmed_diagnoses if d.branch in passed_branches]

    print("[3.7 Action synthesis]")
    from pipeline.synthesis import synthesize

    synthesis_result = synthesize(shortage_case, guardrail_passed, config)
    if synthesis_result.recommended_action:
        ra = synthesis_result.recommended_action
        print(f"    recommended: branch={ra.branch} action={ra.action} cost_eur={ra.cost_eur:.2f} impact_tier={ra.impact_tier}")
    else:
        print("    no viable action found (expected if the guardrail excluded the contradictory actions)")

    from pipeline import case_log

    record_kwargs = dict(
        case_id=shortage_case.case_id,
        shortage_case=shortage_case,
        coverage_horizon=horizon_decision,
        triage=triage_output,
        dispatch=dispatch_decision,
        specialist_diagnoses=confirmed_diagnoses,
        action_guardrail_results=action_guardrail_results,
        synthesis=synthesis_result,
    )
    from schemas import CaseRecord

    record = CaseRecord(**record_kwargs)

    from pipeline.synthesis import check_escalation

    escalated, escalation_reason = check_escalation(confirmed_diagnoses, synthesis_result)
    record.escalated_to_manual_review = escalated
    record.escalation_reason = escalation_reason

    if synthesis_result.recommended_action is not None:
        print("[3.8 Human checkpoint] a viable action survived the guardrail — proceeding to approval")
        from pipeline import human_checkpoint

        checkpoint = human_checkpoint.run_checkpoint(shortage_case, synthesis_result, config, input_fn=_approve_all)
        record.checkpoint = checkpoint
        if checkpoint.approved:
            from pipeline import execution

            exec_result = execution.execute(shortage_case, synthesis_result, checkpoint)
            record.execution = exec_result
            print(f"[3.9 Execution] EXECUTED action={exec_result.action_type}")
    else:
        print(f"[Escalation → manual review] {escalation_reason}")
        print("[3.8/3.9 Human checkpoint / Execution] SKIPPED — case escalated to the standard manual procurement recovery process. The shortage risk stays open; it is not silently dropped.")

    record.recurring_risk = case_log.compute_recurring_risk(shortage_case.part_number, config, shortage_case.triggered_at)
    case_log.save_case(record, config)
    print(
        f"[3.10 Case log] persisted. guardrail_triggered_at_least_once={any_triggered}  "
        f"execution_occurred={record.execution is not None}  escalated_to_manual_review={record.escalated_to_manual_review}"
    )


def scenario_recurring_risk() -> None:
    """Optional scenario: the same part triggering >= 3 times within the
    trailing 90-day window sets recurring_risk=true — a plain counting
    query, not an AI call, and purely informational."""
    print("\n### SCENARIO 4 (optional): Recurring risk flag ###")
    config = load_config()
    now = datetime.now(timezone.utc)
    backdates = [now - timedelta(days=70), now - timedelta(days=35), now]

    for i, triggered_at in enumerate(backdates, start=1):
        print(f"\n--- Trigger occurrence {i}/3 for DEMO-PN-9001 (triggered_at={triggered_at.date()}) ---")
        shortage_case, horizon_decision = _load_case("DEMO-PN-9001", config, triggered_at=triggered_at)
        record = process_case(shortage_case, horizon_decision, config, input_fn=_approve_all)
        print(f"    -> recurring_risk={record.recurring_risk}")


SCENARIOS = {
    "low_impact": scenario_low_impact,
    "high_impact": scenario_high_impact,
    "guardrail_rejection": scenario_guardrail_rejection,
    "recurring_risk": scenario_recurring_risk,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run named demo scenarios for the procurement recovery orchestrator.")
    parser.add_argument("scenario", choices=[*SCENARIOS.keys(), "all"], help="Which scenario to run.")
    args = parser.parse_args()

    if args.scenario == "all":
        for fn in SCENARIOS.values():
            fn()
    else:
        SCENARIOS[args.scenario]()


if __name__ == "__main__":
    main()
