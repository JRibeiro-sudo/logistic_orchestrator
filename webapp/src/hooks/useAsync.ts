import { useEffect, useState } from 'react'

/** Minimal data-fetching hook for the mock service layer.
 *  deps must identify the query (e.g. a case id). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | null
  loading: boolean
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- deps identify the query by design
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fn().then((result) => {
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading }
}
