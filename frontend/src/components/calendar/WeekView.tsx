import { getWeekDays } from '@/lib/dates'
import { TimeGrid } from './TimeGrid'
import type { CalendarEvent } from '@/types'

export function WeekView({
  cursor,
  events,
  onSlotClick,
  onEventClick,
}: {
  cursor: Date
  events: CalendarEvent[]
  onSlotClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}) {
  const days = getWeekDays(cursor)
  return <TimeGrid days={days} events={events} onSlotClick={onSlotClick} onEventClick={onEventClick} />
}
