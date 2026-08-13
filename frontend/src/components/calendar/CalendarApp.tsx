import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAccounts } from '@/hooks/useAccounts'
import { useEvents } from '@/hooks/useEvents'
import { api } from '@/lib/api'
import { navigateCursor } from '@/lib/dates'
import type { CalendarEvent, CalendarViewKind, EventDraft } from '@/types'
import { CalendarHeader, MobileViewTabBar } from './CalendarHeader'
import { DayView } from './DayView'
import { WeekView } from './WeekView'
import { MonthView } from './MonthView'
import { YearView } from './YearView'
import { EventDialog } from './EventDialog'
import { SettingsSheet } from '../settings/SettingsSheet'

export function CalendarApp({ onLogout }: { onLogout: () => Promise<void> }) {
  const [view, setView] = useState<CalendarViewKind>('week')
  const [cursor, setCursor] = useState(() => new Date())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogInitialDate, setDialogInitialDate] = useState(() => new Date())
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const { accounts, googleConfigured, refresh: refreshAccounts, disconnect } = useAccounts()
  const { events, loading, error, refresh: refreshEvents } = useEvents(view, cursor)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const oauthError = params.get('error')
    if (connected) {
      toast.success('Google Calendar connected')
      refreshAccounts()
    } else if (oauthError) {
      toast.error('Could not connect Google Calendar. Please try again.')
    }
    if (connected || oauthError) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  function openCreateDialog(date: Date) {
    setEditingEvent(null)
    setDialogInitialDate(date)
    setDialogOpen(true)
  }

  function openEditDialog(event: CalendarEvent) {
    setEditingEvent(event)
    setDialogInitialDate(new Date(event.start))
    setDialogOpen(true)
  }

  async function handleCreate(draft: EventDraft) {
    await api.createEvent(draft)
    toast.success('Event added')
    await refreshEvents()
  }

  async function handleUpdate(id: string, draft: Omit<EventDraft, 'owner'>) {
    await api.updateEvent(id, draft)
    toast.success('Event updated')
    await refreshEvents()
  }

  async function handleDelete(id: string) {
    await api.deleteEvent(id)
    toast.success('Event deleted')
    await refreshEvents()
  }

  function goToDay(date: Date) {
    setCursor(date)
    setView('day')
  }

  function goToMonth(date: Date) {
    setCursor(date)
    setView('month')
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <CalendarHeader
        view={view}
        cursor={cursor}
        accounts={accounts}
        onViewChange={setView}
        onPrev={() => setCursor((c) => navigateCursor(view, c, -1))}
        onNext={() => setCursor((c) => navigateCursor(view, c, 1))}
        onToday={() => setCursor(new Date())}
        onNewEvent={() => openCreateDialog(new Date())}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-h-0 flex-1 flex-col pb-24 sm:pb-0">
        {loading && events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading your calendars…
          </div>
        ) : view === 'day' ? (
          <DayView cursor={cursor} events={events} onSlotClick={openCreateDialog} onEventClick={openEditDialog} />
        ) : view === 'week' ? (
          <WeekView cursor={cursor} events={events} onSlotClick={openCreateDialog} onEventClick={openEditDialog} />
        ) : view === 'month' ? (
          <MonthView
            cursor={cursor}
            events={events}
            onDayClick={goToDay}
            onSlotClick={openCreateDialog}
            onEventClick={openEditDialog}
          />
        ) : (
          <YearView cursor={cursor} events={events} onMonthClick={goToMonth} onDayClick={goToDay} />
        )}
      </main>

      <MobileViewTabBar view={view} onViewChange={setView} />

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={dialogInitialDate}
        event={editingEvent}
        accounts={accounts}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        accounts={accounts}
        googleConfigured={googleConfigured}
        onDisconnect={disconnect}
        onLogout={onLogout}
      />
    </div>
  )
}
