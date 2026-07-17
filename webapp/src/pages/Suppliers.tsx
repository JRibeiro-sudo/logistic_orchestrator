import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Search, Truck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, Input, Progress, Skeleton } from '@/components/ui/misc'
import { SeverityBadge, StatusBadge } from '@/components/domain/badges'
import { useAsync } from '@/hooks/useAsync'
import { caseService, supplierService } from '@/services'
import { FACTORY_LABEL } from '@/constants'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'
import type { Supplier } from '@/types'

function scoreTone(pct: number) {
  return pct >= 95 ? 'bg-success' : pct >= 88 ? 'bg-primary' : 'bg-warning'
}

function SupplierCard({ s }: { s: Supplier }) {
  return (
    <Link
      to={`/suppliers/${s.id}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={s.name} className="h-8 w-8 text-xs" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{s.name}</div>
          <div className="text-2xs text-muted-foreground">
            {s.country} · {s.region} · {s.leadTimeDays}d lead time
          </div>
        </div>
        {s.incidents12m >= 7 && <Badge variant="warning">watch</Badge>}
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-2xs">
          <span className="w-24 shrink-0 text-muted-foreground">On-time delivery</span>
          <Progress value={s.onTimeDeliveryPct} className="flex-1" indicatorClassName={scoreTone(s.onTimeDeliveryPct)} />
          <span className="w-10 text-right tabular-nums">{s.onTimeDeliveryPct}%</span>
        </div>
        <div className="flex items-center gap-2 text-2xs">
          <span className="w-24 shrink-0 text-muted-foreground">Recovery success</span>
          <Progress value={s.recoverySuccessPct} className="flex-1" indicatorClassName={scoreTone(s.recoverySuccessPct)} />
          <span className="w-10 text-right tabular-nums">{s.recoverySuccessPct}%</span>
        </div>
        <div className="flex justify-between text-2xs text-muted-foreground">
          <span>{s.incidents12m} incidents / 12m</span>
          <span>quality {s.qualityScore}/5</span>
        </div>
      </div>
    </Link>
  )
}

function SupplierList() {
  const { data: suppliers, loading } = useAsync(() => supplierService.list(), [])
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = suppliers ?? []
    if (!q) return list
    return list.filter((s) => `${s.name} ${s.country} ${s.region}`.toLowerCase().includes(q))
  }, [suppliers, query])

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Supplier View"
        description="Performance, incident history, and open recovery activity per supplier (synthetic)."
      />
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search suppliers…"
          className="pl-8"
          aria-label="Search suppliers"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          : filtered.map((s) => <SupplierCard key={s.id} s={s} />)}
      </div>
    </div>
  )
}

function SupplierDetail({ supplierId }: { supplierId: string }) {
  const navigate = useNavigate()
  const { data: supplier, loading } = useAsync(() => supplierService.get(supplierId), [supplierId])
  const { data: cases } = useAsync(() => caseService.list(), [])

  const supplierCases = (cases ?? []).filter((c) => c.supplierId === supplierId)
  const open = supplierCases.filter((c) => c.status !== 'resolved')
  const resolved = supplierCases.filter((c) => c.status === 'resolved')
  const inTransit = open.filter((c) => c.trackingNumber != null)

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!supplier) {
    return (
      <div className="mx-auto max-w-[1400px] p-6">
        <p className="text-sm text-muted-foreground">Supplier {supplierId} was not found.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/suppliers')}>
          <ArrowLeft /> All suppliers
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="All suppliers" onClick={() => navigate('/suppliers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar name={supplier.name} className="h-9 w-9 text-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">{supplier.name}</h1>
          <p className="text-xs text-muted-foreground">
            {supplier.country} · {supplier.region} · standard lead time {supplier.leadTimeDays} days
          </p>
        </div>
        {supplier.incidents12m >= 7 && <Badge variant="warning">sourcing review recommended</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'On-time delivery', value: `${supplier.onTimeDeliveryPct}%` },
          { label: 'Recovery success', value: `${supplier.recoverySuccessPct}%` },
          { label: 'Incidents (12m)', value: supplier.incidents12m },
          { label: 'Quality score', value: `${supplier.qualityScore}/5` },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open recovery cases</CardTitle>
            <CardDescription>
              {open.length} open · {resolved.length} resolved historically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 p-2 pt-0">
            {open.length === 0 && (
              <p className="px-2 py-4 text-xs text-muted-foreground">No open cases for this supplier.</p>
            )}
            {open.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-accent"
              >
                <SeverityBadge severity={c.severity} className="w-20 shrink-0" />
                <span className="w-28 shrink-0 text-xs font-medium">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {c.partName} · {FACTORY_LABEL[c.factoryId]}
                </span>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Transport status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inTransit.length === 0 && (
                <p className="text-xs text-muted-foreground">No shipments currently tracked.</p>
              )}
              {inTransit.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 text-xs">
                  <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-mono">{c.trackingNumber}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.partName}</span>
                  <span className="text-muted-foreground">{c.eta ? `ETA ${relativeTime(c.eta)}` : '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Communication</CardTitle>
              <CardDescription>Contacts and recent outbound activity (templates only).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {supplier.contacts.map((contact) => (
                <div key={contact.role} className="flex items-center gap-2.5 text-xs">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{contact.name}</span>
                  <span className="text-muted-foreground">{contact.role}</span>
                </div>
              ))}
              <p className="pt-1 text-2xs text-muted-foreground">
                Outbound messages to this supplier are fixed, pre-approved templates and pass the
                evidence guardrail before send. See any case's Messages tab for the thread.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              {open
                .filter((c) => c.recommendation)
                .slice(0, 4)
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-muted-foreground">{c.recommendation!.summary}</span>
                    <Link to={`/cases/${c.id}`} className="shrink-0 text-primary hover:underline">
                      {c.id}
                    </Link>
                  </div>
                ))}
              {open.filter((c) => c.recommendation).length === 0 && (
                <p className="text-muted-foreground">No pending recovery actions.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident history</CardTitle>
          <CardDescription>All recovery cases involving this supplier (synthetic).</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-2xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Case</th>
                <th className="px-4 py-2">Part</th>
                <th className="hidden px-4 py-2 md:table-cell">Factory</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {supplierCases.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0 hover:bg-accent/50">
                  <td className="px-4 py-2">
                    <Link to={`/cases/${c.id}`} className="font-medium hover:underline">
                      {c.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{c.partName}</td>
                  <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
                    {FACTORY_LABEL[c.factoryId]}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className={cn('px-4 py-2 text-right text-xs text-muted-foreground')}>
                    {formatDateTime(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Suppliers() {
  const { supplierId } = useParams()
  if (supplierId) return <SupplierDetail supplierId={supplierId} />
  return <SupplierList />
}
