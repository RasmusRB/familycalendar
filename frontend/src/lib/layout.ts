import type { CalendarEvent } from '@/types'

export interface LaidOutEvent {
  event: CalendarEvent
  columnIndex: number
  columnCount: number
}

/** Greedy interval-partitioning layout so overlapping timed events sit side by side. */
export function layoutTimedEvents(events: CalendarEvent[]): LaidOutEvent[] {
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  const groups: CalendarEvent[][] = []
  let currentGroup: CalendarEvent[] = []
  let groupEnd = -Infinity

  for (const evt of sorted) {
    const start = new Date(evt.start).getTime()
    const end = new Date(evt.end).getTime()
    if (currentGroup.length > 0 && start >= groupEnd) {
      groups.push(currentGroup)
      currentGroup = []
      groupEnd = -Infinity
    }
    currentGroup.push(evt)
    groupEnd = Math.max(groupEnd, end)
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  const result: LaidOutEvent[] = []
  for (const group of groups) {
    const columns: { end: number }[] = []
    const placements = new Map<string, number>()
    for (const evt of group) {
      const start = new Date(evt.start).getTime()
      const end = new Date(evt.end).getTime()
      let col = columns.findIndex((c) => c.end <= start)
      if (col === -1) {
        col = columns.length
        columns.push({ end })
      } else {
        columns[col].end = end
      }
      placements.set(evt.id, col)
    }
    const columnCount = columns.length
    for (const evt of group) {
      result.push({ event: evt, columnIndex: placements.get(evt.id) ?? 0, columnCount })
    }
  }
  return result
}
