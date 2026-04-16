import type {
  WorkshopOrder,
  WorkshopSettings,
  WorkshopMachine,
  CreateOrderPayload,
  ScheduleJobPayload,
  ScanWebhookPayload,
} from './types'
import { getAuthHeaders } from '@/lib/api'

const BASE = '/api/workshop'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: getAuthHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
}

export const workshopApi = {
  /** POST /api/workshop/orders — create order + jobs */
  createOrder(payload: CreateOrderPayload): Promise<WorkshopOrder> {
    return post<WorkshopOrder>('/orders', payload)
  },

  /** POST /api/workshop/webhook/scan */
  scan(payload: ScanWebhookPayload): Promise<void> {
    return post<void>('/webhook/scan', payload)
  },

  /** POST /api/workshop/jobs/:id/schedule */
  scheduleJob(jobId: string, payload: ScheduleJobPayload): Promise<void> {
    return post<void>(`/jobs/${jobId}/schedule`, payload)
  },

  /** POST /api/workshop/jobs/:id/duration */
  updateDuration(jobId: string, durationMinutes: number): Promise<void> {
    return post<void>(`/jobs/${jobId}/duration`, { durationMinutes })
  },

  /** POST /api/workshop/jobs/replan */
  replanJobs(jobIds: string[]): Promise<{ rescheduled: number; failed: string[] }> {
    return post<{ rescheduled: number; failed: string[] }>('/jobs/replan', { jobIds })
  },

  /** PATCH /api/workshop/settings/:key */
  updateSetting(key: string, value: unknown): Promise<void> {
    return patch<void>(`/settings/${key}`, { value })
  },

  /** GET /api/workshop/settings — one-time fetch */
  async getSettings(): Promise<WorkshopSettings> {
    const res = await fetch(`${BASE}/settings`, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('Failed to load workshop settings')
    return res.json() as Promise<WorkshopSettings>
  },

  /** GET /api/workshop/machines */
  async getMachines(): Promise<WorkshopMachine[]> {
    const res = await fetch(`${BASE}/machines`, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('Failed to load machines')
    return res.json() as Promise<WorkshopMachine[]>
  },

  /** POST /api/workshop/machines */
  createMachine(data: { name: string; type: string; inspectorName?: string | null; displayOrder?: number }): Promise<WorkshopMachine> {
    return post<WorkshopMachine>('/machines', data)
  },

  /** PUT /api/workshop/machines/:id */
  updateMachine(id: string, data: { name?: string; inspectorName?: string | null; displayOrder?: number; isActive?: boolean }): Promise<WorkshopMachine> {
    return put<WorkshopMachine>(`/machines/${id}`, data)
  },

  /** DELETE /api/workshop/machines/:id */
  deleteMachine(id: string): Promise<void> {
    return del(`/machines/${id}`)
  },

  /** POST /api/workshop/machines/:id/offline */
  addOfflineWindow(machineId: string, data: { startAt: string; endAt: string; reason?: string | null }): Promise<void> {
    return post<void>(`/machines/${machineId}/offline`, data)
  },

  /** DELETE /api/workshop/machines/:id/offline/:wid */
  removeOfflineWindow(machineId: string, windowId: string): Promise<void> {
    return del(`/machines/${machineId}/offline/${windowId}`)
  },

  /** GET /api/workshop/today — one-time snapshot for SSE init fallback */
  async getToday(): Promise<WorkshopOrder[]> {
    const res = await fetch(`${BASE}/today`, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error('Failed to load today orders')
    return res.json() as Promise<WorkshopOrder[]>
  },

  /** DELETE /api/workshop/simulation/clear */
  clearSimulation(): Promise<void> {
    return del('/simulation/clear')
  },
}
