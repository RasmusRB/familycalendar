import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { getFetchRange } from '@/lib/dates'
import type { CalendarEvent, CalendarViewKind } from '@/types'

export function useEvents(view: CalendarViewKind, cursor: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { start, end } = getFetchRange(view, cursor)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.events(startISO, endISO)
      setEvents(res.events)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { events, loading, error, refresh }
}
