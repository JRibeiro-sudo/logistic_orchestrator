import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Skeleton } from '@/components/ui/misc'
import { useAsync } from '@/hooks/useAsync'
import { referenceService } from '@/services'
import { cn, relativeTime } from '@/lib/utils'
import type { KnowledgeArticle } from '@/types'

const categoryLabel: Record<KnowledgeArticle['category'], string> = {
  playbook: 'Playbook',
  process: 'Process',
  supplier: 'Supplier',
  system: 'System',
}

export default function Knowledge() {
  const { data: articles, loading } = useAsync(() => referenceService.knowledge(), [])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = articles ?? []
    if (!q) return list
    return list.filter((a) =>
      `${a.title} ${a.summary} ${a.tags.join(' ')}`.toLowerCase().includes(q),
    )
  }, [articles, query])

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Knowledge Base"
        description="Playbooks, process notes, and system rules the recovery workflow operates by."
      />
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles…"
          className="pl-8"
          aria-label="Search knowledge base"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-1.5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            : filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    'w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected?.id === a.id && 'border-primary/60',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{categoryLabel[a.category]}</Badge>
                    <span className="ml-auto text-2xs text-muted-foreground">
                      {relativeTime(a.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13px] font-medium leading-snug">{a.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.summary}</div>
                </button>
              ))}
          {!loading && filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No articles match.</p>
          )}
        </div>

        {selected ? (
          <Card className="self-start">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <Badge variant="outline">{categoryLabel[selected.category]}</Badge>
                <span className="ml-auto text-2xs text-muted-foreground">
                  {selected.author} · updated {relativeTime(selected.updatedAt)}
                </span>
              </div>
              <CardTitle className="mt-1 text-base">{selected.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selected.body.map((paragraph, i) => (
                <p key={i} className="max-w-prose text-[13px] leading-relaxed text-foreground/90">
                  {paragraph}
                </p>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          !loading && (
            <Card>
              <CardContent className="py-14 text-center text-xs text-muted-foreground">
                Select an article.
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  )
}
