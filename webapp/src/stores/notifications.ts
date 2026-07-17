import { create } from 'zustand'
import type { AppNotification } from '@/types'
import { notificationService } from '@/services'

interface NotificationState {
  items: AppNotification[]
  loaded: boolean
  load: () => Promise<void>
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return
    const items = await notificationService.list()
    set({ items, loaded: true })
  },
  markRead: (id) =>
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
}))
