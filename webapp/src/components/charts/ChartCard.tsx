import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="h-56">{children}</CardContent>
    </Card>
  )
}

// oxlint-disable-next-line react/only-export-components -- style helper co-located with the card
export function chartTooltipStyle(bg: string, border: string): React.CSSProperties {
  return {
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    fontSize: 12,
    padding: '6px 10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  }
}
