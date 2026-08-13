export type PartnerSlot = 'a' | 'b'
export type EventOwner = PartnerSlot | 'shared'
export type EventColor = 'partner-a' | 'partner-b' | 'shared'

export interface Account {
  slot: PartnerSlot
  name: string
  color: EventColor
  connected: boolean
  email: string | null
}

export interface CalendarEvent {
  id: string
  owner: EventOwner
  color: EventColor
  title: string
  description: string | null
  location: string | null
  start: string
  end: string
  allDay: boolean
  htmlLink: string | null
  editable: boolean
}

export interface EventDraft {
  owner: EventOwner
  title: string
  description?: string
  location?: string
  start: string
  end: string
  allDay: boolean
}

export type CalendarViewKind = 'day' | 'week' | 'month' | 'year'
