import type { Account, CalendarEvent, EventDraft, PartnerSlot } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error?.toString() ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export { ApiError }

export const api = {
  session: () => request<{ authenticated: boolean }>('/auth/session'),
  login: (password: string) =>
    request<{ authenticated: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () => request<{ authenticated: boolean }>('/auth/logout', { method: 'POST' }),

  accounts: () => request<{ accounts: Account[]; googleConfigured: boolean }>('/accounts'),
  connectUrl: (slot: PartnerSlot) => `${API_BASE}/accounts/${slot}/connect`,
  disconnectAccount: (slot: PartnerSlot) =>
    request<{ ok: true }>(`/accounts/${slot}`, { method: 'DELETE' }),

  events: (startISO: string, endISO: string) =>
    request<{ events: CalendarEvent[] }>(
      `/events?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
    ),
  createEvent: (draft: EventDraft) =>
    request<{ event: CalendarEvent }>('/events', {
      method: 'POST',
      body: JSON.stringify(draft),
    }),
  updateEvent: (id: string, draft: Omit<EventDraft, 'owner'>) =>
    request<{ event: CalendarEvent }>(`/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(draft),
    }),
  deleteEvent: (id: string) =>
    request<{ ok: true }>(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
