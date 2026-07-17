import { Link, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, Moon, Pin, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/misc'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { NotificationCenter } from './NotificationCenter'
import { cases } from '@/mocks/data'

const crumbLabels: Record<string, string> = {
  '': 'Dashboard',
  cases: 'Cases',
  timeline: 'Recovery Timeline',
  investigation: 'AI Investigation',
  agents: 'Agents',
  'live-flow': 'Live Recovery Flow',
  suppliers: 'Supplier View',
  escalations: 'Escalations',
  knowledge: 'Knowledge Base',
  analytics: 'Analytics',
  settings: 'Settings',
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  const crumbs = [{ to: '/', label: 'Dashboard' }]
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    crumbs.push({ to: acc, label: crumbLabels[part] ?? part })
  }
  const unique = crumbs.filter((c, i) => !(i > 0 && c.to === '/'))
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      {unique.map((c, i) => (
        <span key={c.to} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          {i === unique.length - 1 ? (
            <span className="truncate font-medium text-foreground">{c.label}</span>
          ) : (
            <Link to={c.to} className="truncate transition-colors hover:text-foreground">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

function PinnedMenu() {
  const pinned = useUIStore((s) => s.pinnedCaseIds)
  const recent = useUIStore((s) => s.recentCaseIds)
  const pinnedCases = pinned.map((id) => cases.find((c) => c.id === id)).filter(Boolean)
  const recentCases = recent
    .map((id) => cases.find((c) => c.id === id))
    .filter((c) => c && !pinned.includes(c.id))
    .slice(0, 5)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Pinned and recent cases">
          <Pin className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Pinned cases</DropdownMenuLabel>
        {pinnedCases.length === 0 && (
          <div className="px-2 pb-1.5 text-xs text-muted-foreground">
            Pin cases from the case detail page.
          </div>
        )}
        {pinnedCases.map(
          (c) =>
            c && (
              <DropdownMenuItem key={c.id} asChild>
                <Link to={`/cases/${c.id}`} className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">{c.id}</span>
                  <span className="text-xs text-muted-foreground">{c.partName}</span>
                </Link>
              </DropdownMenuItem>
            ),
        )}
        {recentCases.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recentCases.map(
              (c) =>
                c && (
                  <DropdownMenuItem key={c.id} asChild>
                    <Link to={`/cases/${c.id}`}>
                      <span className="font-medium">{c.id}</span>
                      <span className="truncate text-xs text-muted-foreground">{c.partName}</span>
                    </Link>
                  </DropdownMenuItem>
                ),
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Topbar() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const unread = useNotificationStore((s) => s.items.filter((n) => !n.read).length)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      <Breadcrumbs />
      <div className="flex-1" />
      <PinnedMenu />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                {unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96 p-0">
          <NotificationCenter />
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <div className="flex items-center gap-2 border-l pl-3">
        <Avatar name="Value Stream Manager" />
        <div className="hidden leading-tight lg:block">
          <div className="text-xs font-medium">Value Stream Manager</div>
          <div className="text-2xs text-muted-foreground">Aveiro · synthetic user</div>
        </div>
      </div>
    </header>
  )
}
