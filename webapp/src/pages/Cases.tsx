import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  Columns3,
  Filter,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Skeleton, Avatar } from '@/components/ui/misc'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfidenceMeter, SeverityBadge, StatusBadge } from '@/components/domain/badges'
import { useAsync } from '@/hooks/useAsync'
import { caseService } from '@/services'
import { suppliers } from '@/mocks/data'
import {
  FACTORY_LABEL,
  ROOT_CAUSE_LABEL,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
} from '@/constants'
import { cn, relativeTime } from '@/lib/utils'
import { DEFAULT_COLUMNS, EMPTY_CASE_FILTER, useUIStore } from '@/stores/ui'
import { applyOverrides, useCaseMutations } from '@/stores/cases'
import type { CaseFilterQuery, FactoryId, RecoveryCase, RootCause, Severity, CaseStatus } from '@/types'

type SortKey = 'severity' | 'id' | 'coverage' | 'eta' | 'confidence' | 'updated'

const COLUMN_DEFS: { key: string; label: string }[] = [
  { key: 'severity', label: 'Severity' },
  { key: 'id', label: 'Case' },
  { key: 'part', label: 'Part' },
  { key: 'factory', label: 'Factory' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'status', label: 'Status' },
  { key: 'cause', label: 'Root cause' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'eta', label: 'ETA' },
  { key: 'owner', label: 'Owner' },
  { key: 'confidence', label: 'Confidence' },
]

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

function FilterDropdown<T extends string>({
  label,
  options,
  selected,
  display,
  onToggle,
}: {
  label: string
  options: readonly T[]
  selected: T[]
  display: (v: T) => string
  onToggle: (v: T) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(selected.length > 0 && 'border-primary text-primary')}>
          <Filter className="h-3.5 w-3.5" />
          {label}
          {selected.length > 0 && (
            <Badge variant="primary" className="ml-0.5 px-1.5">
              {selected.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={selected.includes(opt)}
            onCheckedChange={() => onToggle(opt)}
            onSelect={(e) => e.preventDefault()}
          >
            {display(opt)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Cases() {
  const navigate = useNavigate()
  const { data, loading } = useAsync(() => caseService.list(), [])
  const statusOverrides = useCaseMutations((s) => s.statusOverrides)
  const filter = useUIStore((s) => s.caseFilter)
  const setFilter = useUIStore((s) => s.setCaseFilter)
  const savedFilters = useUIStore((s) => s.savedFilters)
  const saveFilter = useUIStore((s) => s.saveFilter)
  const deleteFilter = useUIStore((s) => s.deleteFilter)
  const visibleColumns = useUIStore((s) => s.visibleColumns)
  const setVisibleColumns = useUIStore((s) => s.setVisibleColumns)

  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortAsc, setSortAsc] = useState(true)

  const cases = useMemo(() => {
    const list = (data ?? []).map((c) => applyOverrides(c, statusOverrides))
    const q = filter.search.trim().toLowerCase()
    const filtered = list.filter((c) => {
      if (q) {
        const supplier = suppliers.find((s) => s.id === c.supplierId)
        const hay = `${c.id} ${c.partName} ${c.partNumber} ${c.owner} ${supplier?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filter.severities.length && !filter.severities.includes(c.severity)) return false
      if (filter.statuses.length && !filter.statuses.includes(c.status)) return false
      if (filter.factories.length && !filter.factories.includes(c.factoryId)) return false
      if (filter.rootCauses.length && !filter.rootCauses.includes(c.rootCause)) return false
      return true
    })
    const dir = sortAsc ? 1 : -1
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'severity':
          return dir * (SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
        case 'id':
          return dir * a.id.localeCompare(b.id)
        case 'coverage':
          return dir * (a.coverageHours - b.coverageHours)
        case 'eta': {
          const ae = a.eta ? new Date(a.eta).getTime() : Infinity
          const be = b.eta ? new Date(b.eta).getTime() : Infinity
          return dir * (ae - be)
        }
        case 'confidence':
          return dir * (a.confidence - b.confidence)
        case 'updated':
          return dir * (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      }
    })
  }, [data, statusOverrides, filter, sortKey, sortAsc])

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sortAsc ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    )

  const activeFilterCount =
    filter.severities.length + filter.statuses.length + filter.factories.length + filter.rootCauses.length + (filter.search ? 1 : 0)

  const col = (key: string) => visibleColumns.includes(key)

  const patch = (p: Partial<CaseFilterQuery>) => setFilter({ ...filter, ...p })

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Cases"
        description={`${cases.length} of ${data?.length ?? 0} recovery cases`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-3.5 w-3.5" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {COLUMN_DEFS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={visibleColumns.includes(c.key)}
                  onCheckedChange={() =>
                    setVisibleColumns(
                      visibleColumns.includes(c.key)
                        ? visibleColumns.filter((k) => k !== c.key)
                        : [...visibleColumns, c.key],
                    )
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setVisibleColumns(DEFAULT_COLUMNS)}>
                Reset to default
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Search case, part, supplier, owner…"
            className="pl-8"
            aria-label="Search cases"
          />
        </div>
        <FilterDropdown
          label="Severity"
          options={SEVERITY_ORDER}
          selected={filter.severities}
          display={(v: Severity) => SEVERITY_LABEL[v]}
          onToggle={(v) => patch({ severities: toggleIn(filter.severities, v) })}
        />
        <FilterDropdown
          label="Status"
          options={STATUS_ORDER}
          selected={filter.statuses}
          display={(v: CaseStatus) => STATUS_LABEL[v]}
          onToggle={(v) => patch({ statuses: toggleIn(filter.statuses, v) })}
        />
        <FilterDropdown
          label="Factory"
          options={Object.keys(FACTORY_LABEL) as FactoryId[]}
          selected={filter.factories}
          display={(v: FactoryId) => FACTORY_LABEL[v]}
          onToggle={(v) => patch({ factories: toggleIn(filter.factories, v) })}
        />
        <FilterDropdown
          label="Root cause"
          options={Object.keys(ROOT_CAUSE_LABEL) as RootCause[]}
          selected={filter.rootCauses}
          display={(v: RootCause) => ROOT_CAUSE_LABEL[v]}
          onToggle={(v) => patch({ rootCauses: toggleIn(filter.rootCauses, v) })}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Bookmark className="h-3.5 w-3.5" /> Saved
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Saved filters</DropdownMenuLabel>
            {savedFilters.length === 0 && (
              <div className="px-2 pb-1.5 text-xs text-muted-foreground">No saved filters yet.</div>
            )}
            {savedFilters.map((f) => (
              <DropdownMenuItem key={f.id} className="justify-between" onClick={() => setFilter(f.query)}>
                <span className="truncate">{f.name}</span>
                <button
                  aria-label={`Delete filter ${f.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteFilter(f.id)
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={activeFilterCount === 0}
              onClick={() => {
                const name = window.prompt('Name this filter:')
                if (name) saveFilter(name)
              }}
            >
              Save current filter…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilter(EMPTY_CASE_FILTER)}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="border-b text-left text-2xs uppercase tracking-wide text-muted-foreground">
              {col('severity') && (
                <th className="px-3 py-2">
                  <button className="flex items-center gap-1" onClick={() => setSort('severity')}>
                    Severity {sortIcon('severity')}
                  </button>
                </th>
              )}
              {col('id') && (
                <th className="px-3 py-2">
                  <button className="flex items-center gap-1" onClick={() => setSort('id')}>
                    Case {sortIcon('id')}
                  </button>
                </th>
              )}
              {col('part') && <th className="px-3 py-2">Part</th>}
              {col('factory') && <th className="px-3 py-2">Factory</th>}
              {col('supplier') && <th className="px-3 py-2">Supplier</th>}
              {col('status') && <th className="px-3 py-2">Status</th>}
              {col('cause') && <th className="px-3 py-2">Root cause</th>}
              {col('coverage') && (
                <th className="px-3 py-2">
                  <button className="flex items-center gap-1" onClick={() => setSort('coverage')}>
                    Coverage {sortIcon('coverage')}
                  </button>
                </th>
              )}
              {col('eta') && (
                <th className="px-3 py-2">
                  <button className="flex items-center gap-1" onClick={() => setSort('eta')}>
                    ETA {sortIcon('eta')}
                  </button>
                </th>
              )}
              {col('owner') && <th className="px-3 py-2">Owner</th>}
              {col('confidence') && (
                <th className="px-3 py-2">
                  <button className="flex items-center gap-1" onClick={() => setSort('confidence')}>
                    Confidence {sortIcon('confidence')}
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={11} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              cases.map((c: RecoveryCase) => {
                const supplier = suppliers.find((s) => s.id === c.supplierId)
                return (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/cases/${c.id}`)}
                    className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                  >
                    {col('severity') && (
                      <td className="px-3 py-2">
                        <SeverityBadge severity={c.severity} />
                      </td>
                    )}
                    {col('id') && (
                      <td className="px-3 py-2 font-medium">
                        <Link to={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {c.id}
                        </Link>
                        {c.recurringRisk && (
                          <Badge variant="warning" className="ml-1.5">
                            recurring
                          </Badge>
                        )}
                      </td>
                    )}
                    {col('part') && (
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.partName}</div>
                        <div className="font-mono text-2xs text-muted-foreground">{c.partNumber}</div>
                      </td>
                    )}
                    {col('factory') && (
                      <td className="px-3 py-2 text-muted-foreground">{FACTORY_LABEL[c.factoryId]}</td>
                    )}
                    {col('supplier') && (
                      <td className="max-w-44 px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          <Avatar name={supplier?.name ?? '?'} className="h-5 w-5" />
                          <span className="truncate text-muted-foreground">{supplier?.name}</span>
                        </span>
                      </td>
                    )}
                    {col('status') && (
                      <td className="px-3 py-2">
                        <StatusBadge status={c.status} />
                      </td>
                    )}
                    {col('cause') && (
                      <td className="px-3 py-2 text-muted-foreground">{ROOT_CAUSE_LABEL[c.rootCause]}</td>
                    )}
                    {col('coverage') && (
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'tabular-nums',
                            c.coverageHours < 24 && c.status !== 'resolved'
                              ? 'font-semibold text-destructive'
                              : 'text-muted-foreground',
                          )}
                        >
                          {c.coverageHours.toFixed(0)}h
                        </span>
                      </td>
                    )}
                    {col('eta') && (
                      <td className="px-3 py-2 text-muted-foreground">{c.eta ? relativeTime(c.eta) : '—'}</td>
                    )}
                    {col('owner') && (
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          <Avatar name={c.owner} className="h-5 w-5" />
                          <span className="text-muted-foreground">{c.owner}</span>
                        </span>
                      </td>
                    )}
                    {col('confidence') && (
                      <td className="px-3 py-2">
                        <ConfidenceMeter value={c.confidence} />
                      </td>
                    )}
                  </tr>
                )
              })}
            {!loading && cases.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-xs text-muted-foreground">
                  No cases match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
