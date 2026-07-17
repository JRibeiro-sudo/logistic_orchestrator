"""main.py — runs shortage case(s) through the full pipeline end to end and
prints a readable trace of every stage (Section 3.1 through 3.10). This is
the live entry point: it scans the synthetic mock data for parts that
currently trip the trigger and processes each one with real Anthropic API
calls and real interactive CLI approval prompts.

For scripted, reproducible walkthroughs of specific named scenarios, see
demo_scenarios.py instead.

See README.md for how each module here maps back to the specification.
"""

from __future__ import annotations

import argparse
import logging

from pipeline import case_log, execution, human_checkpoint, triage
from pipeline.config_loader import load_config
from pipeline.guardrails import run_action_guardrail
from pipeline.human_checkpoint import ApproverInputFn, _default_input
from pipeline.orchestrator import dispatch, dispatched_branch_names
from pipeline.specialists import BRANCH_REGISTRY
from pipeline.synthesis import check_escalation, synthesize
from pipeline.trigger import scan_all_parts
from schemas import CaseRecord, CoverageHorizonDecision, ShortageCase

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def process_case(
    shortage_case: ShortageCase,
    horizon_decision: CoverageHorizonDecision,
    config: dict,
    input_fn: ApproverInputFn = _default_input,
    trace: bool = True,
) -> CaseRecord:
    def log(msg: str = "") -> None:
        if trace:
            print(msg)

    log(f"\n{'=' * 78}")
    log(f"CASE {shortage_case.case_id} — part {shortage_case.part_number} (supplier {shortage_case.supplier_id})")
    log(f"{'=' * 78}")

    log(f"[3.1 Trigger] projected_coverage_hours={shortage_case.projected_coverage_hours:.1f}  lead_time_days={shortage_case.lead_time_days}")
    log(
        f"[3.2 Lead-time band routing] band={horizon_decision.band}  "
        f"coverage_horizon_hours={horizon_decision.coverage_horizon_hours:.1f}  fired={horizon_decision.fired}"
    )

    record = CaseRecord(case_id=shortage_case.case_id, shortage_case=shortage_case, coverage_horizon=horizon_decision)

    log("[3.3 Triage] fast-tier model ranking root causes...")
    triage_output = triage.run_triage(shortage_case, config)
    record.triage = triage_output
    for ranked_cause in triage_output.ranked_causes:
        log(f"    {ranked_cause.cause:<18} likelihood={ranked_cause.likelihood:.2f}")

    log("[3.4 Orchestrator] deterministic dispatch")
    dispatch_decision = dispatch(triage_output, config)
    record.dispatch = dispatch_decision
    dispatched = dispatched_branch_names(dispatch_decision)
    log(f"    threshold={dispatch_decision.threshold}  dispatched_branches={dispatched or '(none above threshold)'}")

    confirmed_diagnoses = []
    for branch_name in dispatched:
        branch = BRANCH_REGISTRY[branch_name]
        log(f"[3.5 Specialist: {branch_name}] gathering evidence + diagnosing...")
        evidence, guardrail_results, diagnosis = branch.run(shortage_case, config)
        record.evidence.extend(evidence)
        record.evidence_guardrail_results.extend(guardrail_results)
        record.specialist_diagnoses.append(diagnosis)
        for gr in guardrail_results:
            log(f"    evidence_guardrail: passed={gr.passed} violated_terms={gr.violated_terms or '[]'}")
        log(
            f"    diagnosis: confirmed={diagnosis.diagnosis.confirmed} "
            f"confidence={diagnosis.diagnosis.confidence:.2f} -> action={diagnosis.proposed_action.type}"
        )
        if diagnosis.diagnosis.confirmed:
            confirmed_diagnoses.append(diagnosis)

    log("[3.6 Action guardrail] reasoning-tier check over confirmed proposed actions...")
    action_guardrail_results = run_action_guardrail(shortage_case, confirmed_diagnoses, config)
    record.action_guardrail_results = action_guardrail_results
    passed_branches = {r.branch for r in action_guardrail_results if not r.guardrail_triggered}
    for r in action_guardrail_results:
        status = f"TRIGGERED — {r.reason}" if r.guardrail_triggered else "passed"
        log(f"    {r.branch:<18} {status}")
    guardrail_passed_diagnoses = [d for d in confirmed_diagnoses if d.branch in passed_branches]

    log("[3.7 Action synthesis] ranking guardrail-passed actions...")
    synthesis_result = synthesize(shortage_case, guardrail_passed_diagnoses, config)
    record.synthesis = synthesis_result
    if synthesis_result.recommended_action:
        ra = synthesis_result.recommended_action
        log(f"    recommended: branch={ra.branch} action={ra.action} cost_eur={ra.cost_eur:.2f} impact_tier={ra.impact_tier}")
    else:
        log("    no viable action found — nothing to approve or execute")

    escalated, escalation_reason = check_escalation(confirmed_diagnoses, synthesis_result)
    record.escalated_to_manual_review = escalated
    record.escalation_reason = escalation_reason

    if synthesis_result.recommended_action is not None:
        log("[3.8 Human checkpoint]")
        checkpoint = human_checkpoint.run_checkpoint(shortage_case, synthesis_result, config, input_fn=input_fn)
        record.checkpoint = checkpoint
        log(f"    impact_tier={checkpoint.impact_tier}  approvals={[(a.role, a.decision) for a in checkpoint.approvals]}  approved={checkpoint.approved}")

        if checkpoint.approved:
            log("[3.9 Execution]")
            exec_result = execution.execute(shortage_case, synthesis_result, checkpoint)
            record.execution = exec_result
            log(f"    EXECUTED action={exec_result.action_type} confirmation_id={exec_result.confirmation_id}")
        else:
            log("[3.9 Execution] SKIPPED — checkpoint was not approved")
    else:
        log(f"[Escalation → manual review] {escalation_reason}")
        log("[3.8/3.9 Human checkpoint / Execution] SKIPPED — case escalated to the standard manual procurement recovery process instead. The shortage risk is still open; it is not silently closed.")

    recurring_risk = case_log.compute_recurring_risk(shortage_case.part_number, config, shortage_case.triggered_at)
    record.recurring_risk = recurring_risk
    log(f"[3.10 Case log] recurring_risk={recurring_risk}  (persisting to SQLite)")
    case_log.save_case(record, config)

    return record


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scan the synthetic mock data for shortage cases and run each through the full pipeline."
    )
    parser.add_argument("--part", help="Only process this part_number, if it currently trips the trigger.")
    args = parser.parse_args()

    config = load_config()
    fired = scan_all_parts(config)
    if args.part:
        fired = [(c, h) for c, h in fired if c.part_number == args.part]

    if not fired:
        print("No shortage cases currently fire against the mock data.")
        print("Run `python generate_mock_data.py` to (re)generate fixtures, or see demo_scenarios.py.")
        return

    print(f"{len(fired)} shortage case(s) fired. Processing each end to end (real Anthropic API calls, interactive approvals)...")
    for shortage_case, horizon_decision in fired:
        process_case(shortage_case, horizon_decision, config)


if __name__ == "__main__":
    main()
