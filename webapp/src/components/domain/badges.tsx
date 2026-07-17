import { AlertTriangle, ArrowUpRight, CircleDot, Minus } from 'lucide-react'
import type { CaseStatus, Severity } from '@/types'
import { SEVERITY_LABEL, STATUS_LABEL } from '@/constants'
import { cn } from '@/lib/utils'

const sevDot: Record<Severity, string> = {
  critical: 'bg-[hsl(var(--sev-critical))]',
  high: 'bg-[hsl(var(--sev-high))]',
  medium: 'bg-[hsl(var(--sev-medium))]',
  low: 'bg-[hsl(var(--sev-low))]',
}

const sevText: Record<Severity, string> = {
  critical: 'text-[hsl(var(--sev-critical))]',
  high: 'text-[hsl(var(--sev-high))]',
  medium: 'text-[hsl(var(--sev-medium))]',
  low: 'text-[hsl(var(--sev-low))]',
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        sevText[severity],
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', sevDot[severity])} />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

const statusStyle: Record<CaseStatus, string> = {
  detected: 'bg-secondary text-secondary-foreground',
  investigating: 'bg-primary/15 text-primary',
  awaiting_approval: 'bg-[hsl(var(--warning))]/15 text-warning',
  recovering: 'bg-primary/15 text-primary',
  resolved: 'bg-success/15 text-success',
  escalated: 'bg-destructive/15 text-destructive',
}

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const Icon =
    status === 'escalated'
      ? AlertTriangle
      : status === 'awaiting_approval'
        ? ArrowUpRight
        : status === 'resolved'
          ? Minus
          : CircleDot
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold',
        statusStyle[status],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  if (value <= 0) return <span className="text-xs text-muted-foreground">—</span>
  const pct = Math.round(value * 100)
  const tone = pct >= 85 ? 'bg-success' : pct >= 65 ? 'bg-primary' : 'bg-warning'
  return (
    <span className={cn('inline-flex w-24 items-center gap-1.5', className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
    </span>
  )
}
