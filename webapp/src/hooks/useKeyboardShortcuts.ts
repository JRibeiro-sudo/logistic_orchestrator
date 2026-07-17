import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const GO_TARGETS: Record<string, string> = {
  d: '/',
  c: '/cases',
  t: '/timeline',
  a: '/agents',
  i: '/investigation',
  n: '/analytics',
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

/** Linear-style "g then <key>" navigation chords. */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const pendingG = useRef<number>(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      const key = e.key.toLowerCase()
      const now = Date.now()

      if (key === 'g') {
        pendingG.current = now
        return
      }
      if (pendingG.current && now - pendingG.current < 800 && GO_TARGETS[key]) {
        e.preventDefault()
        navigate(GO_TARGETS[key])
      }
      pendingG.current = 0
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
