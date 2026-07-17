import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CaseFilterQuery, SavedFilter } from '@/types'

export const EMPTY_CASE_FILTER: CaseFilterQuery = {
  search: '',
  severities: [],
  statuses: [],
  factories: [],
  rootCauses: [],
}

interface UIState {
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  pinnedCaseIds: string[]
  recentCaseIds: string[]
  caseFilter: CaseFilterQuery
  savedFilters: SavedFilter[]
  visibleColumns: string[]
  setTheme: (t: 'dark' | 'light') => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  togglePinned: (caseId: string) => void
  pushRecent: (caseId: string) => void
  setCaseFilter: (q: CaseFilterQuery) => void
  saveFilter: (name: string) => void
  deleteFilter: (id: string) => void
  setVisibleColumns: (cols: string[]) => void
}

export const DEFAULT_COLUMNS = [
  'severity',
  'id',
  'part',
  'factory',
  'supplier',
  'status',
  'coverage',
  'eta',
  'owner',
  'confidence',
]

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      pinnedCaseIds: [],
      recentCaseIds: [],
      caseFilter: EMPTY_CASE_FILTER,
      savedFilters: [],
      visibleColumns: DEFAULT_COLUMNS,
      setTheme: (theme) => {
        document.documentElement.classList.toggle('light', theme === 'light')
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      togglePinned: (caseId) =>
        set((s) => ({
          pinnedCaseIds: s.pinnedCaseIds.includes(caseId)
            ? s.pinnedCaseIds.filter((id) => id !== caseId)
            : [...s.pinnedCaseIds, caseId],
        })),
      pushRecent: (caseId) =>
        set((s) => ({
          recentCaseIds: [caseId, ...s.recentCaseIds.filter((id) => id !== caseId)].slice(0, 8),
        })),
      setCaseFilter: (caseFilter) => set({ caseFilter }),
      saveFilter: (name) => {
        const { caseFilter, savedFilters } = get()
        set({
          savedFilters: [
            ...savedFilters,
            { id: `sf-${Date.now()}`, name, query: { ...caseFilter } },
          ],
        })
      },
      deleteFilter: (id) =>
        set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      setVisibleColumns: (visibleColumns) => set({ visibleColumns }),
    }),
    {
      name: 'recovery-orchestrator-ui',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        pinnedCaseIds: s.pinnedCaseIds,
        recentCaseIds: s.recentCaseIds,
        savedFilters: s.savedFilters,
        visibleColumns: s.visibleColumns,
      }),
    },
  ),
)
