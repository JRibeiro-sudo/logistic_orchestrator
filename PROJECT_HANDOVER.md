# Project Handover Document — Procurement Material Recovery Orchestrator

> **Purpose of this document.** Complete, self-contained handover for the
> Procurement Material Recovery Orchestrator project. It is written so that a
> person (or another AI assistant) with **no access to previous conversations**
> can understand the full project: what was built, why, how it works, what was
> deliberately left out, and where everything lives. Its primary consumer is
> the author of the final Executive MBA report.
>
> **Data notice (repeat this in any derived report).** This is a synthetic
> academic prototype. Every supplier name, part number, cost figure, KPI,
> person, and dataset in this repository is fictional and generated. Factory
> city names (Aveiro, Manisa, Wernau, Eibelshausen) identify sites only; no
> real Bosch data, supplier relationships, or ERP records are represented.

---

## 1. Overall product vision

An **agentic workflow** that recovers material shortages in a manufacturing
value stream faster than humans can, while keeping every consequential
decision in human hands. When projected material coverage for a part falls
below a safe horizon, the system automatically investigates *why* (supplier
capacity, upstream supply, transport, or demand deviation), gathers evidence
through enterprise tools, proposes a costed recovery action, checks that
action against guardrails, and then — always — stops for human approval before
anything is executed. The product's long-term home is the daily workflow of
supply-chain and procurement professionals, connected to SAP S/4HANA, supplier
APIs, carrier tracking, Teams/Outlook, and Jira; the prototype simulates all
of these behind clean interfaces.

The project deliberately positions itself as an **Agentic Workflow, not an
Autonomous Agent**. The governing rule, enforced in code rather than just
documentation:

> Any step that commits cost, makes a promise, or changes a plan requires
> human approval before execution. Any step that only gathers or reads
> information may run autonomously.

## 2. Business problem

The role context is a **Value Stream Manager at Bosch Home Comfort**
(production, logistics, procurement, material availability, shopfloor
management). Material shortages there follow a recurring, expensive pattern:

- A shortage is detected late (often when a line is already at risk).
- Root-cause triage is manual: phone calls, emails, ERP lookups across
  supplier, logistics, and planning silos.
- Each hour of delayed diagnosis narrows the recovery options and raises the
  cost of the ones that remain (expedite premiums, spot-buy prices, line-stop
  losses).
- Knowledge of "what worked last time" lives in people's heads.

The hypothesis the prototype tests: **the investigation phase (not the
decision phase) is automatable.** AI agents can compress hours of parallel
evidence-gathering into minutes, produce a ranked, costed recommendation, and
leave the human exactly one high-quality decision to make — with an audit
trail. Cost commitment, promises, and plan changes stay human.

## 3. Final architecture

The project has **three deliverables**, layered on each other:

1. **Python pipeline** (`procurement_orchestrator/`) — the actual agentic
   workflow: 10 pipeline stages + an escalation extension, real Anthropic API
   integration (model names via env vars), pydantic-validated structured
   outputs, SQLite case log, tests.
2. **Static demo artifacts** (`docs/`) — an animated, interactive diagram of
   the workflow (`index.html`) and a stage-by-stage trace report
   (`trace-report.html`), both self-contained HTML, hosted on GitHub Pages.
3. **Enterprise web application** (`webapp/`, built copy deployed at
   `docs/app/`) — a React/TypeScript frontend that presents the workflow as a
   product: dashboard, case management, approvals, agent monitoring,
   analytics. It runs on mocked data behind service interfaces designed to be
   swapped for real integrations.

### Pipeline stages (Python, the authoritative logic)

| # | Stage | Nature | Module |
|---|-------|--------|--------|
| 3.1 | Trigger — fires when projected coverage < applicable horizon | deterministic | `pipeline/trigger.py` |
| 3.2 | Lead-time band routing — horizon = 48 h for short lead time (≤ 7 days), `lead_time_days × 24 × 1.5` for long | deterministic, config-driven | `pipeline/lead_time_routing.py` |
| 3.3 | Root-cause triage — ranks 4 candidate causes with likelihoods | AI, fast/cheap tier (`TRIAGE_MODEL`) | `pipeline/triage.py` |
| 3.4 | Orchestrator dispatch — dispatches every cause ≥ 0.35 likelihood (configurable), logs why | deterministic | `pipeline/orchestrator.py` |
| 3.5a | Evidence gathering — each branch calls its own mocked enterprise tool | autonomous, logged | `pipeline/specialists/*` |
| 3.5b | Evidence guardrail — exclusion-list + other-supplier-name check on outbound messages, **before** send | deterministic | `pipeline/guardrails.py` |
| 3.5c | Diagnosis + action proposal — confirmed/confidence/explanation + one costed action | AI, reasoning tier (`REASONING_MODEL`) | specialists via `specialists/base.py` |
| 3.6 | Action guardrail — cross-checks all confirmed proposals for contradictions, missing costs, overcommitment | AI, reasoning tier, temperature 0 | `pipeline/guardrails.py` |
| 3.7 | Action synthesis — ranks guardrail-passed actions, picks one; **impact tier computed deterministically after the model** | AI + deterministic post-step | `pipeline/synthesis.py` |
| 3.8 | Human checkpoint — tiered approval (see §7) | human, CLI-simulated | `pipeline/human_checkpoint.py` |
| 3.9 | Execution — mocked SAP update / freight booking / spot buy / capacity request / plan reallocation | deterministic, hard-gated | `pipeline/execution.py` |
| 3.10 | Case log + recurring-risk flag (plain SQL count, not AI) | deterministic | `pipeline/case_log.py` |
| ext. | **Escalation to manual review** — when no viable automated action exists, the case is flagged and routed to the classic manual process instead of silently closed | deterministic | `pipeline/synthesis.py::check_escalation` |

Shared infrastructure: `schemas.py` (pydantic models for every structured
output — every LLM response is schema-validated, never string-matched),
`pipeline/llm_client.py` (single Anthropic SDK entry point; one corrective
retry turn on invalid JSON), `pipeline/data_access.py` (read layer over
synthetic fixtures), `config.yaml` (every threshold in one place),
`generate_mock_data.py` (seeded synthetic dataset generator, including three
hand-crafted `DEMO-PN-*` parts whose signals make each demo scenario
reproducible).

## 4. Multi-agent workflow

Seven agents cooperate per case, in three tiers:

```
        MRP Trigger (no AI)
              │
        ┌─────▼─────┐
        │  Triage    │  fast tier — runs on every case
        └─────┬─────┘
              │ dispatch (deterministic, threshold 0.35)
   ┌──────┬───┴────┬──────────┐          (1–4 branches in parallel*)
   ▼      ▼        ▼          ▼
Supplier Upstream Transport Demand      reasoning tier — evidence + diagnosis
Capacity  Supply             Deviation
   └──────┴───┬────┴──────────┘
        ┌─────▼─────┐
        │ Action     │  reasoning tier, temp 0 — all proposals together
        │ Guardrail  │
        └─────┬─────┘
        ┌─────▼─────┐
        │ Synthesis  │  reasoning tier — one recommendation
        └─────┬─────┘
     ┌────────┴────────┐
     ▼                 ▼
Human checkpoint   Escalation → manual review (when no viable action)
     │
     ▼
Execution (no AI, hard-gated) → Case log (SQLite)
```

\* Conceptually parallel; the prototype's `main.py` iterates the dispatched
branches sequentially for simplicity (see §14, Known limitations).

## 5. Every implemented agent and its responsibilities

| Agent | Tier | Responsibility | Tools (all mocked) | Outbound? |
|---|---|---|---|---|
| **Root-Cause Triage** | fast (`TRIAGE_MODEL`) | Rank likelihood (0–1) of exactly four causes from case signals: PO status, inbound delivery status, inventory-vs-system delta flag, consumption-vs-plan | none (signals pre-gathered) | no |
| **Supplier Capacity** | reasoning | Confirm/deny supplier-side capacity constraint; propose recovery (typically capacity request or spot buy) | `mock_send_supplier_email(template, po_id)` | **yes — fixed pre-approved template only**, evidence-guardrail-checked |
| **Upstream Supply** | reasoning | Confirm/deny upstream component gap via internal stakeholder | `mock_contact_internal_stakeholder(template, part_id)` | **yes — same template constraint** |
| **Transport** | reasoning | Confirm/deny carrier-side delay; propose expedite | `mock_carrier_tracking_lookup(tracking_number)` | no (read-only) |
| **Demand Deviation** | reasoning | Confirm/deny consumption-vs-plan deviation; propose plan reallocation | `mock_sap_query(part_id, "consumption_vs_plan")` | no (read-only) |
| **Action Guardrail** | reasoning, temp 0 | Review **all** confirmed proposals for one case together; block any that (1) commit beyond evidence, (2) lack a plausible cost, (3) contradict another branch's action | none | no |
| **Action Synthesis** | reasoning | Rank guardrail-passed actions by cost & confidence; output exactly one recommendation or `no_viable_action` | none | no |

Structural rules that apply to all agents:
- Every response is requested as JSON and validated against a pydantic schema;
  one corrective retry turn is allowed, then the call fails loudly.
- If a diagnosis is not confirmed, the proposed action **must** be `none`
  (enforced by a schema validator, not convention).
- Agents never free-write external messages; outbound contact uses fixed
  templates rendered with case variables.

## 6. Decision logic (deterministic rules, all in `config.yaml`)

- **Trigger**: fire when `projected_coverage_hours < horizon`.
  Coverage = stock ÷ daily consumption × 24.
- **Horizon rule table**: lead time ≤ 7 days → flat 48 h; > 7 days →
  `lead_time_days × 24 × 1.5` (multiplier configurable).
- **Dispatch**: every cause with likelihood ≥ 0.35 (configurable) gets its
  branch dispatched; scores and decisions are logged for audit.
- **Impact tier** (computed *after* the model, so a model cannot reclassify):
  estimated cost ≥ €2,000 → `high`; the `affects_committed_schedule` flag
  forces `high` regardless of cost; otherwise `low`.
- **Recurring risk**: plain SQL count — same part triggering ≥ 3 times within
  a trailing 90-day window sets `recurring_risk: true`. Informational only;
  never alters the pipeline.
- **Escalation**: whenever synthesis reports `no_viable_action` (either the
  guardrail blocked everything, or no branch confirmed a cause), the case is
  flagged `escalated_to_manual_review` with a specific reason and ownership
  moves to the classic manual process. The shortage risk is never silently
  dropped.

## 7. Human approval workflow

- **`low` impact tier** → one approval: the **planner** (fast path).
- **`high` impact tier** → three sequential role approvals: **procurement,
  production, logistics**.
- **All required roles are always asked, even after an earlier rejection** —
  every role's decision is logged; overall `approved` = AND of all decisions.
- No code path can skip the checkpoint. `pipeline/execution.py` refuses to run
  unless handed a `HumanCheckpointDecision` that (a) matches the exact
  `case_id` and (b) has `approved=True`; and `approved=True` can only exist on
  a decision carrying a non-empty, fully-approved list of logged
  `ApprovalRecord`s — this is a **pydantic validator on the schema itself**,
  so an unlogged rubber-stamp cannot even be constructed.
- The hard constraint is covered by `tests/test_hard_constraint.py`
  (runs without any API key).
- In the web app, the same flow appears as the Approve / Reject / Escalate /
  Request-more-analysis panel on Case Detail (optimistic, in-memory). In the
  animated diagram, the checkpoint pauses the simulation and waits for real
  Approve/Reject button clicks, one role at a time.

## 8. Technology stack

**Pipeline** — Python 3.11+, `anthropic` SDK (model IDs only from
`TRIAGE_MODEL` / `REASONING_MODEL` env vars; API key only from
`ANTHROPIC_API_KEY`; nothing hardcoded), `pydantic` v2, `PyYAML`, SQLite
(stdlib), `pytest` (16 tests, all passing, no API key required — LLM-dependent
paths are tested with a scripted fake client).

**Web app** — React 19, TypeScript (strict), Vite, Tailwind CSS (dark-first
CSS-variable token system), shadcn-style components on Radix primitives
(dialog, dropdown, tabs, tooltip), React Router (hash routing → deep links
work under GitHub Pages subpaths), Zustand (persisted UI prefs; non-persisted
case mutations), Recharts (with a colorblind-validated categorical palette,
checked programmatically in both themes), Framer Motion (180 ms route fades
only, honoring `prefers-reduced-motion`), Lucide icons, oxlint.

**Static artifacts** — plain HTML/CSS/JS, zero external requests
(fully self-contained; work offline).

## 9. Repository structure

```
logistic_orchestrator/                      (branch: claude/procurement-recovery-orchestrator-x7u3n9 — the default branch)
├── PROJECT_HANDOVER.md                     ← this document
├── procurement_orchestrator/               Python agentic pipeline
│   ├── config.yaml                         every threshold (horizons, 0.35 dispatch, €2,000 tier, 3×/90d recurring, guardrail exclusion list)
│   ├── generate_mock_data.py               seeded synthetic dataset + DEMO-PN-9001/9002/9003 scenario fixtures
│   ├── schemas.py                          pydantic models for every structured output
│   ├── pipeline/
│   │   ├── trigger.py  lead_time_routing.py  triage.py  orchestrator.py
│   │   ├── specialists/                    base.py + 4 branch modules + mock_tools.py
│   │   ├── guardrails.py                   evidence guardrail (deterministic) + action guardrail (AI)
│   │   ├── synthesis.py                    ranking + check_escalation()
│   │   ├── human_checkpoint.py  execution.py  case_log.py
│   │   └── llm_client.py  data_access.py  config_loader.py
│   ├── main.py                             live end-to-end runner (real API calls, interactive CLI approvals)
│   ├── demo_scenarios.py                   4 named scenarios (see §18)
│   ├── tests/                              hard-constraint, escalation, mocked-LLM pipeline tests
│   └── README.md                           module ↔ spec mapping
├── docs/                                   GitHub Pages site (served from /docs)
│   ├── index.html                          animated interactive diagram (§19)
│   ├── trace-report.html                   stage-by-stage trace report (§18)
│   └── app/                                built copy of the web application
└── webapp/                                 web application source
    ├── src/{types,constants,mocks,services,stores,hooks,components,pages}/
    ├── public/live-flow.html               the diagram, embedded unchanged (theme-sync shim only)
    └── README.md                           app architecture + deviations
```

## 10. UI pages and their purpose

| Route | Page | Purpose |
|---|---|---|
| `/` | **Dashboard** | Answers "what requires my attention?": 8 KPI tiles (open cases, critical shortages, production risk hours, agents running, recovered today, pending supplier replies, avg recovery time, savings MTD), attention list, severity breakdown, live agent widget, activity feed, upcoming deadlines |
| `/cases` | **Cases** | Professional case table: sort, search, severity/status/factory/root-cause filters, saved filters, column selection — all persisted |
| `/cases/:id` | **Case Detail** (core page) | Jira-issue-style header; tabs Overview / Timeline / Investigation / Documents / Messages / Decision History; sticky right panel with the current recommendation and Approve / Reject / Escalate / More-analysis buttons (optimistic) |
| `/timeline` | **Recovery Timeline** | Gantt-style lanes for the highest-severity active cases; 1 h / 4 h / 1 d / 1 w zoom; event markers colored by kind; NOW cursor |
| `/investigation` | **AI Investigation** | "Watch the agents work": case picker, structured reasoning steps with state (queued/thinking/tool_call/done), evidence chips, confidence meters, active-agents strip. Chain-of-thought is never shown — only structured summaries |
| `/agents` | **Agents** | One card per agent: status, current task, tier, health, success rate, avg duration, runs today, dependencies; click opens execution history with tool calls |
| `/live-flow` | **Live Recovery Flow** | The original animated diagram embedded unchanged (iframe), following the app theme |
| `/suppliers`, `/suppliers/:id` | **Supplier View** | Scorecards (on-time %, recovery success %, incidents, quality); profile with open cases, transport status, communication contacts, open actions, incident history |
| `/escalations` | **Escalations** | Queue of manual-review cases with guardrail reasons and manual owners |
| `/knowledge` | **Knowledge Base** | Searchable playbooks / process / system articles (e.g., the manual-review process, outbound message rules) |
| `/analytics` | **Analytics** | Executive dashboard, 9 charts: recovery-time trend, root causes, approval outcomes, supplier ranking, problematic materials, transport delays, financial impact, recovered production hours, agent success rate |
| `/settings` | **Settings** | Theme, keyboard shortcuts, synthetic-data notice, planned integrations (SAP S/4HANA, Teams, Outlook, SharePoint, Jira, supplier APIs) |

Global chrome: collapsible sidebar, breadcrumbs, notification center (grouped
Critical / Approval required / Warning / Info; clicking navigates to the
case), pinned + recent cases menu, Ctrl/⌘-K command palette (pages + case
search), theme toggle.

## 11. Final implemented features

**Pipeline**: all 10 spec stages; two-tier model usage; schema-validated
structured outputs everywhere; deterministic evidence guardrail with
exclusion list + other-supplier-name check; escalation-to-manual-review
extension; SQLite case log persisting the full trace; recurring-risk SQL
counter; synthetic data generator with reproducible demo fixtures; 16 tests
including the hard-constraint suite; 4 runnable demo scenarios.

**Web app**: 12 routes (above); optimistic approval mutations; skeleton
loaders on every async surface; persisted filters/columns/pins/theme;
keyboard chords (`g` then `d/c/t/i/a/n`) + command palette; skip-to-content
link and ARIA labeling; dark and light themes from one token system;
CVD-validated chart palette; lazy-loaded routes; zero-console-error verified
in a headless browser across all pages, including under the GitHub Pages
subpath.

**Artifacts**: interactive animated diagram (Start/Stop, real checkpoint
clicks, escalation path); trace report with three scenario walkthroughs and a
recurring-risk timeline; both cross-linked with the app.

## 12. Features intentionally NOT implemented

- **No real backend / persistence for the web app** — approvals reset on
  refresh (deliberate: every viewer gets the same reproducible demo state).
- **No real enterprise integrations** (SAP, Teams, Outlook, SharePoint, Jira,
  supplier/carrier APIs) — simulated behind service interfaces by design.
- **No authentication / roles** — the CLI and UI simulate approver roles
  without identity; a real deployment needs SSO + role-based approval rights.
- **No live LLM calls from the web app or diagram** — the browser artifacts
  replay pre-generated pipeline output (see §21); only the Python pipeline
  (`main.py`, `demo_scenarios.py`) makes real Anthropic API calls.
- **No autonomous execution of any kind** — out of scope on principle, not
  time: the classification as agentic workflow (not autonomous agent) is the
  thesis.
- **No mobile-first layouts** — desktop-first per the brief; pages degrade
  gracefully but are not optimized for phones.
- **No real-time push/streaming** — activity feeds and agent states are
  static snapshots of the mock dataset.

## 13. Assumptions

- Shortage detection can rely on MRP-style inputs (stock, consumption rate,
  supplier lead time) being available and reasonably fresh.
- Four root-cause categories cover the practically relevant space; anything
  else lands in "no confirmation → manual review".
- A fixed €2,000 cost threshold plus a committed-schedule flag is an
  acceptable first-order proxy for organizational impact tiers.
- Pre-approved message templates are sufficient for the evidence-gathering
  contact patterns (status requests); negotiation remains human.
- The `affects_committed_schedule` flag is provided as an input (stubbed
  boolean); in reality it would come from an APS/MRP system.
- Anthropic-hosted models are the reasoning engine; two tiers (fast/cheap for
  high-frequency triage, stronger for diagnosis/guardrail/synthesis) balance
  cost and quality.

## 14. Design decisions (and why)

1. **Guardrails split in two.** The evidence guardrail (outbound content) is
   deterministic — an exclusion list needs no model and must not be
   model-fallible. The action guardrail is a reasoning model at temperature 0
   because contradiction detection across proposals is a judgment task.
2. **Impact tier is computed after the model.** The synthesis model ranks and
   recommends, but the low/high classification that decides how many humans
   must approve is arithmetic on config values — a model cannot quietly
   downgrade a decision's scrutiny level.
3. **Schema-enforced honesty.** "Unconfirmed diagnosis ⇒ action must be
   `none`" and "approved ⇒ all logged approvals positive" are pydantic
   validators. Invalid states are unrepresentable rather than discouraged.
4. **Rejection ≠ closure.** A guardrail rejection routes to manual review with
   a reason; the risk stays open. (This was a mid-project correction — see
   §20.)
5. **All approvers are always polled** even after a rejection, so every
   role's position is on record — mirrors how cross-functional escalation
   meetings actually document dissent.
6. **Service-interface abstraction in the app.** UI code depends on
   `CaseService`/`AgentService`/`SupplierService`/… interfaces; the mock
   implementations (with artificial latency, so loading states are honest)
   are drop-in replaceable by real API clients.
7. **Hash routing** in the app so deep links survive static hosting under a
   repo subpath on GitHub Pages.
8. **The diagram was embedded, not rewritten** — it is a finished interactive
   artifact; porting it to React would have replaced it (forbidden by the
   brief) and added risk for zero user value.
9. **Deterministic seeded mock data** — every demo run and every visitor sees
   the same state; scenarios can be re-demonstrated indefinitely.

## 15. Known limitations

- Specialist branches run **sequentially** in the prototype's loop, though the
  architecture treats them as parallel; real parallelism (asyncio /
  task queue) is a straightforward future change.
- The demo scenarios' *shape* is engineered via crafted fixtures; the model's
  diagnosis text and cost estimates in live runs are genuine reasoning output
  and can vary between runs/model versions.
- Scenario 3 (guardrail rejection) **injects one clearly-labeled synthetic
  diagnosis** alongside live ones so the cross-branch contradiction check can
  be demonstrated deterministically; the guardrail evaluation itself is real.
- The web app's analytics are static synthetic series, not aggregations of
  the case dataset.
- Timestamps in the app are anchored to a fixed "NOW" (2026-07-17) so relative
  times stay coherent; they will read as stale in the future.
- GitHub Pages may pause builds for repos with no commits for over a year
  (one-click re-enable; repo content is unaffected).
- No load, security, or penetration testing — not production software.

## 16. Future roadmap

1. **Real integrations** behind the existing interfaces: SAP S/4HANA (stock,
   POs, consumption), carrier tracking APIs, supplier portals, Teams/Outlook
   for checkpoint notifications with deep links, Jira for escalated cases.
2. **Authentication + role model** so the three-role approval is enforced
   against real identities, with delegation and audit export.
3. **Parallel branch execution** and streaming progress into the app's
   Investigation page (replacing static snapshots with live agent events).
4. **Learning loop**: mine the case log for playbook suggestions (which
   actions worked, per cause/supplier), feeding the Knowledge Base.
5. **Recurring-risk → sourcing workflow**: auto-draft a sourcing-review task
   when the flag fires repeatedly for the same part.
6. **Cost model refinement**: replace the flat €2,000 tier with value-at-risk
   estimation (line-stop cost × probability) per case.
7. **Model evaluation harness**: regression-test diagnosis quality against a
   labeled scenario bank whenever the model version changes.

## 17. Screenshot references

No static screenshots are committed to the repository — the live pages are the
reference (they are deterministic, so screenshots are reproducible at any
time). For the report, capture from the GitHub Pages links in §18:

Recommended shots: ① app Dashboard (dark), ② Cases with a severity filter
active, ③ Case Detail with the approval panel visible, ④ AI Investigation,
⑤ Analytics grid, ⑥ Escalations, ⑦ the animated diagram mid-run at the
human checkpoint (Approve/Reject panel visible), ⑧ trace-report Scenario 3
showing the guardrail rejection and escalation.

## 18. GitHub Pages links + trace report description

Repository: `https://github.com/JRibeiro-sudo/logistic_orchestrator`
(public; working branch `claude/procurement-recovery-orchestrator-x7u3n9` is
the default branch; Pages serves the `/docs` folder from it).

- **Web application**: `https://jribeiro-sudo.github.io/logistic_orchestrator/app/`
- **Animated diagram**: `https://jribeiro-sudo.github.io/logistic_orchestrator/`
- **Trace report**: `https://jribeiro-sudo.github.io/logistic_orchestrator/trace-report.html`

All three cross-link in their headers. No login is required; everything runs
client-side.

**Trace report** (`trace-report.html`): a tabbed, stage-by-stage walkthrough
of three scenario executions, showing for every stage (3.1–3.10) the actual
structured data produced: trigger facts and horizon math, triage likelihood
bars with the dispatch threshold, specialist evidence and diagnoses
(the injected fixture in Scenario 3 is explicitly labeled), guardrail
verdicts with reasons, synthesis output with impact tier, the approval log
with roles and timestamps, execution confirmations, and the persisted case
record — plus a recurring-risk timeline showing the 3-triggers-in-90-days
flag firing. Scenarios: **(1)** low-impact transport delay → planner approves
→ executed; **(2)** high-impact supplier capacity issue with committed-
schedule flag → all three roles approve → executed; **(3)** contradictory
proposals → guardrail blocks both → no viable action → escalated to manual
review, no execution.

## 19. Animated workflow explanation

`docs/index.html` (also embedded in the app as **Live Recovery Flow**) is a
self-contained HTML/JS animation of the full pipeline graph: 13 nodes
(trigger, triage, dispatch, 4 specialist branches, action guardrail,
synthesis, human checkpoint, **manual review**, execution, case log) and 17
edges. Pressing **Start** plays the three scenarios back-to-back: edges pulse
while "calls" run, nodes show model badges (`TRIAGE_MODEL` /
`REASONING_MODEL`) and tool badges during simulated API/tool activity, and an
event log narrates every step. Two things are genuinely interactive:

- **The human checkpoint is real**: the animation pauses and waits for the
  viewer to click Approve or Reject per required role (1 click for the
  low-impact scenario, 3 sequential role clicks for the high-impact one).
  A rejection still polls remaining roles, then execution is refused with the
  hard-constraint message. The outcome shown is computed from the viewer's
  actual clicks.
- **Stop/replay** cleanly resets mid-run, including while waiting for a click.

Scenario 3 shows the guardrail blocking both contradictory proposals and the
case flowing to the Manual review node instead of dead-ending — the
escalation extension made visible.

Honest-labeling note: the underlying step data is real pipeline output
produced with a **scripted stand-in for the Anthropic client** (no API key is
embedded in a public web page); the deterministic wiring is live, the AI text
content is pre-generated. The same pipeline runs with real API calls via
`python demo_scenarios.py` given `ANTHROPIC_API_KEY`, `TRIAGE_MODEL`,
`REASONING_MODEL`.

## 20. Deviations from the original design

1. **Escalation instead of dead-end (behavioral change, stakeholder-driven).**
   The original spec ended a guardrail-rejected case with "no execution".
   Corrected mid-project: an unresolved shortage is still a live risk, so
   `check_escalation` now flags such cases `escalated_to_manual_review` with a
   reason and routes them to the classic manual process. Implemented in the
   Python pipeline (with tests), the diagram (Manual review node), and the app
   (Escalations page).
2. **Interactive (not simulated) human checkpoint in the diagram** — also
   stakeholder-driven: the viewer's real clicks decide the outcome.
3. **Case Detail is not a top-level nav item** (UI brief listed it as one):
   it is contextual, reached from Cases/dashboard/notifications/palette — a
   nav item pointing at "no case selected" would be a dead end.
4. **"Recommendations" is the permanent right-side panel** on Case Detail
   rather than a tab (the brief listed 8 tabs): the decision surface must stay
   visible while reading evidence. **"Agent Activity" merged into
   Investigation** — same records, one home. Net: 6 tabs + panel.
5. **Rejection keeps polling remaining approvers** (explicit stakeholder
   choice between stop-at-first-veto and poll-everyone; matches how
   cross-functional decisions are documented).
6. **Multi-role approval simulated as sequential CLI prompts / clicks** —
   the spec's intent (three role confirmations) kept, transport simplified.
7. **Scenario 3's injected diagnosis** (see §15) — determinism for the demo's
   contradiction, explicitly labeled everywhere it appears.
8. **Supplier "logos" are initial-based avatars** — real logos would violate
   the synthetic-data rule.
9. **`webapp/` lives at the repo root** next to `procurement_orchestrator/`
   and is deployed as a built copy under `docs/app/` (the brief didn't specify
   deployment; this reuses the existing Pages setup).

## 21. How to run everything (quick reference)

```bash
# Pipeline tests (no API key needed)
cd procurement_orchestrator && pip install -r requirements.txt
python -m pytest tests/ -v                      # 16 tests

# Live pipeline with real LLM calls
export ANTHROPIC_API_KEY=… TRIAGE_MODEL=… REASONING_MODEL=…
python generate_mock_data.py
python demo_scenarios.py all                    # or: low_impact | high_impact | guardrail_rejection | recurring_risk
python main.py                                  # live scan + interactive CLI approvals

# Web app
cd ../webapp && npm install
npm run dev                                     # local dev
npm run build:pages                             # rebuild the GitHub Pages copy into ../docs/app
```

Commit history tells the project story: initial pipeline → escalation
extension → Pages site (diagram + trace report) → webapp phases 1–4 →
Pages deployment of the app.
