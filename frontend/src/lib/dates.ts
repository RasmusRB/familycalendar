import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import type { CalendarViewKind } from '@/types'

const WEEK_OPTS = { weekStartsOn: 1 as const }

export function getFetchRange(view: CalendarViewKind, cursor: Date): { start: Date; end: Date } {
  switch (view) {
    case 'day':
      return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) }
    case 'week':
      return { start: startOfWeek(cursor, WEEK_OPTS), end: addDays(endOfWeek(cursor, WEEK_OPTS), 1) }
    case 'month': {
      const start = startOfWeek(startOfMonth(cursor), WEEK_OPTS)
      const end = addDays(endOfWeek(endOfMonth(cursor), WEEK_OPTS), 1)
      return { start, end }
    }
    case 'year':
      return { start: startOfYear(cursor), end: addDays(endOfYear(cursor), 1) }
  }
}

export function getMonthGridDays(cursor: Date): Date[] {
  const start = startOfWeek(startOfMonth(cursor), WEEK_OPTS)
  const end = endOfWeek(endOfMonth(cursor), WEEK_OPTS)
  return eachDayOfInterval({ start, end })
}

export function getWeekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor, WEEK_OPTS)
  const end = endOfWeek(cursor, WEEK_OPTS)
  return eachDayOfInterval({ start, end })
}

export function getYearMonths(cursor: Date): Date[] {
  return eachMonthOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) })
}

export function navigateCursor(view: CalendarViewKind, cursor: Date, direction: 1 | -1): Date {
  switch (view) {
    case 'day':
      return addDays(cursor, direction)
    case 'week':
      return addWeeks(cursor, direction)
    case 'month':
      return addMonths(cursor, direction)
    case 'year':
      return addYears(cursor, direction)
  }
}

export function formatRangeLabel(view: CalendarViewKind, cursor: Date): string {
  switch (view) {
    case 'day':
      return format(cursor, 'EEEE, MMMM d, yyyy')
    case 'week': {
      const start = startOfWeek(cursor, WEEK_OPTS)
      const end = endOfWeek(cursor, WEEK_OPTS)
      const sameMonth = start.getMonth() === end.getMonth()
      return sameMonth
        ? `${format(start, 'MMMM d')} – ${format(end, 'd, yyyy')}`
        : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    }
    case 'month':
      return format(cursor, 'MMMM yyyy')
    case 'year':
      return format(cursor, 'yyyy')
  }
}

export const fmt = format
