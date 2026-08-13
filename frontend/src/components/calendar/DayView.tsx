import { TimeGrid } from './TimeGrid'
import type { CalendarEvent } from '@/types'

export function DayView({
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
  return <TimeGrid days={[cursor]} events={events} onSlotClick={onSlotClick} onEventClick={onEventClick} />
}
