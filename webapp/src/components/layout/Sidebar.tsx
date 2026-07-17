import { NavLink } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Factory,
  FolderKanban,
  GanttChartSquare,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldAlert,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { Kbd } from '@/components/ui/misc'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const mainNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cases', label: 'Cases', icon: FolderKanban },
  { to: '/timeline', label: 'Recovery Timeline', icon: GanttChartSquare },
  { to: '/investigation', label: 'AI Investigation', icon: Search },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/live-flow', label: 'Live Recovery Flow', icon: Workflow },
]

const secondaryNav: NavItem[] = [
  { to: '/suppliers', label: 'Supplier View', icon: Factory },
  { to: '/escalations', label: 'Escalations', icon: ShieldAlert },
  { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive && 'bg-accent text-foreground',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r bg-card transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div className={cn('flex h-14 items-center gap-2 border-b px-3', collapsed && 'justify-center px-0')}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-semibold">Recovery Orchestrator</div>
            <div className="truncate text-2xs text-muted-foreground">Supply Chain · Prototype</div>
          </div>
        )}
      </div>

      {!collapsed && (
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="mx-3 mt-3 flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
      )}

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Main">
        {mainNav.map((item) => (
          <NavEntry key={item.to} item={item} collapsed={collapsed} />
        ))}
        <div className={cn('my-2 h-px bg-border', collapsed ? 'mx-1' : 'mx-2')} />
        {secondaryNav.map((item) => (
          <NavEntry key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t p-2">
        <NavEntry item={{ to: '/settings', label: 'Settings', icon: Settings }} collapsed={collapsed} />
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
