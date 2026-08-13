import { useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Loader2, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Account, CalendarEvent, EventDraft, EventOwner } from '@/types'

interface FormState {
  title: string
  owner: EventOwner
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  location: string
  description: string
}

function toDateInput(d: Date) {
  return format(d, 'yyyy-MM-dd')
}
function toTimeInput(d: Date) {
  return format(d, 'HH:mm')
}

function buildInitialState(initialDate: Date, event?: CalendarEvent | null): FormState {
  if (event) {
    const start = new Date(event.start)
    const end = new Date(event.end)
    return {
      title: event.title,
      owner: event.owner,
      allDay: event.allDay,
      startDate: toDateInput(start),
      startTime: toTimeInput(start),
      endDate: toDateInput(event.allDay ? addDays(end, -1) : end),
      endTime: toTimeInput(end),
      location: event.location ?? '',
      description: event.description ?? '',
    }
  }
  const start = new Date(initialDate)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    title: '',
    owner: 'a',
    allDay: false,
    startDate: toDateInput(start),
    startTime: toTimeInput(start),
    endDate: toDateInput(start),
    endTime: toTimeInput(end),
    location: '',
    description: '',
  }
}

export function EventDialog({
  open,
  onOpenChange,
  initialDate,
  event,
  accounts,
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: Date
  event?: CalendarEvent | null
  accounts: Account[]
  onCreate: (draft: EventDraft) => Promise<void>
  onUpdate: (id: string, draft: Omit<EventDraft, 'owner'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const isEditing = Boolean(event)
  const [form, setForm] = useState<FormState>(() => buildInitialState(initialDate, event))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(initialDate, event))
      setError(null)
      setConfirmDelete(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Give the event a title.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let start: string
      let end: string
      if (form.allDay) {
        start = form.startDate
        end = format(addDays(new Date(`${form.endDate}T00:00:00`), 1), 'yyyy-MM-dd')
      } else {
        start = new Date(`${form.startDate}T${form.startTime}`).toISOString()
        end = new Date(`${form.endDate}T${form.endTime}`).toISOString()
      }
      if (new Date(end) <= new Date(start)) {
        setError('End must be after start.')
        setSaving(false)
        return
      }

      const base = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        start,
        end,
        allDay: form.allDay,
      }

      if (isEditing && event) {
        await onUpdate(event.id, base)
      } else {
        await onCreate({ ...base, owner: form.owner })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this event.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setDeleting(true)
    try {
      await onDelete(event.id)
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this event.')
    } finally {
      setDeleting(false)
    }
  }

  const ownerOptions: { value: EventOwner; label: string; dot: string; disabled: boolean }[] = [
    { value: 'a', label: accountName(accounts, 'a'), dot: 'bg-partner-a', disabled: !isConnected(accounts, 'a') },
    { value: 'b', label: accountName(accounts, 'b'), dot: 'bg-partner-b', disabled: !isConnected(accounts, 'b') },
    {
      value: 'shared',
      label: 'Both of us',
      dot: 'bg-shared',
      disabled: !isConnected(accounts, 'a') || !isConnected(accounts, 'b'),
    },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit event' : 'New event'}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEditing ? 'Edit the details of this event.' : 'Add a new event to the calendar.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Dinner with the Andersons"
                autoFocus
              />
            </div>

            {!isEditing ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner">Whose calendar</Label>
                <Select value={form.owner} onValueChange={(v) => update('owner', v as EventOwner)}>
                  <SelectTrigger id="owner" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                        <span className="flex items-center gap-2">
                          <span className={cn('size-2.5 rounded-full', opt.dot)} />
                          {opt.label}
                          {opt.disabled ? ' (not connected)' : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="allDay" className="cursor-pointer">
                All day
              </Label>
              <Switch id="allDay" checked={form.allDay} onCheckedChange={(v) => update('allDay', v)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="startDate">Starts</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update('startDate', e.target.value)}
                />
              </div>
              {!form.allDay ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="startTime">&nbsp;</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => update('startTime', e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="endDate">Ends</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => update('endDate', e.target.value)}
                />
              </div>
              {!form.allDay ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="endTime">&nbsp;</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => update('endTime', e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Notes</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Optional"
                rows={3}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter className="mt-2 flex-row items-center sm:justify-between">
              {isEditing ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : isEditing ? 'Save changes' : 'Add event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              {event?.owner === 'shared'
                ? 'This will remove it from both of your Google Calendars. This cannot be undone.'
                : 'This will remove it from Google Calendar. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function accountName(accounts: Account[], slot: 'a' | 'b') {
  return accounts.find((a) => a.slot === slot)?.name ?? (slot === 'a' ? 'Partner A' : 'Partner B')
}
function isConnected(accounts: Account[], slot: 'a' | 'b') {
  return Boolean(accounts.find((a) => a.slot === slot)?.connected)
}
