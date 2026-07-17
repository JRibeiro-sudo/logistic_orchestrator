import { create } from 'zustand'
import type { CaseStatus, DecisionRecord, RecoveryCase } from '@/types'

/** Local mutation layer over the (immutable) mock dataset.
 *  Approvals/rejections update optimistically here; a real backend would
 *  reconcile these via the CaseService. */

export type ApprovalVerb = 'approve' | 'reject' | 'escalate' | 'more_analysis'

interface CaseMutationState {
  statusOverrides: Record<string, CaseStatus>
  extraDecisions: Record<string, DecisionRecord[]>
  act: (c: RecoveryCase, verb: ApprovalVerb, role: string, comment?: string) => void
}

const verbToStatus: Record<ApprovalVerb, CaseStatus> = {
  approve: 'recovering',
  reject: 'escalated',
  escalate: 'escalated',
  more_analysis: 'investigating',
}

const verbToDecision: Record<ApprovalVerb, DecisionRecord['decision']> = {
  approve: 'approved',
  reject: 'rejected',
  escalate: 'escalated',
  more_analysis: 'more_analysis',
}

export const useCaseMutations = create<CaseMutationState>((set) => ({
  statusOverrides: {},
  extraDecisions: {},
  act: (c, verb, role, comment) =>
    set((s) => ({
      statusOverrides: { ...s.statusOverrides, [c.id]: verbToStatus[verb] },
      extraDecisions: {
        ...s.extraDecisions,
        [c.id]: [
          ...(s.extraDecisions[c.id] ?? []),
          {
            id: `${c.id}-local-${Date.now()}`,
            caseId: c.id,
            action: c.recommendation?.action ?? 'none',
            decision: verbToDecision[verb],
            role,
            approver: 'You (Value Stream Manager)',
            comment: comment ?? null,
            at: new Date().toISOString(),
          },
        ],
      },
    })),
}))

export function applyOverrides(c: RecoveryCase, overrides: Record<string, CaseStatus>): RecoveryCase {
  const status = overrides[c.id]
  return status ? { ...c, status } : c
}
