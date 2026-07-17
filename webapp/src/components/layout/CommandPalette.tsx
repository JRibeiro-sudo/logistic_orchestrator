import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bot,
  FolderKanban,
  GanttChartSquare,
  LayoutDashboard,
  Search,
  Workflow,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { cases } from '@/mocks/data'
import { SeverityBadge } from '@/components/domain/badges'

interface PaletteEntry {
  id: string
  kind: 'page' | 'case'
  label: string
  hint: string
  to: string
  icon?: React.ComponentType<{ className?: string }>
  severity?: (typeof cases)[number]['severity']
}

const pageEntries: PaletteEntry[] = [
  { id: 'p-dash', kind: 'page', label: 'Dashboard', hint: 'Go to page', to: '/', icon: LayoutDashboard },
  { id: 'p-cases', kind: 'page', label: 'Cases', hint: 'Go to page', to: '/cases', icon: FolderKanban },
  { id: 'p-tl', kind: 'page', label: 'Recovery Timeline', hint: 'Go to page', to: '/timeline', icon: GanttChartSquare },
  { id: 'p-inv', kind: 'page', label: 'AI Investigation', hint: 'Go to page', to: '/investigation', icon: Search },
  { id: 'p-agents', kind: 'page', label: 'Agents', hint: 'Go to page', to: '/agents', icon: Bot },
  { id: 'p-flow', kind: 'page', label: 'Live Recovery Flow', hint: 'Go to page', to: '/live-flow', icon: Workflow },
  { id: 'p-analytics', kind: 'page', label: 'Analytics', hint: 'Go to page', to: '/analytics', icon: BarChart3 },
]

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useUIStore.getState().commandPaletteOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  const results = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLowerCase()
    const caseEntries: PaletteEntry[] = cases.map((c) => ({
      id: c.id,
      kind: 'case',
      label: `${c.id} · ${c.partName}`,
      hint: c.partNumber,
      to: `/cases/${c.id}`,
      severity: c.severity,
    }))
    if (!q) return [...pageEntries, ...caseEntries.slice(0, 6)]
    const all = [...pageEntries, ...caseEntries]
    return all
      .filter((e) => `${e.label} ${e.hint}`.toLowerCase().includes(q))
      .slice(0, 12)
  }, [query])

  useEffect(() => {
    setActiveIndex(0)
  }, [results.length])

  const select = (entry: PaletteEntry) => {
    setOpen(false)
    navigate(entry.to)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 p-0" hideClose>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault()
                select(results[activeIndex])
              }
            }}
            placeholder="Search pages and cases…"
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search pages and cases"
          />
          <Kbd>esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5" role="listbox">
          {results.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No results.</div>
          )}
          {results.map((entry, i) => (
            <button
              key={entry.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => select(entry)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
                i === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground',
              )}
            >
              {entry.icon ? (
                <entry.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : entry.severity ? (
                <SeverityBadge severity={entry.severity} className="w-16 shrink-0 text-2xs" />
              ) : null}
              <span className="flex-1 truncate">{entry.label}</span>
              <span className="shrink-0 text-2xs text-muted-foreground">{entry.hint}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
