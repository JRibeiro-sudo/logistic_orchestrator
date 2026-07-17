import type {
  ActionType,
  AgentId,
  CaseStatus,
  FactoryId,
  RootCause,
  Severity,
  TimelineEventKind,
} from '@/types'

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']

export const STATUS_LABEL: Record<CaseStatus, string> = {
  detected: 'Detected',
  investigating: 'Investigating',
  awaiting_approval: 'Awaiting approval',
  recovering: 'Recovering',
  resolved: 'Resolved',
  escalated: 'Manual review',
}

export const STATUS_ORDER: CaseStatus[] = [
  'detected',
  'investigating',
  'awaiting_approval',
  'recovering',
  'resolved',
  'escalated',
]

export const ROOT_CAUSE_LABEL: Record<RootCause, string> = {
  supplier_capacity: 'Supplier capacity',
  upstream_supply: 'Upstream supply',
  transport: 'Transport',
  demand_deviation: 'Demand deviation',
  unknown: 'Undetermined',
}

export const ACTION_LABEL: Record<ActionType, string> = {
  expedite_freight: 'Expedite freight',
  spot_buy: 'Spot buy',
  capacity_request: 'Capacity request',
  reallocate_plan: 'Reallocate plan',
  none: 'No action',
}

export const FACTORY_LABEL: Record<FactoryId, string> = {
  AVP: 'Aveiro',
  MAN: 'Manisa',
  WER: 'Wernau',
  EIB: 'Eibelshausen',
}

export const AGENT_LABEL: Record<AgentId, string> = {
  triage: 'Root-Cause Triage',
  supplier_capacity: 'Supplier Capacity',
  upstream_supply: 'Upstream Supply',
  transport: 'Transport',
  demand_deviation: 'Demand Deviation',
  action_guardrail: 'Action Guardrail',
  synthesis: 'Action Synthesis',
}

export const EVENT_KIND_LABEL: Record<TimelineEventKind, string> = {
  trigger: 'Trigger',
  agent: 'Agent',
  tool_call: 'Tool call',
  guardrail: 'Guardrail',
  supplier_reply: 'Supplier reply',
  transport: 'Transport',
  approval: 'Approval',
  decision: 'Decision',
  execution: 'Execution',
  escalation: 'Escalation',
  note: 'Note',
}

export const SYNTHETIC_DATA_NOTICE =
  'Synthetic academic prototype. All suppliers, part numbers, quantities, and figures are fictional mock data — no real Bosch, supplier, or ERP data is shown.'
