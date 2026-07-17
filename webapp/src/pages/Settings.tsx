import { Moon, ShieldCheck, Sun } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Kbd, Separator } from '@/components/ui/misc'
import { useUIStore } from '@/stores/ui'
import { SYNTHETIC_DATA_NOTICE } from '@/constants'

export default function Settings() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <PageHeader title="Settings" description="Workspace preferences and system information." />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>The workspace is designed dark-first; light mode is available.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            onClick={() => setTheme('dark')}
          >
            <Moon /> Dark
          </Button>
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            onClick={() => setTheme('light')}
          >
            <Sun /> Light
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyboard shortcuts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span>Command palette</span>
            <span className="flex gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </div>
          {(
            [
              ['Go to Dashboard', 'D'],
              ['Go to Cases', 'C'],
              ['Go to Recovery Timeline', 'T'],
              ['Go to AI Investigation', 'I'],
              ['Go to Agents', 'A'],
              ['Go to Analytics', 'N'],
            ] as const
          ).map(([label, key]) => (
            <div key={key} className="contents">
              <Separator />
              <div className="flex items-center justify-between">
                <span>{label}</span>
                <span className="flex gap-1">
                  <Kbd>G</Kbd>
                  <Kbd>{key}</Kbd>
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <CardTitle>Data notice</CardTitle>
            <CardDescription className="mt-1 leading-relaxed">{SYNTHETIC_DATA_NOTICE}</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planned integrations</CardTitle>
          <CardDescription>
            The service layer is abstracted behind interfaces so these can replace the mock
            implementations without UI changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-3">
          {['SAP S/4HANA', 'Microsoft Teams', 'Outlook', 'SharePoint', 'Jira', 'Supplier APIs'].map(
            (name) => (
              <div key={name} className="rounded-md border bg-background px-2.5 py-2">
                {name}
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-2xs">planned</span>
              </div>
            ),
          )}
        </CardContent>
      </Card>
    </div>
  )
}
