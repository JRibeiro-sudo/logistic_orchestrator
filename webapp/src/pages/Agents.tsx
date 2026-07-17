import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Bot, Clock } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton, Separator } from '@/components/ui/misc'
import { useAsync } from '@/hooks/useAsync'
import { agentService } from '@/services'
import { AGENT_LABEL } from '@/constants'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'
import type { Agent, AgentStatus } from '@/types'

const statusMeta: Record<AgentStatus, { label: string; dot: string; badge: 'success' | 'warning' | 'default' | 'destructive' }> = {
  running: { label: 'Running', dot: 'animate-pulse bg-success', badge: 'success' },
  waiting: { label: 'Waiting', dot: 'bg-warning', badge: 'warning' },
  idle: { label: 'Idle', dot: 'bg-muted-foreground/40', badge: 'default' },
  degraded: { label: 'Degraded', dot: 'bg-destructive', badge: 'destructive' },
}

function AgentRunsDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { data: runs, loading } = useAsync(() => agentService.runs(agent.id), [agent.id])
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{agent.name} — execution history</DialogTitle>
          <DialogDescription>Last {runs?.length ?? '…'} runs (synthetic).</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {loading || !runs
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            : runs.map((run) => (
                <div key={run.id} className="rounded-md border bg-background p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/cases/${run.caseId}`} className="text-xs font-medium text-primary hover:underline">
                      {run.caseId}
                    </Link>
                    <Badge
                      variant={
                        run.outcome === 'completed'
                          ? 'success'
                          : run.outcome === 'guardrail_blocked'
                            ? 'warning'
                            : run.outcome === 'failed'
                              ? 'destructive'
                              : 'primary'
                      }
                    >
                      {run.outcome.replace('_', ' ')}
                    </Badge>
                    <span className="ml-auto text-2xs text-muted-foreground">
                      {formatDateTime(run.startedAt)} · {run.durationSec}s
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{run.summary}</p>
                  {run.toolCalls.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {run.toolCalls.map((t, i) => (
                        <span key={i} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                          {t.tool} → {t.result}
                          {t.kind === 'outbound' && ' (outbound)'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Agents() {
  const { data: agents, loading } = useAsync(() => agentService.list(), [])
  const [selected, setSelected] = useState<Agent | null>(null)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Agents"
        description="Live monitor for the seven pipeline agents. Click a card for execution history."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading || !agents
          ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
          : agents.map((a) => {
              const meta = statusMeta[a.status]
              return (
                <Card
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(a)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(a)}
                  className="cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CardHeader className="flex-row items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate">{a.name}</CardTitle>
                      <div className="mt-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                        {meta.label}
                        <Badge variant="outline" className="ml-1">
                          {a.tier}
                        </Badge>
                        {a.health !== 'healthy' && <Badge variant="warning">{a.health}</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">{a.description}</p>
                    <div className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                      <span className="text-muted-foreground">Current: </span>
                      {a.currentTask ?? 'Idle — waiting for dispatch'}
                      {a.currentCaseId && (
                        <Link
                          to={`/cases/${a.currentCaseId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-1 text-primary hover:underline"
                        >
                          {a.currentCaseId}
                        </Link>
                      )}
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-sm font-semibold tabular-nums">{a.successRatePct}%</div>
                        <div className="text-2xs text-muted-foreground">success</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold tabular-nums">{a.avgDurationSec}s</div>
                        <div className="text-2xs text-muted-foreground">avg run</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold tabular-nums">{a.runsToday}</div>
                        <div className="text-2xs text-muted-foreground">runs today</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-2xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> last run {relativeTime(a.lastRunAt)}
                      </span>
                      {a.dependencies.length > 0 && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Activity className="h-3 w-3 shrink-0" />
                          after {a.dependencies.map((d) => AGENT_LABEL[d]).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-2xs text-primary">
                      Execution history <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      {selected && <AgentRunsDialog agent={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
