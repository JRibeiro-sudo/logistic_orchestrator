import { Link } from 'react-router-dom'
import { ShieldAlert, UserCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton, Avatar } from '@/components/ui/misc'
import { SeverityBadge } from '@/components/domain/badges'
import { useAsync } from '@/hooks/useAsync'
import { caseService } from '@/services'
import { suppliers } from '@/mocks/data'
import { FACTORY_LABEL } from '@/constants'
import { relativeTime } from '@/lib/utils'
import { applyOverrides, useCaseMutations } from '@/stores/cases'

export default function Escalations() {
  const { data, loading } = useAsync(() => caseService.list(), [])
  const statusOverrides = useCaseMutations((s) => s.statusOverrides)

  const escalated = (data ?? [])
    .map((c) => applyOverrides(c, statusOverrides))
    .filter((c) => c.status === 'escalated')

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Escalations"
        description="Cases the automated pipeline could not safely resolve. Each one is owned by the classic manual recovery process — the shortage risk stays open until a human closes it."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : escalated.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-xs text-muted-foreground">
            No escalated cases right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {escalated.map((c) => {
            const supplier = suppliers.find((s) => s.id === c.supplierId)
            return (
              <Card key={c.id} className="border-destructive/30">
                <CardHeader className="flex-row items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/15 text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/cases/${c.id}`} className="text-[13px] font-semibold hover:underline">
                        {c.id}
                      </Link>
                      <SeverityBadge severity={c.severity} />
                      {c.recurringRisk && <Badge variant="warning">recurring risk</Badge>}
                      <span className="ml-auto text-2xs text-muted-foreground">
                        escalated {relativeTime(c.updatedAt)}
                      </span>
                    </div>
                    <CardTitle className="mt-1 font-normal text-muted-foreground">
                      {c.partName} · <span className="font-mono">{c.partNumber}</span> ·{' '}
                      {FACTORY_LABEL[c.factoryId]} · {supplier?.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 pl-[60px]">
                  <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
                    {c.escalationReason ??
                      'Rejected at the human checkpoint — routed to manual recovery.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" />
                      Manual owner: <Avatar name={c.owner} className="h-4 w-4 text-[8px]" /> {c.owner}
                    </span>
                    <span>
                      Coverage <strong className="text-destructive">{c.coverageHours.toFixed(0)}h</strong>
                    </span>
                    <span>{c.productionAtRiskUnits.toLocaleString()} units at risk</span>
                    <Link to={`/cases/${c.id}`} className="ml-auto text-primary hover:underline">
                      Open case →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
