import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, Info, ShieldQuestion } from 'lucide-react'
import type { AppNotification } from '@/types'
import { cn, relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useNotificationStore } from '@/stores/notifications'

const levelMeta: Record<
  AppNotification['level'],
  { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }
> = {
  critical: { icon: AlertTriangle, tone: 'text-destructive', label: 'Critical' },
  warning: { icon: ShieldQuestion, tone: 'text-warning', label: 'Warning' },
  approval: { icon: BadgeCheck, tone: 'text-primary', label: 'Approval required' },
  info: { icon: Info, tone: 'text-muted-foreground', label: 'Information' },
}

const groupOrder: AppNotification['level'][] = ['critical', 'approval', 'warning', 'info']

export function NotificationCenter({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const { items, load, markRead, markAllRead } = useNotificationStore()

  useEffect(() => {
    void load()
  }, [load])

  const groups = groupOrder
    .map((level) => ({ level, items: items.filter((n) => n.level === level) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold">Notifications</span>
        <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-2xs">
          Mark all read
        </Button>
      </div>
      <div className="overflow-y-auto">
        {groups.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">All caught up.</div>
        )}
        {groups.map((group) => {
          const meta = levelMeta[group.level]
          return (
            <div key={group.level}>
              <div className="sticky top-0 bg-popover px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </div>
              {group.items.map((n) => {
                const Icon = meta.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id)
                      onNavigate?.()
                      if (n.caseId) navigate(`/cases/${n.caseId}`)
                    }}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      !n.read && 'bg-accent/40',
                    )}
                  >
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.tone)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{n.title}</span>
                      <span className="block text-xs text-muted-foreground">{n.body}</span>
                    </span>
                    <span className="shrink-0 text-2xs text-muted-foreground">{relativeTime(n.at)}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
