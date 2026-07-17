import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bot } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { Badge } from '@/components/ui/badge'
import { SeverityBadge, StatusBadge } from '@/components/domain/badges'
import { InvestigationSteps } from '@/components/domain/InvestigationSteps'
import { useAsync } from '@/hooks/useAsync'
import { agentService, caseService } from '@/services'
import { SEVERITY_ORDER, ROOT_CAUSE_LABEL, FACTORY_LABEL } from '@/constants'
import { cn } from '@/lib/utils'

export default function Investigation() {
  const { data: cases, loading } = useAsync(() => caseService.list(), [])
  const { data: agents } = useAsync(() => agentService.list(), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const investigatable = useMemo(
    () =>
      (cases ?? [])
        .filter((c) => c.status !== 'detected' && c.status !== 'resolved')
        .sort((a, b) => {
          // Actively investigating cases first, then by severity.
          const act = Number(b.status === 'investigating') - Number(a.status === 'investigating')
          if (act !== 0) return act
          return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
        })
        .slice(0, 14),
    [cases],
  )

  const selected = investigatable.find((c) => c.id === selectedId) ?? investigatable[0] ?? null
  const runningAgents = (agents ?? []).filter((a) => a.status === 'running' || a.status === 'waiting')

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="AI Investigation"
        description="Watch the agent pipeline work a case: evidence gathering, structured reasoning summaries, guardrail checks, and confidence evolution. Chain-of-thought is never exposed — only structured outputs."
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Case picker */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Active investigations</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[520px] space-y-1 overflow-y-auto p-2 pt-0">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              : investigatable.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected?.id === c.id && 'border-border bg-accent',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{c.id}</span>
                      <SeverityBadge severity={c.severity} className="text-2xs" />
                    </div>
                    <div className="mt-0.5 truncate text-2xs text-muted-foreground">
                      {c.partName} · {FACTORY_LABEL[c.factoryId]}
                    </div>
                  </button>
                ))}
          </CardContent>
        </Card>

        {/* Investigation detail */}
        <div className="min-w-0 space-y-4">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-sm font-semibold">{selected.id}</h2>
                <StatusBadge status={selected.status} />
                <Badge variant="outline">{ROOT_CAUSE_LABEL[selected.rootCause]}</Badge>
                <Link
                  to={`/cases/${selected.id}`}
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open case <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <InvestigationSteps caseId={selected.id} />
            </>
          ) : (
            <Card>
              <CardContent className="py-14 text-center text-xs text-muted-foreground">
                No active investigations.
              </CardContent>
            </Card>
          )}

          {/* Currently active agents strip */}
          <Card>
            <CardHeader>
              <CardTitle>Agents active right now</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {runningAgents.length === 0 && (
                <span className="text-xs text-muted-foreground">All agents idle.</span>
              )}
              {runningAgents.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs"
                >
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{a.name}</span>
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      a.status === 'running' ? 'animate-pulse bg-success' : 'bg-warning',
                    )}
                  />
                  <span className="max-w-56 truncate text-muted-foreground">{a.currentTask}</span>
                </span>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
