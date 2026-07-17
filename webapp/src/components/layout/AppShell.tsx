import { Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from './CommandPalette'

export function AppShell() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  useKeyboardShortcuts()

  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
            <motion.div
              key={location.pathname}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
        <CommandPalette />
      </div>
    </TooltipProvider>
  )
}
