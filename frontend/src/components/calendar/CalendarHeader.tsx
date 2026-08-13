import { CalendarHeart, ChevronLeft, ChevronRight, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { formatRangeLabel } from '@/lib/dates'
import { colorClasses } from '@/lib/colors'
import type { Account, CalendarViewKind } from '@/types'

const VIEWS: { value: CalendarViewKind; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

export function CalendarHeader({
  view,
  cursor,
  accounts,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onNewEvent,
  onOpenSettings,
}: {
  view: CalendarViewKind
  cursor: Date
  accounts: Account[]
  onViewChange: (view: CalendarViewKind) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onNewEvent: () => void
  onOpenSettings: () => void
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border bg-card px-3 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarHeart className="size-4" aria-hidden="true" />
          </div>
          <h1 className="hidden text-base font-semibold text-foreground sm:block">Our Calendar</h1>
        </div>

        <div className="flex items-center gap-1.5">
          {accounts
            .filter((a) => a.connected)
            .map((a) => (
              <span
                key={a.slot}
                className={cn('size-2 rounded-full', colorClasses[a.color].dot)}
                title={a.name}
              />
            ))}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button size="sm" onClick={onNewEvent} className="h-9 px-2.5 sm:px-3">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New event</span>
          </Button>
          <ThemeToggle />
          <Button
            size="icon"
            variant="ghost"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="size-9"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={onToday} className="h-8">
            Today
          </Button>
          <Button size="icon" variant="ghost" onClick={onPrev} aria-label="Previous" className="size-8">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onNext} aria-label="Next" className="size-8">
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-1 text-sm font-medium text-foreground sm:text-base">
            {formatRangeLabel(view, cursor)}
          </span>
        </div>

        <Tabs value={view} onValueChange={(v) => onViewChange(v as CalendarViewKind)} className="hidden sm:block">
          <TabsList>
            {VIEWS.map((v) => (
              <TabsTrigger key={v.value} value={v.value}>
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </header>
  )
}

export function MobileViewTabBar({
  view,
  onViewChange,
}: {
  view: CalendarViewKind
  onViewChange: (view: CalendarViewKind) => void
}) {
  return (
    <nav
      className="fixed inset-x-0 z-40 flex justify-center sm:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
    >
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-full border border-white/25 bg-card/60 p-1',
          'shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl backdrop-saturate-150',
          'dark:border-white/10 dark:bg-card/50',
        )}
      >
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => onViewChange(v.value)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
              view === v.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
