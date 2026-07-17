/** Synthetic mock dataset for the Recovery Orchestrator prototype.
 *
 *  Everything here is generated, fictional data: supplier names, part
 *  numbers, quantities, costs, and people are invented. Factory city
 *  names identify sites only; no real plant data is represented.
 */

import type {
  ActivityItem,
  Agent,
  AgentRun,
  AppNotification,
  CaseDocument,
  CaseMessage,
  DecisionRecord,
  Factory,
  InvestigationStep,
  KnowledgeArticle,
  RecoveryCase,
  Recommendation,
  Supplier,
  TimelineEvent,
} from '@/types'
import { AGENT_LABEL } from '@/constants'
import { makePicker, mulberry32 } from './seed'

const rng = mulberry32(20260717)
const R = makePicker(rng)

/** Anchor "now" so relative timestamps stay coherent within a session. */
export const NOW = new Date('2026-07-17T14:30:00Z')

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString()

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
export const factories: Factory[] = [
  { id: 'AVP', name: 'Aveiro', country: 'Portugal', linesAffectedToday: 2 },
  { id: 'MAN', name: 'Manisa', country: 'Türkiye', linesAffectedToday: 1 },
  { id: 'WER', name: 'Wernau', country: 'Germany', linesAffectedToday: 0 },
  { id: 'EIB', name: 'Eibelshausen', country: 'Germany', linesAffectedToday: 1 },
]

// ---------------------------------------------------------------------------
// Suppliers (fictional companies)
// ---------------------------------------------------------------------------
const supplierSeed: Array<[string, Supplier['region'], string, number]> = [
  ['Meridian Componentes Lda', 'EU-West', 'Portugal', 4],
  ['Danubia Metallwerke GmbH', 'EU-East', 'Hungary', 7],
  ['Cobalt Motors & Drives OY', 'EU-West', 'Finland', 12],
  ['Anatolia Isı Sistemleri AŞ', 'EU-East', 'Türkiye', 5],
  ['Pacific Sensor Technologies Ltd', 'APAC', 'Taiwan', 21],
  ['Jangho Precision Co', 'APAC', 'South Korea', 28],
  ['Alpenland Dichtungen AG', 'EU-West', 'Austria', 3],
  ['Vistula Electronics Sp. z o.o.', 'EU-East', 'Poland', 9],
  ['Cascadia Polymer Corp', 'NA', 'USA', 18],
  ['Ibéria Tubos e Perfis SA', 'EU-West', 'Portugal', 6],
]

export const suppliers: Supplier[] = supplierSeed.map(([name, region, country, lead], i) => ({
  id: `SUP-${String(i + 1).padStart(3, '0')}`,
  name,
  region,
  country,
  leadTimeDays: lead,
  onTimeDeliveryPct: R.float(82, 99, 1),
  recoverySuccessPct: R.float(60, 97, 1),
  incidents12m: R.int(1, 14),
  qualityScore: R.float(3.1, 4.9, 1),
  contacts: [
    { name: 'Supply contact (synthetic)', role: 'Account Manager' },
    { name: 'Logistics contact (synthetic)', role: 'Logistics Coordinator' },
  ],
}))

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------
const partFamilies = [
  'Compressor Valve',
  'PCB Assembly',
  'Heat Exchanger Fin',
  'Motor Bracket',
  'NTC Sensor Module',
  'Gasket Set',
  'Fan Impeller',
  'Gas Manifold',
  'Expansion Vessel',
  'Control Panel Frame',
]

function makePartNumber(i: number): string {
  // ERP-style 10-digit ID, obviously synthetic block (9 999 ...)
  const tail = String(100000 + i * 137).slice(0, 6)
  return `9 999 ${tail.slice(0, 3)} ${tail.slice(3)}`
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const owners = ['M. Ferreira', 'A. Yilmaz', 'S. Krüger', 'J. Novak', 'L. Costa', 'R. Weber']

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
const statusPool = [
  'investigating',
  'awaiting_approval',
  'recovering',
  'resolved',
  'resolved',
  'detected',
  'escalated',
] as const

const causeByIndex = ['supplier_capacity', 'upstream_supply', 'transport', 'demand_deviation'] as const

function recommendationFor(
  cause: RecoveryCase['rootCause'],
  severity: RecoveryCase['severity'],
  confidence: number,
): Recommendation {
  const map: Record<string, { action: Recommendation['action']; summary: string; cost: [number, number]; days: [number, number] }> = {
    supplier_capacity: {
      action: 'capacity_request',
      summary: 'Request additional supplier shift and air-freight first completed lot.',
      cost: [3500, 14000],
      days: [3, 8],
    },
    upstream_supply: {
      action: 'spot_buy',
      summary: 'Spot buy from qualified alternate source to bridge upstream gap.',
      cost: [1800, 9000],
      days: [2, 6],
    },
    transport: {
      action: 'expedite_freight',
      summary: 'Re-route delayed shipment to expedited carrier service.',
      cost: [300, 1900],
      days: [1, 2],
    },
    demand_deviation: {
      action: 'reallocate_plan',
      summary: 'Rebalance production plan across lines until replenishment lands.',
      cost: [0, 800],
      days: [1, 3],
    },
  }
  const t = map[cause] ?? map.transport
  const cost = R.int(t.cost[0], t.cost[1])
  const high = cost >= 2000 || severity === 'critical'
  return {
    action: t.action,
    branch: cause === 'unknown' ? 'transport' : cause,
    summary: t.summary,
    costEur: cost,
    recoveryDays: R.int(t.days[0], t.days[1]),
    impactTier: high ? 'high' : 'low',
    confidence,
    requiredApprovers: high ? ['Procurement', 'Production', 'Logistics'] : ['Planner'],
  }
}

function buildCases(): RecoveryCase[] {
  const out: RecoveryCase[] = []
  for (let i = 0; i < 46; i++) {
    const supplier = suppliers[i % suppliers.length]
    const factory = factories[i % factories.length]
    const family = partFamilies[i % partFamilies.length]
    const status = statusPool[i % statusPool.length]
    const cause = status === 'detected' ? 'unknown' : causeByIndex[i % 4]
    const severity =
      status === 'escalated' || i % 9 === 0
        ? 'critical'
        : i % 4 === 1
          ? 'high'
          : i % 4 === 2
            ? 'medium'
            : 'low'
    const createdHoursAgo = R.int(2, 240)
    const confidence = status === 'detected' ? 0 : R.float(0.55, 0.96, 2)
    const escalated = status === 'escalated'
    const resolved = status === 'resolved'
    const coverage = severity === 'critical' ? R.float(4, 20, 1) : R.float(12, 70, 1)
    const horizon = supplier.leadTimeDays <= 7 ? 48 : supplier.leadTimeDays * 36
    const cost = R.int(200, 15000)

    out.push({
      id: `REC-2026-${String(1000 + i)}`,
      partNumber: makePartNumber(i),
      partName: `${family} ${String.fromCharCode(65 + (i % 6))}${R.int(10, 99)}`,
      factoryId: factory.id,
      supplierId: supplier.id,
      severity,
      status,
      rootCause: cause,
      coverageHours: coverage,
      horizonHours: horizon,
      affectedLines: [`L${R.int(1, 8)}`, ...(severity === 'critical' ? [`L${R.int(1, 8)}`] : [])],
      productionAtRiskUnits: severity === 'critical' ? R.int(2000, 14000) : R.int(100, 3500),
      eta: resolved ? null : hoursAhead(R.int(6, 96)),
      owner: owners[i % owners.length],
      confidence,
      estimatedCostEur: cost,
      estimatedSavingsEur: resolved ? R.int(4000, 60000) : 0,
      recommendation:
        status === 'awaiting_approval' || status === 'recovering' || resolved
          ? recommendationFor(cause, severity, confidence)
          : null,
      createdAt: hoursAgo(createdHoursAgo),
      updatedAt: hoursAgo(R.int(0, Math.min(createdHoursAgo, 24))),
      escalatedToManualReview: escalated,
      escalationReason: escalated
        ? 'Action guardrail blocked all confirmed proposals (cross-branch contradiction). Routed to standard manual recovery process.'
        : null,
      recurringRisk: i % 11 === 0,
      poId: `PO-45${String(6200 + i * 7)}`,
      trackingNumber: cause === 'transport' || R.chance(0.5) ? `TRK-${R.int(100000, 999999)}` : null,
    })
  }
  return out
}

export const cases: RecoveryCase[] = buildCases()

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
const runningCase = cases.find((c) => c.status === 'investigating')?.id ?? null

export const agents: Agent[] = [
  {
    id: 'triage',
    name: AGENT_LABEL.triage,
    description: 'Fast-tier model ranking likely root causes for every new shortage case.',
    tier: 'fast',
    status: 'running',
    currentTask: 'Ranking causes for new Aveiro shortage',
    currentCaseId: runningCase,
    lastRunAt: hoursAgo(0.1),
    avgDurationSec: 6,
    successRatePct: 99.2,
    runsToday: 31,
    health: 'healthy',
    dependencies: [],
  },
  {
    id: 'supplier_capacity',
    name: AGENT_LABEL.supplier_capacity,
    description: 'Contacts supplier with pre-approved templates and diagnoses capacity constraints.',
    tier: 'reasoning',
    status: 'running',
    currentTask: 'Awaiting supplier reply on PO-456242',
    currentCaseId: runningCase,
    lastRunAt: hoursAgo(0.4),
    avgDurationSec: 210,
    successRatePct: 93.1,
    runsToday: 9,
    health: 'healthy',
    dependencies: ['triage'],
  },
  {
    id: 'upstream_supply',
    name: AGENT_LABEL.upstream_supply,
    description: 'Checks upstream component availability with internal planning stakeholders.',
    tier: 'reasoning',
    status: 'idle',
    currentTask: null,
    currentCaseId: null,
    lastRunAt: hoursAgo(1.6),
    avgDurationSec: 145,
    successRatePct: 95.4,
    runsToday: 5,
    health: 'healthy',
    dependencies: ['triage'],
  },
  {
    id: 'transport',
    name: AGENT_LABEL.transport,
    description: 'Reads carrier tracking and diagnoses logistics delays.',
    tier: 'reasoning',
    status: 'running',
    currentTask: 'Tracking lookup TRK-882901',
    currentCaseId: cases.find((c) => c.rootCause === 'transport' && c.status === 'investigating')?.id ?? runningCase,
    lastRunAt: hoursAgo(0.05),
    avgDurationSec: 38,
    successRatePct: 98.8,
    runsToday: 14,
    health: 'healthy',
    dependencies: ['triage'],
  },
  {
    id: 'demand_deviation',
    name: AGENT_LABEL.demand_deviation,
    description: 'Compares actual consumption vs plan via ERP queries.',
    tier: 'reasoning',
    status: 'idle',
    currentTask: null,
    currentCaseId: null,
    lastRunAt: hoursAgo(2.4),
    avgDurationSec: 52,
    successRatePct: 97.6,
    runsToday: 7,
    health: 'healthy',
    dependencies: ['triage'],
  },
  {
    id: 'action_guardrail',
    name: AGENT_LABEL.action_guardrail,
    description: 'Reviews all proposed actions for contradictions, missing costs, and overcommitment.',
    tier: 'reasoning',
    status: 'waiting',
    currentTask: 'Queued: 2 proposals for REC-2026-1004',
    currentCaseId: 'REC-2026-1004',
    lastRunAt: hoursAgo(0.7),
    avgDurationSec: 74,
    successRatePct: 99.6,
    runsToday: 8,
    health: 'healthy',
    dependencies: ['supplier_capacity', 'upstream_supply', 'transport', 'demand_deviation'],
  },
  {
    id: 'synthesis',
    name: AGENT_LABEL.synthesis,
    description: 'Ranks guardrail-passed actions and prepares one recommendation for approval.',
    tier: 'reasoning',
    status: 'idle',
    currentTask: null,
    currentCaseId: null,
    lastRunAt: hoursAgo(0.9),
    avgDurationSec: 61,
    successRatePct: 98.9,
    runsToday: 8,
    health: 'warning',
    dependencies: ['action_guardrail'],
  },
]

// ---------------------------------------------------------------------------
// Per-case artifacts: timeline, investigation, runs, messages, docs, decisions
// ---------------------------------------------------------------------------
function caseAgeHours(c: RecoveryCase): number {
  return (NOW.getTime() - new Date(c.createdAt).getTime()) / 3_600_000
}

export function timelineFor(c: RecoveryCase): TimelineEvent[] {
  const age = caseAgeHours(c)
  const t = (fraction: number) => hoursAgo(age * (1 - fraction))
  const supplier = suppliers.find((s) => s.id === c.supplierId)
  const events: TimelineEvent[] = [
    {
      id: `${c.id}-e1`,
      caseId: c.id,
      kind: 'trigger',
      title: 'Shortage detected',
      detail: `Projected coverage ${c.coverageHours.toFixed(1)}h fell below the ${c.horizonHours}h horizon.`,
      actor: 'MRP Trigger',
      at: t(0),
    },
    {
      id: `${c.id}-e2`,
      caseId: c.id,
      kind: 'agent',
      title: 'Root-cause triage completed',
      detail: 'Fast-tier model ranked four candidate causes; orchestrator dispatched investigation branches.',
      actor: 'Triage Agent',
      at: t(0.05),
      durationMin: 1,
    },
  ]
  if (c.status === 'detected') return events

  events.push(
    {
      id: `${c.id}-e3`,
      caseId: c.id,
      kind: 'tool_call',
      title: c.rootCause === 'transport' ? 'Carrier tracking lookup' : 'Supplier status request sent',
      detail:
        c.rootCause === 'transport'
          ? `Tracking ${c.trackingNumber ?? 'n/a'} queried — carrier reports delay at hub.`
          : `Pre-approved template sent to ${supplier?.name ?? 'supplier'} for ${c.poId}.`,
      actor: `${AGENT_LABEL[c.rootCause === 'unknown' ? 'transport' : (c.rootCause as Exclude<RecoveryCase['rootCause'], 'unknown'>)]} Agent`,
      at: t(0.12),
      durationMin: 3,
    },
    {
      id: `${c.id}-e4`,
      caseId: c.id,
      kind: 'supplier_reply',
      title: 'Supplier replied',
      detail: 'Simulated supplier confirmed status and revised dates for open order.',
      actor: supplier?.name ?? 'Supplier',
      at: t(0.3),
    },
    {
      id: `${c.id}-e5`,
      caseId: c.id,
      kind: 'guardrail',
      title: c.escalatedToManualReview ? 'Action guardrail BLOCKED proposals' : 'Action guardrail passed',
      detail: c.escalatedToManualReview
        ? c.escalationReason ?? 'Guardrail triggered.'
        : 'No contradictions, cost estimates present, commitments within evidence.',
      actor: 'Action Guardrail',
      at: t(0.45),
      durationMin: 2,
    },
  )

  if (c.escalatedToManualReview) {
    events.push({
      id: `${c.id}-e6`,
      caseId: c.id,
      kind: 'escalation',
      title: 'Escalated to manual review',
      detail: 'No viable automated action. Case routed to standard manual recovery process; risk stays open.',
      actor: 'Orchestrator',
      at: t(0.5),
    })
    return events
  }

  if (c.recommendation) {
    events.push({
      id: `${c.id}-e7`,
      caseId: c.id,
      kind: 'decision',
      title: 'Recommendation synthesized',
      detail: `${c.recommendation.summary} (€${c.recommendation.costEur.toLocaleString()}, ${c.recommendation.impactTier} impact)`,
      actor: 'Synthesis Agent',
      at: t(0.55),
      durationMin: 2,
    })
  }
  if (c.status === 'awaiting_approval') {
    events.push({
      id: `${c.id}-e8`,
      caseId: c.id,
      kind: 'approval',
      title: 'Awaiting human approval',
      detail: `Required approvers: ${c.recommendation?.requiredApprovers.join(', ') ?? 'Planner'}.`,
      actor: 'Human Checkpoint',
      at: t(0.6),
    })
  }
  if (c.status === 'recovering' || c.status === 'resolved') {
    events.push(
      {
        id: `${c.id}-e9`,
        caseId: c.id,
        kind: 'approval',
        title: 'Approved at human checkpoint',
        detail: `${c.recommendation?.requiredApprovers.join(', ')} approved the recommended action.`,
        actor: 'Human Checkpoint',
        at: t(0.65),
      },
      {
        id: `${c.id}-e10`,
        caseId: c.id,
        kind: 'execution',
        title: 'Recovery action executed',
        detail: `${c.recommendation ? c.recommendation.summary : 'Action executed.'} Confirmation logged to ERP.`,
        actor: 'Execution',
        at: t(0.7),
        durationMin: 5,
      },
      {
        id: `${c.id}-e11`,
        caseId: c.id,
        kind: 'transport',
        title: 'Replenishment in transit',
        detail: 'Expedited shipment confirmed by carrier; milestone updates subscribed.',
        actor: 'Carrier (synthetic)',
        at: t(0.8),
      },
    )
  }
  if (c.status === 'resolved') {
    events.push({
      id: `${c.id}-e12`,
      caseId: c.id,
      kind: 'note',
      title: 'Case resolved',
      detail: `Coverage restored above horizon. Estimated ${(c.estimatedSavingsEur / 1000).toFixed(0)}k€ production loss avoided.`,
      actor: c.owner,
      at: t(0.95),
    })
  }
  return events
}

export function investigationFor(c: RecoveryCase): InvestigationStep[] {
  const age = caseAgeHours(c)
  const t = (f: number) => hoursAgo(age * (1 - f))
  const activeCause = c.rootCause === 'unknown' ? 'transport' : c.rootCause
  const steps: InvestigationStep[] = [
    {
      id: `${c.id}-i1`,
      caseId: c.id,
      agentId: 'triage',
      state: 'done',
      title: 'Rank candidate root causes',
      reasoningSummary:
        'Signals reviewed: PO status, inbound tracking, inventory delta flag, consumption vs plan. Produced likelihood ranking across the four standard causes.',
      evidence: [`PO ${c.poId} status`, 'Inbound delivery status', 'Consumption vs plan (30d)'],
      confidence: 0.9,
      at: t(0.05),
    },
    {
      id: `${c.id}-i2`,
      caseId: c.id,
      agentId: activeCause,
      state: c.status === 'investigating' ? 'tool_call' : 'done',
      title:
        activeCause === 'transport'
          ? 'Query carrier tracking'
          : activeCause === 'demand_deviation'
            ? 'Query ERP consumption vs plan'
            : 'Contact supplier / stakeholder (pre-approved template)',
      reasoningSummary:
        'Evidence gathering via mocked enterprise tool. Outbound messages pass the evidence guardrail (exclusion list + supplier-name check) before send.',
      evidence:
        activeCause === 'transport'
          ? [`Tracking ${c.trackingNumber ?? '—'}`, 'Carrier hub status', 'Revised ETA']
          : [`Template message for ${c.poId}`, 'Guardrail check: passed', 'Simulated reply'],
      confidence: c.status === 'investigating' ? null : c.confidence,
      at: t(0.2),
    },
    {
      id: `${c.id}-i3`,
      caseId: c.id,
      agentId: activeCause,
      state: c.status === 'investigating' ? 'thinking' : 'done',
      title: 'Diagnose and propose action',
      reasoningSummary:
        c.status === 'investigating'
          ? 'Reasoning-tier model evaluating gathered evidence against shortage profile…'
          : `Diagnosis confirmed (${Math.round(c.confidence * 100)}% confidence). One recovery action proposed with cost and recovery-time estimate.`,
      evidence: c.recommendation ? [`Proposed: ${c.recommendation.summary}`] : ['Pending'],
      confidence: c.status === 'investigating' ? null : c.confidence,
      at: t(0.35),
    },
    {
      id: `${c.id}-i4`,
      caseId: c.id,
      agentId: 'action_guardrail',
      state: c.status === 'investigating' || c.status === 'detected' ? 'queued' : 'done',
      title: 'Cross-check proposed actions',
      reasoningSummary: c.escalatedToManualReview
        ? 'Contradictory proposals detected across branches. All blocked; case escalated to manual review.'
        : 'Checked contradictions, missing costs, unsupported commitments across all confirmed proposals.',
      evidence: c.escalatedToManualReview ? ['Cross-branch contradiction'] : ['No violations found'],
      confidence: c.escalatedToManualReview ? 0.97 : 0.95,
      at: t(0.5),
    },
    {
      id: `${c.id}-i5`,
      caseId: c.id,
      agentId: 'synthesis',
      state:
        c.status === 'awaiting_approval' || c.status === 'recovering' || c.status === 'resolved'
          ? 'done'
          : 'queued',
      title: 'Synthesize single recommendation',
      reasoningSummary: c.recommendation
        ? `Ranked candidates by cost and confidence. Recommended: ${c.recommendation.summary}`
        : 'Waiting on guardrail-passed proposals.',
      evidence: c.recommendation
        ? [`€${c.recommendation.costEur.toLocaleString()}`, `${c.recommendation.recoveryDays}d recovery`, `${c.recommendation.impactTier} impact tier`]
        : [],
      confidence: c.recommendation ? c.recommendation.confidence : null,
      at: t(0.55),
    },
  ]
  return steps
}

export function agentRunsFor(agentId: Agent['id']): AgentRun[] {
  const related = cases.filter((c) => c.status !== 'detected').slice(0, 24)
  return related.slice(0, 10).map((c, i) => ({
    id: `${agentId}-run-${i}`,
    agentId,
    caseId: c.id,
    startedAt: hoursAgo(i * 2 + 0.5),
    durationSec: R.int(20, 400),
    outcome: c.escalatedToManualReview && agentId === 'action_guardrail' ? 'guardrail_blocked' : 'completed',
    summary:
      agentId === 'action_guardrail'
        ? c.escalatedToManualReview
          ? 'Blocked contradictory proposals'
          : 'All proposals passed'
        : `Processed ${c.id} (${c.partName})`,
    toolCalls:
      agentId === 'transport'
        ? [{ tool: 'carrier_tracking_lookup', kind: 'read', result: 'delayed_at_hub' }]
        : agentId === 'supplier_capacity'
          ? [{ tool: 'send_supplier_email', kind: 'outbound', result: 'sent (guardrail passed)' }]
          : [{ tool: 'erp_query', kind: 'read', result: 'ok' }],
    confidence: R.float(0.6, 0.97, 2),
  }))
}

export function messagesFor(c: RecoveryCase): CaseMessage[] {
  const supplier = suppliers.find((s) => s.id === c.supplierId)
  if (c.status === 'detected') return []
  return [
    {
      id: `${c.id}-m1`,
      caseId: c.id,
      channel: 'supplier_email',
      from: 'recovery-orchestrator@synthetic.example',
      to: `orders@${(supplier?.name ?? 'supplier').split(' ')[0].toLowerCase()}.example`,
      subject: `Delivery status request — ${c.poId}`,
      body: `Hello,\n\nWe are requesting an updated capacity and delivery status for ${c.poId} (part ${c.partNumber}). Please confirm your current production capacity and expected ship date.\n\nThank you.`,
      at: hoursAgo(caseAgeHours(c) * 0.85),
      guardrailChecked: true,
    },
    {
      id: `${c.id}-m2`,
      caseId: c.id,
      channel: 'supplier_email',
      from: `orders@${(supplier?.name ?? 'supplier').split(' ')[0].toLowerCase()}.example`,
      to: 'recovery-orchestrator@synthetic.example',
      subject: `RE: Delivery status request — ${c.poId}`,
      body: 'Confirming receipt. Current status attached; revised ship date proposed. (Synthetic supplier reply.)',
      at: hoursAgo(caseAgeHours(c) * 0.7),
      guardrailChecked: false,
    },
    {
      id: `${c.id}-m3`,
      caseId: c.id,
      channel: 'internal',
      from: c.owner,
      to: 'Value Stream Team',
      subject: `Heads-up: ${c.partName} coverage`,
      body: `Tracking recovery for ${c.id}. Current plan holds if replenishment lands before ${c.eta ? new Date(c.eta).toLocaleDateString() : 'EOW'}.`,
      at: hoursAgo(caseAgeHours(c) * 0.4),
      guardrailChecked: false,
    },
  ]
}

export function documentsFor(c: RecoveryCase): CaseDocument[] {
  const docs: CaseDocument[] = [
    {
      id: `${c.id}-d1`,
      caseId: c.id,
      name: `${c.poId}.pdf`,
      kind: 'po',
      sizeKb: R.int(60, 240),
      addedAt: c.createdAt,
      addedBy: 'System',
    },
    {
      id: `${c.id}-d2`,
      caseId: c.id,
      name: 'shortage-analysis.xlsx',
      kind: 'report',
      sizeKb: R.int(20, 90),
      addedAt: hoursAgo(caseAgeHours(c) * 0.5),
      addedBy: c.owner,
    },
  ]
  if (c.trackingNumber) {
    docs.push({
      id: `${c.id}-d3`,
      caseId: c.id,
      name: `${c.trackingNumber}-milestones.pdf`,
      kind: 'tracking',
      sizeKb: R.int(15, 60),
      addedAt: hoursAgo(caseAgeHours(c) * 0.3),
      addedBy: 'Transport Agent',
    })
  }
  return docs
}

export function decisionsFor(c: RecoveryCase): DecisionRecord[] {
  if (!(c.status === 'recovering' || c.status === 'resolved') || !c.recommendation) return []
  const base = caseAgeHours(c) * 0.65
  return c.recommendation.requiredApprovers.map((role, i) => ({
    id: `${c.id}-dec-${i}`,
    caseId: c.id,
    action: c.recommendation!.action,
    decision: 'approved',
    role,
    approver: `${role} (simulated)`,
    comment: i === 0 ? 'Cost acceptable vs line-stop risk.' : null,
    at: hoursAgo(base - i * 0.2),
  }))
}

// ---------------------------------------------------------------------------
// Notifications + activity
// ---------------------------------------------------------------------------
export const notifications: AppNotification[] = [
  {
    id: 'n1',
    level: 'approval',
    title: 'Approval required — REC-2026-1001',
    body: 'High-impact capacity request (€8.4k) needs cross-functional sign-off.',
    caseId: 'REC-2026-1001',
    at: hoursAgo(0.4),
    read: false,
  },
  {
    id: 'n2',
    level: 'critical',
    title: 'Critical shortage at Aveiro',
    body: 'NTC Sensor Module coverage below 8h. Investigation running.',
    caseId: 'REC-2026-1009',
    at: hoursAgo(1.1),
    read: false,
  },
  {
    id: 'n3',
    level: 'warning',
    title: 'Guardrail blocked proposals',
    body: 'REC-2026-1006 escalated to manual review — contradictory branch actions.',
    caseId: 'REC-2026-1006',
    at: hoursAgo(2.5),
    read: false,
  },
  {
    id: 'n4',
    level: 'info',
    title: 'Supplier reply received',
    body: 'Danubia Metallwerke confirmed revised ship date for PO-456214.',
    caseId: 'REC-2026-1002',
    at: hoursAgo(3.2),
    read: true,
  },
  {
    id: 'n5',
    level: 'info',
    title: 'Recovery completed',
    body: 'REC-2026-1003 resolved. Estimated €38k production loss avoided.',
    caseId: 'REC-2026-1003',
    at: hoursAgo(5.9),
    read: true,
  },
]

export const activity: ActivityItem[] = [
  { id: 'a1', icon: 'agent', text: 'Transport agent confirmed carrier delay for REC-2026-1010', caseId: 'REC-2026-1010', at: hoursAgo(0.1) },
  { id: 'a2', icon: 'approval', text: 'Planner approved expedite freight on REC-2026-1014', caseId: 'REC-2026-1014', at: hoursAgo(0.6) },
  { id: 'a3', icon: 'supplier_reply', text: 'Anatolia Isı Sistemleri replied on PO-456221', caseId: 'REC-2026-1003', at: hoursAgo(1.2) },
  { id: 'a4', icon: 'guardrail', text: 'Action guardrail passed 2 proposals for REC-2026-1008', caseId: 'REC-2026-1008', at: hoursAgo(1.8) },
  { id: 'a5', icon: 'trigger', text: 'New shortage detected — Gasket Set B44 at Eibelshausen', caseId: 'REC-2026-1005', at: hoursAgo(2.3) },
  { id: 'a6', icon: 'execution', text: 'Spot buy executed for REC-2026-1017 (€3.1k)', caseId: 'REC-2026-1017', at: hoursAgo(3.4) },
  { id: 'a7', icon: 'escalation', text: 'REC-2026-1006 escalated to manual review', caseId: 'REC-2026-1006', at: hoursAgo(4.1) },
  { id: 'a8', icon: 'transport', text: 'Expedited shipment departed hub for REC-2026-1014', caseId: 'REC-2026-1014', at: hoursAgo(5.0) },
]

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------
export const knowledgeArticles: KnowledgeArticle[] = [
  {
    id: 'kb1',
    title: 'Recovery playbook: transport delays',
    category: 'playbook',
    summary: 'Standard decision tree for carrier-side delays, from tracking signal to expedite approval.',
    body: [
      'Confirm the delay with a direct carrier tracking read before contacting the supplier — a delayed PO with a confirmed supplier ship date is a transport case, not a capacity case.',
      'Expedite freight is warranted when the value-at-risk of a line stop exceeds 4× the expedite premium and coverage is below the site horizon.',
      'Below €2,000 estimated cost, planner approval suffices. Above, cross-functional sign-off (procurement, production, logistics) is mandatory — the orchestrator enforces this tier automatically.',
    ],
    updatedAt: hoursAgo(72),
    author: 'M. Ferreira',
    tags: ['transport', 'expedite', 'approval-tiers'],
  },
  {
    id: 'kb2',
    title: 'When the guardrail blocks everything: manual review process',
    category: 'process',
    summary: 'What happens after an escalation, and who owns the case next.',
    body: [
      'A guardrail rejection is not case closure. The shortage risk remains open and the case is flagged escalated_to_manual_review with a reason.',
      'Ownership transfers to the value-stream planner, who runs the classic manual troubleshooting process and records the outcome back on the case.',
      'Common triggers: contradictory branch proposals, missing cost estimates, commitments beyond evidence.',
    ],
    updatedAt: hoursAgo(120),
    author: 'S. Krüger',
    tags: ['guardrail', 'escalation', 'process'],
  },
  {
    id: 'kb3',
    title: 'Outbound message rules (evidence guardrail)',
    category: 'system',
    summary: 'Why agents only send pre-approved templates, and what the exclusion list covers.',
    body: [
      'Agents never free-write external messages. Outbound supplier/internal contact uses fixed templates rendered with case variables.',
      'The evidence guardrail rejects any rendered message containing internal cost figures, other supplier names, or commitment language — the send is blocked and logged.',
      'This runs before any send, deterministically, with no model involvement.',
    ],
    updatedAt: hoursAgo(200),
    author: 'R. Weber',
    tags: ['guardrail', 'templates', 'compliance'],
  },
  {
    id: 'kb4',
    title: 'Supplier scorecard methodology',
    category: 'supplier',
    summary: 'How on-time delivery, recovery success, and incident counts feed severity weighting.',
    body: [
      'Supplier scores are rolling 12-month figures. Recovery success measures the share of incidents resolved without a line stop.',
      'Repeated triggers on the same part within 90 days raise a recurring-risk flag on new cases — informational, but a strong signal for sourcing review.',
    ],
    updatedAt: hoursAgo(300),
    author: 'A. Yilmaz',
    tags: ['supplier', 'scorecard', 'recurring-risk'],
  },
]
