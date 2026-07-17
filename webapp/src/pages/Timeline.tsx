import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SeverityBadge } from '@/components/domain/badges'
import { useAsync } from '@/hooks/useAsync'
import { caseService } from '@/services'
import { NOW, timelineFor } from '@/mocks/data'
import { EVENT_KIND_LABEL, SEVERITY_ORDER } from '@/constants'
import { cn, formatDateTime } from '@/lib/utils'
import type { TimelineEvent, TimelineEventKind } from '@/types'

/** Zoom preset → total visible span in hours (past + small future margin). */
const ZOOM_PRESETS = [
  { id: '1h', label: '1 hour', spanH: 6 },
  { id: '4h', label: '4 hours', spanH: 24 },
  { id: '1d', label: '1 day', spanH: 7 * 24 },
  { id: '1w', label: '1 week', spanH: 5 * 7 * 24 },
] as const

type ZoomId = (typeof ZOOM_PRESETS)[number]['id']

const kindColor: Record<TimelineEventKind, string> = {
  trigger: 'hsl(var(--primary))',
  agent: 'hsl(var(--chart-4))',
  tool_call: 'hsl(var(--chart-4))',
  guardrail: 'hsl(var(--warning))',
  supplier_reply: 'hsl(var(--chart-2))',
  transport: 'hsl(var(--chart-1))',
  approval: 'hsl(var(--success))',
  decision: 'hsl(var(--chart-3))',
  execution: 'hsl(var(--success))',
  escalation: 'hsl(var(--destructive))',
  note: 'hsl(var(--muted-foreground))',
}

function axisTicks(startMs: number, endMs: number, zoom: ZoomId): { ms: number; label: string }[] {
  const stepH = zoom === '1h' ? 1 : zoom === '4h' ? 4 : zoom === '1d' ? 24 : 7 * 24
  const stepMs = stepH * 3_600_000
  const first = Math.ceil(startMs / stepMs) * stepMs
  const ticks: { ms: number; label: string }[] = []
  for (let ms = first; ms <= endMs; ms += stepMs) {
    const d = new Date(ms)
    ticks.push({
      ms,
      label:
        stepH >= 24
          ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    })
  }
  return ticks
}

export default function Timeline() {
  const { data: cases, loading } = useAsync(() => caseService.list(), [])
  const [zoom, setZoom] = useState<ZoomId>('1d')

  const preset = ZOOM_PRESETS.find((p) => p.id === zoom)!
  const endMs = NOW.getTime() + preset.spanH * 3_600_000 * 0.15
  const startMs = NOW.getTime() - preset.spanH * 3_600_000

  const lanes = useMemo(() => {
    const open = (cases ?? [])
      .filter((c) => c.status !== 'resolved' && c.status !== 'detected')
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
      .slice(0, 12)
    return open.map((c) => ({
      case: c,
      events: timelineFor(c).filter((e) => {
        const t = new Date(e.at).getTime()
        return t >= startMs && t <= endMs
      }),
    }))
  }, [cases, startMs, endMs])

  const pos = (iso: string) => ((new Date(iso).getTime() - startMs) / (endMs - startMs)) * 100
  const nowPos = ((NOW.getTime() - startMs) / (endMs - startMs)) * 100
  const ticks = axisTicks(startMs, endMs, zoom)

  const legendKinds: TimelineEventKind[] = [
    'trigger',
    'agent',
    'guardrail',
    'supplier_reply',
    'approval',
    'execution',
    'escalation',
    'transport',
  ]

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Recovery Timeline"
        description="Events, decisions, approvals, and agent execution across active cases."
        actions={
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            {ZOOM_PRESETS.map((p) => (
              <Button
                key={p.id}
                variant={zoom === p.id ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-2xs"
                onClick={() => setZoom(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
        {legendKinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: kindColor[k] }} />
            {EVENT_KIND_LABEL[k]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="min-w-[900px]">
          {/* Axis */}
          <div className="relative ml-56 h-8 border-b">
            {ticks.map((t) => {
              const x = ((t.ms - startMs) / (endMs - startMs)) * 100
              return (
                <span
                  key={t.ms}
                  className="absolute top-1.5 -translate-x-1/2 text-2xs tabular-nums text-muted-foreground"
                  style={{ left: `${x}%` }}
                >
                  {t.label}
                </span>
              )
            })}
            <span
              className="absolute bottom-0 top-0 w-px bg-destructive"
              style={{ left: `${nowPos}%` }}
              aria-hidden
            />
            <span
              className="absolute top-0 -translate-x-1/2 rounded-sm bg-destructive px-1 text-[9px] font-bold text-destructive-foreground"
              style={{ left: `${nowPos}%` }}
            >
              NOW
            </span>
          </div>

          {/* Lanes */}
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            lanes.map(({ case: c, events }) => (
              <div key={c.id} className="group flex border-b last:border-b-0 hover:bg-accent/30">
                <div className="w-56 shrink-0 border-r px-3 py-2">
                  <Link to={`/cases/${c.id}`} className="text-xs font-medium hover:underline">
                    {c.id}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2">
                    <SeverityBadge severity={c.severity} className="text-2xs" />
                    <span className="truncate text-2xs text-muted-foreground">{c.partName}</span>
                  </div>
                </div>
                <div className="relative min-h-11 flex-1">
                  {/* grid lines */}
                  {ticks.map((t) => (
                    <span
                      key={t.ms}
                      aria-hidden
                      className="absolute bottom-0 top-0 w-px bg-border/60"
                      style={{ left: `${((t.ms - startMs) / (endMs - startMs)) * 100}%` }}
                    />
                  ))}
                  <span
                    aria-hidden
                    className="absolute bottom-0 top-0 w-px bg-destructive/60"
                    style={{ left: `${nowPos}%` }}
                  />
                  {/* connecting bar from first to last event */}
                  {events.length > 1 && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/25"
                      style={{
                        left: `${pos(events[0].at)}%`,
                        width: `${Math.max(0.5, pos(events[events.length - 1].at) - pos(events[0].at))}%`,
                      }}
                    />
                  )}
                  {events.map((e: TimelineEvent) => (
                    <Tooltip key={e.id}>
                      <TooltipTrigger asChild>
                        <button
                          aria-label={`${e.title} at ${formatDateTime(e.at)}`}
                          className={cn(
                            'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none',
                          )}
                          style={{ left: `${pos(e.at)}%`, background: kindColor[e.kind] }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-72">
                        <div className="text-xs font-medium">{e.title}</div>
                        <div className="mt-0.5 text-2xs text-muted-foreground">
                          {formatDateTime(e.at)} · {e.actor}
                        </div>
                        <div className="mt-1 text-2xs">{e.detail}</div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {events.length === 0 && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground/60">
                      No events in this window
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <p className="text-2xs text-muted-foreground">
        Showing the {lanes.length} highest-severity active cases. Zoom changes the visible window;
        hover any marker for details.
      </p>
    </div>
  )
}
