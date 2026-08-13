import { useMemo } from 'react'
import { isSameMonth, isToday, startOfDay } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { fmt, getMonthGridDays } from '@/lib/dates'
import { EventChip } from './EventChip'
import type { CalendarEvent } from '@/types'

const MAX_VISIBLE = 3

export function MonthView({
  cursor,
  events,
  onDayClick,
  onSlotClick,
  onEventClick,
}: {
  cursor: Date
  events: CalendarEvent[]
  onDayClick: (date: Date) => void
  onSlotClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}) {
  const days = useMemo(() => getMonthGridDays(cursor), [cursor])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of days) {
      const key = day.toDateString()
      const dayStart = startOfDay(day).getTime()
      const dayEnd = dayStart + 24 * 60 * 60 * 1000
      const list = events
        .filter((e) => {
          const start = new Date(e.start).getTime()
          const end = new Date(e.end).getTime()
          return start < dayEnd && end > dayStart
        })
        .sort((a, b) => {
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
          return new Date(a.start).getTime() - new Date(b.start).getTime()
        })
      map.set(key, list)
    }
    return map
  }, [days, events])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {days.slice(0, 7).map((day) => (
          <div
            key={day.toISOString()}
            className="border-l border-border py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground first:border-l-0"
          >
            {fmt(day, 'EEE')}
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(day.toDateString()) ?? []
          const visible = dayEvents.slice(0, MAX_VISIBLE)
          const overflow = dayEvents.length - visible.length
          const inMonth = isSameMonth(day, cursor)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex min-h-24 flex-col gap-1 border-l border-t border-border p-1 first:border-l-0',
                !inMonth && 'bg-muted/30',
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick(day)}
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center self-end rounded-full text-xs font-semibold sm:self-start',
                  isToday(day)
                    ? 'bg-primary text-primary-foreground'
                    : inMonth
                      ? 'text-foreground hover:bg-accent'
                      : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {fmt(day, 'd')}
              </button>
              <div
                role="button"
                tabIndex={-1}
                className="flex min-h-0 flex-1 flex-col gap-0.5"
                onClick={() => onSlotClick(day)}
              >
                {visible.map((evt) => (
                  <EventChip
                    key={evt.id}
                    event={evt}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(evt)
                    }}
                  />
                ))}
                {overflow > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-accent"
                      >
                        +{overflow} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <p className="mb-2 text-sm font-semibold">{fmt(day, 'EEEE, MMM d')}</p>
                      <div className="flex flex-col gap-1">
                        {dayEvents.map((evt) => (
                          <EventChip key={evt.id} event={evt} onClick={() => onEventClick(evt)} />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
