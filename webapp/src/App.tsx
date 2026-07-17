import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/misc'
import Dashboard from '@/pages/Dashboard'
import NotFound from '@/pages/NotFound'

const Settings = lazy(() => import('@/pages/Settings'))
const Cases = lazy(() => import('@/pages/Cases'))
const CaseDetail = lazy(() => import('@/pages/CaseDetail'))
const Timeline = lazy(() => import('@/pages/Timeline'))
const Investigation = lazy(() => import('@/pages/Investigation'))
const Agents = lazy(() => import('@/pages/Agents'))
const LiveFlow = lazy(() => import('@/pages/LiveFlow'))
const Suppliers = lazy(() => import('@/pages/Suppliers'))
const Escalations = lazy(() => import('@/pages/Escalations'))
const Knowledge = lazy(() => import('@/pages/Knowledge'))
const Analytics = lazy(() => import('@/pages/Analytics'))

function PageFallback() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function lazyRoute(el: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{el}</Suspense>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="cases" element={lazyRoute(<Cases />)} />
          <Route path="cases/:caseId" element={lazyRoute(<CaseDetail />)} />
          <Route path="timeline" element={lazyRoute(<Timeline />)} />
          <Route path="investigation" element={lazyRoute(<Investigation />)} />
          <Route path="agents" element={lazyRoute(<Agents />)} />
          <Route path="live-flow" element={lazyRoute(<LiveFlow />)} />
          <Route path="suppliers" element={lazyRoute(<Suppliers />)} />
          <Route path="suppliers/:supplierId" element={lazyRoute(<Suppliers />)} />
          <Route path="escalations" element={lazyRoute(<Escalations />)} />
          <Route path="knowledge" element={lazyRoute(<Knowledge />)} />
          <Route path="analytics" element={lazyRoute(<Analytics />)} />
          <Route path="settings" element={lazyRoute(<Settings />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
