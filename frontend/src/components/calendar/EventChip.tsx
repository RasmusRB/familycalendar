import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/colors'
import { fmt } from '@/lib/dates'
import type { CalendarEvent } from '@/types'

export function EventChip({
  event,
  onClick,
  variant = 'soft',
  className,
}: {
  event: CalendarEvent
  onClick?: (e: React.MouseEvent) => void
  variant?: 'soft' | 'solid'
  className?: string
}) {
  const colors = colorClasses[event.color]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium transition-colors',
        variant === 'soft'
          ? cn(colors.softBg, colors.softText, 'hover:brightness-95')
          : cn(colors.solidBg, colors.solidText, 'hover:brightness-110'),
        className,
      )}
      title={event.title}
    >
      {!event.allDay ? (
        <span className="shrink-0 tabular-nums opacity-80">{fmt(new Date(event.start), 'h:mma').toLowerCase()}</span>
      ) : null}
      <span className="truncate">{event.title}</span>
    </button>
  )
}
