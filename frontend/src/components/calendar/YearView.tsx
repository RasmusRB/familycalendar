import { useMemo } from 'react'
import { isSameMonth, isToday, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/colors'
import { fmt, getMonthGridDays, getYearMonths } from '@/lib/dates'
import type { CalendarEvent, EventColor } from '@/types'

export function YearView({
  cursor,
  events,
  onMonthClick,
  onDayClick,
}: {
  cursor: Date
  events: CalendarEvent[]
  onMonthClick: (date: Date) => void
  onDayClick: (date: Date) => void
}) {
  const months = useMemo(() => getYearMonths(cursor), [cursor])

  const colorsByDay = useMemo(() => {
    const map = new Map<string, Set<EventColor>>()
    for (const evt of events) {
      const start = startOfDay(new Date(evt.start))
      const end = new Date(evt.end)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const key = d.toDateString()
        if (!map.has(key)) map.set(key, new Set())
        map.get(key)!.add(evt.color)
      }
    }
    return map
  }, [events])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {months.map((month) => (
          <div key={month.toISOString()} className="rounded-xl border border-border bg-card p-2.5">
            <button
              type="button"
              onClick={() => onMonthClick(month)}
              className="mb-2 block text-sm font-semibold text-foreground hover:text-primary"
            >
              {fmt(month, 'MMMM')}
            </button>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {getMonthGridDays(month).map((day) => {
                const inMonth = isSameMonth(day, month)
                const dayColors = inMonth ? colorsByDay.get(day.toDateString()) : undefined
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    disabled={!inMonth}
                    onClick={() => onDayClick(day)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded py-0.5 text-[10px]',
                      !inMonth && 'invisible',
                      isToday(day) ? 'font-bold text-primary' : 'text-foreground/80 hover:text-primary',
                    )}
                  >
                    <span>{fmt(day, 'd')}</span>
                    <span className="flex h-1 gap-0.5">
                      {dayColors &&
                        Array.from(dayColors)
                          .slice(0, 3)
                          .map((c) => <span key={c} className={cn('size-1 rounded-full', colorClasses[c].dot)} />)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
