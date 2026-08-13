import { useEffect, useMemo, useRef, useState } from 'react'
import { isSameDay, isToday, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/colors'
import { fmt } from '@/lib/dates'
import { layoutTimedEvents } from '@/lib/layout'
import type { CalendarEvent } from '@/types'
import { EventChip } from './EventChip'

const HOUR_HEIGHT = 56
const DAY_MS = 24 * 60 * 60 * 1000

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

export function TimeGrid({
  days,
  events,
  onSlotClick,
  onEventClick,
}: {
  days: Date[]
  events: CalendarEvent[]
  onSlotClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nowTop = (minutesFromMidnight(new Date()) / 60) * HOUR_HEIGHT
    el.scrollTo({ top: Math.max(0, nowTop - el.clientHeight / 2) })
  }, [])

  const allDayByDay = useMemo(
    () => days.map((day) => events.filter((e) => e.allDay && overlapsDay(e, day))),
    [days, events],
  )

  const timedByDay = useMemo(
    () =>
      days.map((day) => {
        const dayEvents = events.filter((e) => !e.allDay && overlapsDay(e, day))
        return layoutTimedEvents(dayEvents)
      }),
    [days, events],
  )

  const hasAllDay = allDayByDay.some((list) => list.length > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn('flex flex-col items-center gap-0.5 border-l border-border py-2 text-center')}
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {fmt(day, 'EEE')}
            </span>
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground',
              )}
            >
              {fmt(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {hasAllDay ? (
        <div
          className="grid border-b border-border py-1"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="pr-2 text-right text-[10px] text-muted-foreground">All day</div>
          {allDayByDay.map((list, i) => (
            <div key={days[i].toISOString()} className="flex flex-col gap-1 border-l border-border px-1">
              {list.map((evt) => (
                <EventChip key={evt.id} event={evt} onClick={() => onEventClick(evt)} />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {h === 0 ? '' : fmt(new Date(2000, 0, 1, h), 'h a')}
              </div>
            ))}
          </div>

          {days.map((day, dayIdx) => (
            <div
              key={day.toISOString()}
              className="relative border-l border-border"
              style={{ height: HOUR_HEIGHT * 24 }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  type="button"
                  key={h}
                  className="absolute inset-x-0 border-t border-border/70 hover:bg-accent/50"
                  style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  onClick={() => onSlotClick(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h))}
                  aria-label={`Add event at ${fmt(new Date(2000, 0, 1, h), 'h a')} on ${fmt(day, 'EEEE MMMM d')}`}
                />
              ))}

              {timedByDay[dayIdx].map(({ event, columnIndex, columnCount }) => {
                const { top, height } = pixelRangeForDay(event, day)
                const width = 100 / columnCount
                const colors = colorClasses[event.color]
                return (
                  <button
                    type="button"
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event)
                    }}
                    className={cn(
                      'absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-xs shadow-sm ring-1 ring-inset ring-black/5 transition-[filter] hover:brightness-110',
                      colors.solidBg,
                      colors.solidText,
                    )}
                    style={{
                      top,
                      height: Math.max(height, 22),
                      left: `calc(${columnIndex * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                    }}
                    title={event.title}
                  >
                    <div className="truncate font-medium">{event.title}</div>
                    {height > 34 ? (
                      <div className="truncate opacity-90">
                        {fmt(new Date(event.start), 'h:mma').toLowerCase()}
                      </div>
                    ) : null}
                  </button>
                )
              })}

              {isToday(day) ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 h-px bg-destructive"
                  style={{ top: (minutesFromMidnight(now) / 60) * HOUR_HEIGHT }}
                >
                  <span className="absolute -left-1 -top-1 size-2 rounded-full bg-destructive" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function overlapsDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day).getTime()
  const dayEnd = dayStart + DAY_MS
  const start = new Date(event.start).getTime()
  const end = new Date(event.end).getTime()
  if (event.allDay) return start < dayEnd && end > dayStart
  return start < dayEnd && end > dayStart && (start >= dayStart || isSameDay(new Date(event.start), day))
}

function pixelRangeForDay(event: CalendarEvent, day: Date): { top: number; height: number } {
  const dayStart = startOfDay(day)
  const dayEnd = new Date(dayStart.getTime() + DAY_MS)
  const start = new Date(Math.max(new Date(event.start).getTime(), dayStart.getTime()))
  const end = new Date(Math.min(new Date(event.end).getTime(), dayEnd.getTime()))
  const top = (minutesFromMidnight(start) / 60) * HOUR_HEIGHT
  const bottom = ((minutesFromMidnight(end) || 24 * 60) / 60) * HOUR_HEIGHT
  return { top, height: Math.max(bottom - top, 4) }
}
