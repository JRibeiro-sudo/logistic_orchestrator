import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { NOW } from '@/mocks/data'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEur(value: number): string {
  return `€${value.toLocaleString('en-GB')}`
}

export function formatEurCompact(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`
  return `€${value}`
}

export function relativeTime(iso: string): string {
  const diffMs = NOW.getTime() - new Date(iso).getTime()
  const future = diffMs < 0
  const mins = Math.round(Math.abs(diffMs) / 60000)
  let text: string
  if (mins < 1) text = 'now'
  else if (mins < 60) text = `${mins}m`
  else if (mins < 60 * 24) text = `${Math.round(mins / 60)}h`
  else text = `${Math.round(mins / (60 * 24))}d`
  if (text === 'now') return text
  return future ? `in ${text}` : `${text} ago`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Simulated network latency so loading states are honest. */
export function withLatency<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
