import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/misc'
import Dashboard from '@/pages/Dashboard'
import ComingSoon from '@/pages/ComingSoon'

const Settings = lazy(() => import('@/pages/Settings'))
const Cases = lazy(() => import('@/pages/Cases'))
const CaseDetail = lazy(() => import('@/pages/CaseDetail'))
const Timeline = lazy(() => import('@/pages/Timeline'))

function PageFallback() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route
            path="cases"
            element={
              <Suspense fallback={<PageFallback />}>
                <Cases />
              </Suspense>
            }
          />
          <Route
            path="cases/:caseId"
            element={
              <Suspense fallback={<PageFallback />}>
                <CaseDetail />
              </Suspense>
            }
          />
          <Route
            path="timeline"
            element={
              <Suspense fallback={<PageFallback />}>
                <Timeline />
              </Suspense>
            }
          />
          <Route path="investigation" element={<ComingSoon title="AI Investigation" phase={3} />} />
          <Route path="agents" element={<ComingSoon title="Agents" phase={3} />} />
          <Route path="live-flow" element={<ComingSoon title="Live Recovery Flow" phase={3} />} />
          <Route path="suppliers" element={<ComingSoon title="Supplier View" phase={3} />} />
          <Route path="suppliers/:supplierId" element={<ComingSoon title="Supplier View" phase={3} />} />
          <Route path="escalations" element={<ComingSoon title="Escalations" phase={3} />} />
          <Route path="knowledge" element={<ComingSoon title="Knowledge Base" phase={3} />} />
          <Route path="analytics" element={<ComingSoon title="Analytics" phase={3} />} />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageFallback />}>
                <Settings />
              </Suspense>
            }
          />
          <Route path="*" element={<ComingSoon title="Not found" phase={0} />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
