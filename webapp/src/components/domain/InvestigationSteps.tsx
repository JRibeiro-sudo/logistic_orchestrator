import { Bot, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { ConfidenceMeter } from '@/components/domain/badges'
import { useAsync } from '@/hooks/useAsync'
import { caseService } from '@/services'
import { AGENT_LABEL } from '@/constants'
import { cn } from '@/lib/utils'

export function InvestigationSteps({ caseId }: { caseId: string }) {
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
                    <span
                      key={e}
                      className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
                    >
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
