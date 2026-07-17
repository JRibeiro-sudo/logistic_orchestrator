import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

/** Placeholder for pages scheduled in a later build phase. */
export default function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <Construction className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">Scheduled for build phase {phase}</div>
          <p className="max-w-sm text-xs text-muted-foreground">
            This page is part of the incremental delivery plan and will be implemented in an
            upcoming phase.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
