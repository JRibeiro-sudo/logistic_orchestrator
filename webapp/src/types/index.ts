/** Domain model for the Procurement Recovery Orchestrator.
 *  All data in this prototype is synthetic — see src/mocks/. */

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type CaseStatus =
  | 'detected'
  | 'investigating'
  | 'awaiting_approval'
  | 'recovering'
  | 'resolved'
  | 'escalated'

export type RootCause =
  | 'supplier_capacity'
  | 'upstream_supply'
  | 'transport'
  | 'demand_deviation'
  | 'unknown'

export type ActionType =
  | 'expedite_freight'
  | 'spot_buy'
  | 'capacity_request'
  | 'reallocate_plan'
  | 'none'

export type FactoryId = 'AVP' | 'MAN' | 'WER' | 'EIB'

export interface Factory {
  id: FactoryId
  name: string
  country: string
  linesAffectedToday: number
}

export interface Supplier {
  id: string
  name: string
  region: 'EU-West' | 'EU-East' | 'APAC' | 'NA'
  country: string
  leadTimeDays: number
  onTimeDeliveryPct: number
  recoverySuccessPct: number
  incidents12m: number
  qualityScore: number
  contacts: { name: string; role: string }[]
}

export interface RecoveryCase {
  id: string
  partNumber: string
  partName: string
  factoryId: FactoryId
  supplierId: string
  severity: Severity
  status: CaseStatus
  rootCause: RootCause
  coverageHours: number
  horizonHours: number
  affectedLines: string[]
  productionAtRiskUnits: number
  eta: string | null
  owner: string
  confidence: number
  estimatedCostEur: number
  estimatedSavingsEur: number
  recommendation: Recommendation | null
  createdAt: string
  updatedAt: string
  escalatedToManualReview: boolean
  escalationReason: string | null
  recurringRisk: boolean
  poId: string
  trackingNumber: string | null
}

export interface Recommendation {
  action: ActionType
  branch: RootCause
  summary: string
  costEur: number
  recoveryDays: number
  impactTier: 'low' | 'high'
  confidence: number
  requiredApprovers: string[]
}

export type TimelineEventKind =
  | 'trigger'
  | 'agent'
  | 'tool_call'
  | 'guardrail'
  | 'supplier_reply'
  | 'transport'
  | 'approval'
  | 'decision'
  | 'execution'
  | 'escalation'
  | 'note'

export interface TimelineEvent {
  id: string
  caseId: string
  kind: TimelineEventKind
  title: string
  detail: string
  actor: string
  at: string
  durationMin?: number
}

export type AgentId =
  | 'triage'
  | 'supplier_capacity'
  | 'upstream_supply'
  | 'transport'
  | 'demand_deviation'
  | 'action_guardrail'
  | 'synthesis'

export type AgentStatus = 'running' | 'idle' | 'waiting' | 'degraded'

export interface Agent {
  id: AgentId
  name: string
  description: string
  tier: 'fast' | 'reasoning' | 'deterministic'
  status: AgentStatus
  currentTask: string | null
  currentCaseId: string | null
  lastRunAt: string
  avgDurationSec: number
  successRatePct: number
  runsToday: number
  health: 'healthy' | 'warning' | 'error'
  dependencies: AgentId[]
}

export interface AgentRun {
  id: string
  agentId: AgentId
  caseId: string
  startedAt: string
  durationSec: number
  outcome: 'completed' | 'guardrail_blocked' | 'failed' | 'running'
  summary: string
  toolCalls: { tool: string; kind: 'read' | 'outbound'; result: string }[]
  confidence: number | null
}

export interface InvestigationStep {
  id: string
  caseId: string
  agentId: AgentId
  state: 'queued' | 'thinking' | 'tool_call' | 'done'
  title: string
  reasoningSummary: string
  evidence: string[]
  confidence: number | null
  at: string
}

export interface CaseMessage {
  id: string
  caseId: string
  channel: 'supplier_email' | 'internal' | 'system'
  from: string
  to: string
  subject: string
  body: string
  at: string
  guardrailChecked: boolean
}

export interface CaseDocument {
  id: string
  caseId: string
  name: string
  kind: 'po' | 'tracking' | 'quote' | 'report' | 'contract'
  sizeKb: number
  addedAt: string
  addedBy: string
}

export interface DecisionRecord {
  id: string
  caseId: string
  action: ActionType
  decision: 'approved' | 'rejected' | 'escalated' | 'more_analysis'
  role: string
  approver: string
  comment: string | null
  at: string
}

export interface AppNotification {
  id: string
  level: 'critical' | 'warning' | 'info' | 'approval'
  title: string
  body: string
  caseId: string | null
  at: string
  read: boolean
}

export interface ActivityItem {
  id: string
  icon: TimelineEventKind
  text: string
  caseId: string | null
  at: string
}

export interface KpiSnapshot {
  openCases: number
  criticalShortages: number
  productionRiskHours: number
  agentsRunning: number
  recoveredToday: number
  pendingSupplierReplies: number
  avgRecoveryHours: number
  savingsMtdEur: number
}

export interface KnowledgeArticle {
  id: string
  title: string
  category: 'playbook' | 'process' | 'supplier' | 'system'
  summary: string
  body: string[]
  updatedAt: string
  author: string
  tags: string[]
}

export interface SavedFilter {
  id: string
  name: string
  query: CaseFilterQuery
}

export interface CaseFilterQuery {
  search: string
  severities: Severity[]
  statuses: CaseStatus[]
  factories: FactoryId[]
  rootCauses: RootCause[]
}
