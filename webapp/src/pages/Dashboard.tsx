import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  Euro,
  FolderKanban,
  Inbox,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/misc'
import { PageHeader } from '@/components/layout/PageHeader'
import { SeverityBadge, StatusBadge } from '@/components/domain/badges'
import { useAsync } from '@/hooks/useAsync'
import { agentService, caseService, notificationService } from '@/services'
import { FACTORY_LABEL, SEVERITY_ORDER, SEVERITY_LABEL } from '@/constants'
import { cn, formatEurCompact, relativeTime } from '@/lib/utils'
import type { RecoveryCase } from '@/types'

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  loading,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'danger' | 'success' | 'default'
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-16" />
          ) : (
            <div
              className={cn(
                'mt-0.5 text-2xl font-semibold tabular-nums tracking-tight',
                tone === 'danger' && 'text-destructive',
                tone === 'success' && 'text-success',
              )}
            >
              {value}
            </div>
          )}
          {sub && <div className="mt-0.5 text-2xs text-muted-foreground">{sub}</div>}
        </div>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            tone === 'danger' ? 'bg-destructive/15 text-destructive' : tone === 'success' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function AttentionList({ cases: allCases, loading }: { cases: RecoveryCase[]; loading: boolean }) {
  const attention = allCases
    .filter((c) => c.status !== 'resolved')
    .sort((a, b) => {
      const sev = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      if (sev !== 0) return sev
      return a.coverageHours - b.coverageHours
    })
    .slice(0, 6)

  return (
    <Card className="col-span-full xl:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Requires your attention</CardTitle>
        <Link to="/cases" className="flex items-center gap-1 text-xs text-primary hover:underline">
          All cases <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {loading ? (
          <div className="space-y-2 px-4 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {attention.map((c) => (
                <tr key={c.id} className="border-t transition-colors first:border-t-0 hover:bg-accent/50">
                  <td className="py-2 pl-4">
                    <SeverityBadge severity={c.severity} />
                  </td>
                  <td className="py-2">
                    <Link to={`/cases/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.id}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.partName}</div>
                  </td>
                  <td className="hidden py-2 md:table-cell">
                    <span className="text-xs text-muted-foreground">{FACTORY_LABEL[c.factoryId]}</span>
                  </td>
                  <td className="hidden py-2 lg:table-cell">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <span
                      className={cn(
                        'tabular-nums text-xs',
                        c.coverageHours < 24 ? 'font-semibold text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {c.coverageHours.toFixed(0)}h coverage
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function SeverityBreakdown({ cases: allCases, loading }: { cases: RecoveryCase[]; loading: boolean }) {
  const open = allCases.filter((c) => c.status !== 'resolved')
  const counts = SEVERITY_ORDER.map((s) => ({
    severity: s,
    count: open.filter((c) => c.severity === s).length,
  }))
  const max = Math.max(1, ...counts.map((c) => c.count))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open cases by severity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)
          : counts.map(({ severity, count }) => (
              <div key={severity} className="flex items-center gap-2">
                <span className="w-16 text-xs text-muted-foreground">{SEVERITY_LABEL[severity]}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${(count / max) * 100}%`,
                      background: `hsl(var(--sev-${severity}))`,
                    }}
                  />
                </div>
                <span className="w-6 text-right tabular-nums text-xs">{count}</span>
              </div>
            ))}
      </CardContent>
    </Card>
  )
}

function AgentsWidget() {
  const { data: agents, loading } = useAsync(() => agentService.list(), [])
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Agents</CardTitle>
        <Link to="/agents" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Monitor <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading || !agents
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
          : agents.slice(0, 7).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    a.status === 'running'
                      ? 'animate-pulse bg-success'
                      : a.status === 'waiting'
                        ? 'bg-warning'
                        : a.health === 'warning'
                          ? 'bg-warning'
                          : 'bg-muted-foreground/40',
                  )}
                />
                <span className="w-36 truncate font-medium">{a.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {a.currentTask ?? 'Idle'}
                </span>
              </div>
            ))}
      </CardContent>
    </Card>
  )
}

function ActivityFeed() {
  const { data: items, loading } = useAsync(() => notificationService.activity(), [])
  return (
    <Card className="xl:row-span-2">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 p-0 pb-2">
        {loading || !items
          ? [
              <div key="sk" className="space-y-2 px-4 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>,
            ]
          : items.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 border-t px-4 py-2 text-xs first:border-t-0">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1">
                  {a.caseId ? (
                    <Link to={`/cases/${a.caseId}`} className="hover:underline">
                      {a.text}
                    </Link>
                  ) : (
                    a.text
                  )}
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground">{relativeTime(a.at)}</span>
              </div>
            ))}
      </CardContent>
    </Card>
  )
}

function Deadlines({ cases: allCases, loading }: { cases: RecoveryCase[]; loading: boolean }) {
  const upcoming = allCases
    .filter((c) => c.eta && c.status !== 'resolved')
    .sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime())
    .slice(0, 5)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming deadlines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
          : upcoming.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-accent"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="w-28 shrink-0 font-medium">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.partName}</span>
                <Badge variant={new Date(c.eta!).getTime() - Date.now() < 24 * 3600e3 ? 'warning' : 'outline'}>
                  {relativeTime(c.eta!)}
                </Badge>
              </Link>
            ))}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { data: kpis, loading: kpisLoading } = useAsync(() => caseService.kpis(), [])
  const { data: allCases, loading: casesLoading } = useAsync(() => caseService.list(), [])
  const cases = allCases ?? []

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Dashboard"
        description="Live view of material shortage recovery across all four factories."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Open cases" value={kpis?.openCases ?? '—'} icon={FolderKanban} loading={kpisLoading} />
        <KpiCard
          label="Critical shortages"
          value={kpis?.criticalShortages ?? '—'}
          icon={AlertTriangle}
          tone="danger"
          loading={kpisLoading}
        />
        <KpiCard
          label="Production risk"
          value={kpis ? `${kpis.productionRiskHours}h` : '—'}
          sub="coverage on critical parts"
          icon={Clock}
          tone="danger"
          loading={kpisLoading}
        />
        <KpiCard label="Agents running" value={kpis?.agentsRunning ?? '—'} icon={Bot} loading={kpisLoading} />
        <KpiCard
          label="Recovered today"
          value={kpis?.recoveredToday ?? '—'}
          icon={TrendingUp}
          tone="success"
          loading={kpisLoading}
        />
        <KpiCard
          label="Pending replies"
          value={kpis?.pendingSupplierReplies ?? '—'}
          sub="supplier responses"
          icon={Inbox}
          loading={kpisLoading}
        />
        <KpiCard
          label="Avg recovery"
          value={kpis ? `${kpis.avgRecoveryHours}h` : '—'}
          icon={Clock}
          loading={kpisLoading}
        />
        <KpiCard
          label="Savings MTD"
          value={kpis ? formatEurCompact(kpis.savingsMtdEur) : '—'}
          sub="production loss avoided"
          icon={Euro}
          tone="success"
          loading={kpisLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <AttentionList cases={cases} loading={casesLoading} />
        <ActivityFeed />
        <SeverityBreakdown cases={cases} loading={casesLoading} />
        <AgentsWidget />
        <Deadlines cases={cases} loading={casesLoading} />
      </div>
    </div>
  )
}
