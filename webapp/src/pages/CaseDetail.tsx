import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  FileText,
  Mail,
  Pin,
  PinOff,
  ShieldAlert,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, Progress, Separator, Skeleton } from '@/components/ui/misc'
import { ConfidenceMeter, SeverityBadge, StatusBadge } from '@/components/domain/badges'
import { useAsync } from '@/hooks/useAsync'
import { caseService } from '@/services'
import { suppliers } from '@/mocks/data'
import {
  ACTION_LABEL,
  AGENT_LABEL,
  EVENT_KIND_LABEL,
  FACTORY_LABEL,
  ROOT_CAUSE_LABEL,
} from '@/constants'
import { cn, formatDateTime, formatEur, relativeTime } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { applyOverrides, useCaseMutations, type ApprovalVerb } from '@/stores/cases'
import type { RecoveryCase, TimelineEventKind } from '@/types'

const kindTone: Partial<Record<TimelineEventKind, string>> = {
  trigger: 'bg-primary',
  guardrail: 'bg-warning',
  escalation: 'bg-destructive',
  approval: 'bg-success',
  execution: 'bg-success',
  supplier_reply: 'bg-[hsl(var(--chart-4))]',
}

function EventsList({ caseId }: { caseId: string }) {
  const { data: events, loading } = useAsync(() => caseService.timeline(caseId), [caseId])
  if (loading || !events)
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  return (
    <ol className="relative ml-2 space-y-4 border-l pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              'absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card',
              kindTone[e.kind] ?? 'bg-muted-foreground',
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13px] font-medium">{e.title}</span>
            <Badge variant="outline">{EVENT_KIND_LABEL[e.kind]}</Badge>
            <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
              {formatDateTime(e.at)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {e.actor}
            {e.durationMin ? ` · ${e.durationMin} min` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}

function InvestigationList({ caseId }: { caseId: string }) {
  const { data: steps, loading } = useAsync(() => caseService.investigation(caseId), [caseId])
  if (loading || !steps)
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  return (
    <div className="space-y-2.5">
      {steps.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex items-start gap-3 p-3">
            <span
              className={cn(
                'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                s.state === 'done'
                  ? 'bg-success/15 text-success'
                  : s.state === 'queued'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary/15 text-primary',
              )}
            >
              {s.state === 'done' ? <Check className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium">{s.title}</span>
                <Badge variant="outline">{AGENT_LABEL[s.agentId]}</Badge>
                <Badge
                  variant={s.state === 'done' ? 'success' : s.state === 'queued' ? 'default' : 'primary'}
                  className={cn(s.state === 'thinking' && 'animate-pulse')}
                >
                  {s.state.replace('_', ' ')}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.reasoningSummary}</p>
              {s.evidence.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.evidence.map((e) => (
                    <span key={e} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {s.confidence != null && <ConfidenceMeter value={s.confidence} className="mt-1 shrink-0" />}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MessagesList({ caseId }: { caseId: string }) {
  const { data: messages, loading } = useAsync(() => caseService.messages(caseId), [caseId])
  if (loading || !messages) return <Skeleton className="h-40 w-full" />
  if (messages.length === 0)
    return <p className="py-8 text-center text-xs text-muted-foreground">No messages yet.</p>
  return (
    <div className="space-y-2.5">
      {messages.map((m) => (
        <Card key={m.id}>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[13px] font-medium">{m.subject}</span>
              <Badge variant={m.channel === 'supplier_email' ? 'primary' : 'outline'}>
                {m.channel === 'supplier_email' ? 'Supplier' : m.channel === 'internal' ? 'Internal' : 'System'}
              </Badge>
              {m.guardrailChecked && <Badge variant="success">guardrail passed</Badge>}
              <span className="ml-auto text-2xs text-muted-foreground">{formatDateTime(m.at)}</span>
            </div>
            <div className="mt-1 text-2xs text-muted-foreground">
              {m.from} → {m.to}
            </div>
            <p className="mt-2 whitespace-pre-line text-xs">{m.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DocumentsList({ caseId }: { caseId: string }) {
  const { data: docs, loading } = useAsync(() => caseService.documents(caseId), [caseId])
  if (loading || !docs) return <Skeleton className="h-32 w-full" />
  return (
    <div className="divide-y rounded-lg border bg-card">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{d.name}</div>
            <div className="text-2xs text-muted-foreground">
              {d.kind.toUpperCase()} · {d.sizeKb} KB · added by {d.addedBy}
            </div>
          </div>
          <span className="text-2xs text-muted-foreground">{relativeTime(d.addedAt)}</span>
        </div>
      ))}
    </div>
  )
}

function DecisionHistory({ caseId }: { caseId: string }) {
  const { data: decisions, loading } = useAsync(() => caseService.decisions(caseId), [caseId])
  const extra = useCaseMutations((s) => s.extraDecisions[caseId] ?? [])
  if (loading || !decisions) return <Skeleton className="h-32 w-full" />
  const all = [...decisions, ...extra]
  if (all.length === 0)
    return <p className="py-8 text-center text-xs text-muted-foreground">No human decisions recorded yet.</p>
  return (
    <div className="divide-y rounded-lg border bg-card">
      {all.map((d) => (
        <div key={d.id} className="flex items-start gap-3 px-3 py-2.5">
          <span
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              d.decision === 'approved' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
            )}
          >
            {d.decision === 'approved' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">
              <span className="font-medium">{d.role}</span>{' '}
              <span className="text-muted-foreground">({d.approver})</span>{' '}
              <span
                className={cn('font-semibold', d.decision === 'approved' ? 'text-success' : 'text-destructive')}
              >
                {d.decision.replace('_', ' ')}
              </span>{' '}
              <span className="text-muted-foreground">{ACTION_LABEL[d.action]}</span>
            </div>
            {d.comment && <p className="mt-0.5 text-xs text-muted-foreground">“{d.comment}”</p>}
          </div>
          <span className="shrink-0 text-2xs text-muted-foreground">{formatDateTime(d.at)}</span>
        </div>
      ))}
    </div>
  )
}

function Overview({ c }: { c: RecoveryCase }) {
  const supplier = suppliers.find((s) => s.id === c.supplierId)
  const coveragePct = Math.min(100, (c.coverageHours / c.horizonHours) * 100)
  const rows: Array<[string, React.ReactNode]> = [
    ['Part number', <span key="pn" className="font-mono">{c.partNumber}</span>],
    ['Part name', c.partName],
    ['Factory', `${FACTORY_LABEL[c.factoryId]}`],
    [
      'Supplier',
      <Link key="sup" to={`/suppliers/${c.supplierId}`} className="text-primary hover:underline">
        {supplier?.name}
      </Link>,
    ],
    ['Purchase order', <span key="po" className="font-mono">{c.poId}</span>],
    ['Tracking', c.trackingNumber ? <span key="trk" className="font-mono">{c.trackingNumber}</span> : '—'],
    ['Root cause', ROOT_CAUSE_LABEL[c.rootCause]],
    ['Affected lines', c.affectedLines.join(', ')],
    ['Production at risk', `${c.productionAtRiskUnits.toLocaleString()} units`],
    ['Est. cost', formatEur(c.estimatedCostEur)],
    ['Created', formatDateTime(c.createdAt)],
    ['Last update', relativeTime(c.updatedAt)],
  ]
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Case facts</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-[13px]">
            {rows.map(([k, v]) => (
              <div key={k as string} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Material coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">{c.coverageHours.toFixed(1)}h</span>
              <span className="text-xs text-muted-foreground">horizon {c.horizonHours}h</span>
            </div>
            <Progress
              value={coveragePct}
              indicatorClassName={coveragePct < 33 ? 'bg-destructive' : coveragePct < 66 ? 'bg-warning' : 'bg-success'}
            />
            <p className="text-2xs text-muted-foreground">
              Coverage below the lead-time-banded horizon triggered this case automatically.
            </p>
          </CardContent>
        </Card>
        {c.escalatedToManualReview && (
          <Card className="border-destructive/40">
            <CardHeader className="flex-row items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <CardTitle className="text-destructive">Escalated to manual review</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{c.escalationReason}</p>
              </div>
            </CardHeader>
          </Card>
        )}
        {c.recurringRisk && (
          <Card className="border-warning/40">
            <CardHeader className="flex-row items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <CardTitle className="text-warning">Recurring risk</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  This part has triggered 3+ shortage cases within the trailing 90 days. Consider a
                  sourcing review.
                </p>
              </div>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  )
}

function ApprovalPanel({ c }: { c: RecoveryCase }) {
  const act = useCaseMutations((s) => s.act)
  const rec = c.recommendation
  const decidable = c.status === 'awaiting_approval' && rec != null

  const doAct = (verb: ApprovalVerb) => {
    const role = rec?.requiredApprovers[0] ?? 'Planner'
    act(c, verb, role)
  }

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle>Current recommendation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rec ? (
          <>
            <div>
              <Badge variant="primary" className="mb-1.5">
                {ACTION_LABEL[rec.action]}
              </Badge>
              <p className="text-xs text-muted-foreground">{rec.summary}</p>
            </div>
            <Separator />
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Estimated cost</dt>
                <dd className="font-medium tabular-nums">{formatEur(rec.costEur)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Recovery time</dt>
                <dd className="tabular-nums">{rec.recoveryDays} days</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Impact tier</dt>
                <dd>
                  <Badge variant={rec.impactTier === 'high' ? 'destructive' : 'success'}>
                    {rec.impactTier}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Confidence</dt>
                <dd>
                  <ConfidenceMeter value={rec.confidence} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Approvers</dt>
                <dd className="text-right">{rec.requiredApprovers.join(', ')}</dd>
              </div>
            </dl>
            <Separator />
            {decidable ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="success" onClick={() => doAct('approve')}>
                  <Check /> Approve
                </Button>
                <Button variant="destructive" onClick={() => doAct('reject')}>
                  <X /> Reject
                </Button>
                <Button variant="outline" onClick={() => doAct('escalate')}>
                  Escalate
                </Button>
                <Button variant="outline" onClick={() => doAct('more_analysis')}>
                  More analysis
                </Button>
              </div>
            ) : (
              <p className="text-2xs text-muted-foreground">
                {c.status === 'recovering' || c.status === 'resolved'
                  ? 'This recommendation was approved and executed. See Decision History.'
                  : c.status === 'escalated'
                    ? 'Case is in manual review — the recommendation is on hold.'
                    : 'No approval pending at this stage.'}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {c.escalatedToManualReview
              ? 'No automated recommendation — the guardrail blocked all proposals and the case is in manual review.'
              : 'The investigation has not produced a recommendation yet.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function CaseDetail() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const { data: raw, loading } = useAsync(() => caseService.get(caseId), [caseId])
  const statusOverrides = useCaseMutations((s) => s.statusOverrides)
  const pinned = useUIStore((s) => s.pinnedCaseIds.includes(caseId))
  const togglePinned = useUIStore((s) => s.togglePinned)
  const pushRecent = useUIStore((s) => s.pushRecent)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (raw) pushRecent(raw.id)
  }, [raw, pushRecent])

  const c = useMemo(() => (raw ? applyOverrides(raw, statusOverrides) : null), [raw, statusOverrides])

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (!c) {
    return (
      <div className="mx-auto max-w-[1400px] p-6">
        <p className="text-sm text-muted-foreground">Case {caseId} was not found.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/cases')}>
          <ArrowLeft /> Back to cases
        </Button>
      </div>
    )
  }

  const supplier = suppliers.find((s) => s.id === c.supplierId)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to cases" onClick={() => navigate('/cases')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold tracking-tight">{c.id}</h1>
            <SeverityBadge severity={c.severity} />
            <StatusBadge status={c.status} />
            {c.recurringRisk && <Badge variant="warning">recurring risk</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c.partName} · <span className="font-mono">{c.partNumber}</span> · {FACTORY_LABEL[c.factoryId]} ·{' '}
            {supplier?.name} · lines {c.affectedLines.join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Avatar name={c.owner} /> {c.owner}
          </span>
          <Button variant="outline" size="sm" onClick={() => togglePinned(c.id)}>
            {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {pinned ? 'Unpin' : 'Pin'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="investigation">Investigation</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="decisions">Decision History</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Overview c={c} />
          </TabsContent>
          <TabsContent value="timeline">
            <EventsList caseId={c.id} />
          </TabsContent>
          <TabsContent value="investigation">
            <InvestigationList caseId={c.id} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsList caseId={c.id} />
          </TabsContent>
          <TabsContent value="messages">
            <MessagesList caseId={c.id} />
          </TabsContent>
          <TabsContent value="decisions">
            <DecisionHistory caseId={c.id} />
          </TabsContent>
        </Tabs>
        <ApprovalPanel c={c} />
      </div>
    </div>
  )
}
