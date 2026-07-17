/** Service layer. Every data access goes through these interfaces so the
 *  mock implementations can later be swapped for SAP S/4HANA, supplier
 *  API, and messaging integrations without touching UI code. */

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
  KpiSnapshot,
  RecoveryCase,
  Supplier,
  TimelineEvent,
} from '@/types'
import {
  activity,
  agentRunsFor,
  agents,
  cases,
  decisionsFor,
  documentsFor,
  factories,
  investigationFor,
  knowledgeArticles,
  messagesFor,
  notifications,
  suppliers,
  timelineFor,
} from '@/mocks/data'
import { withLatency } from '@/lib/utils'

export interface CaseService {
  list(): Promise<RecoveryCase[]>
  get(id: string): Promise<RecoveryCase | undefined>
  timeline(id: string): Promise<TimelineEvent[]>
  investigation(id: string): Promise<InvestigationStep[]>
  messages(id: string): Promise<CaseMessage[]>
  documents(id: string): Promise<CaseDocument[]>
  decisions(id: string): Promise<DecisionRecord[]>
  kpis(): Promise<KpiSnapshot>
}

export interface AgentService {
  list(): Promise<Agent[]>
  runs(agentId: Agent['id']): Promise<AgentRun[]>
}

export interface SupplierService {
  list(): Promise<Supplier[]>
  get(id: string): Promise<Supplier | undefined>
}

export interface ReferenceService {
  factories(): Promise<Factory[]>
  knowledge(): Promise<KnowledgeArticle[]>
}

export interface NotificationService {
  list(): Promise<AppNotification[]>
  activity(): Promise<ActivityItem[]>
}

class MockCaseService implements CaseService {
  list() {
    return withLatency([...cases], 300)
  }
  get(id: string) {
    return withLatency(
      cases.find((c) => c.id === id),
      180,
    )
  }
  timeline(id: string) {
    const c = cases.find((x) => x.id === id)
    return withLatency(c ? timelineFor(c) : [], 220)
  }
  investigation(id: string) {
    const c = cases.find((x) => x.id === id)
    return withLatency(c ? investigationFor(c) : [], 260)
  }
  messages(id: string) {
    const c = cases.find((x) => x.id === id)
    return withLatency(c ? messagesFor(c) : [], 200)
  }
  documents(id: string) {
    const c = cases.find((x) => x.id === id)
    return withLatency(c ? documentsFor(c) : [], 160)
  }
  decisions(id: string) {
    const c = cases.find((x) => x.id === id)
    return withLatency(c ? decisionsFor(c) : [], 160)
  }
  kpis() {
    const open = cases.filter((c) => c.status !== 'resolved')
    const critical = open.filter((c) => c.severity === 'critical')
    const snapshot: KpiSnapshot = {
      openCases: open.length,
      criticalShortages: critical.length,
      productionRiskHours: Math.round(critical.reduce((s, c) => s + c.coverageHours, 0)),
      agentsRunning: agents.filter((a) => a.status === 'running').length,
      recoveredToday: 4,
      pendingSupplierReplies: 6,
      avgRecoveryHours: 31,
      savingsMtdEur: 214000,
    }
    return withLatency(snapshot, 240)
  }
}

class MockAgentService implements AgentService {
  list() {
    return withLatency([...agents], 220)
  }
  runs(agentId: Agent['id']) {
    return withLatency(agentRunsFor(agentId), 240)
  }
}

class MockSupplierService implements SupplierService {
  list() {
    return withLatency([...suppliers], 220)
  }
  get(id: string) {
    return withLatency(
      suppliers.find((s) => s.id === id),
      160,
    )
  }
}

class MockReferenceService implements ReferenceService {
  factories() {
    return withLatency([...factories], 120)
  }
  knowledge() {
    return withLatency([...knowledgeArticles], 200)
  }
}

class MockNotificationService implements NotificationService {
  list() {
    return withLatency([...notifications], 150)
  }
  activity() {
    return withLatency([...activity], 180)
  }
}

export const caseService: CaseService = new MockCaseService()
export const agentService: AgentService = new MockAgentService()
export const supplierService: SupplierService = new MockSupplierService()
export const referenceService: ReferenceService = new MockReferenceService()
export const notificationService: NotificationService = new MockNotificationService()
