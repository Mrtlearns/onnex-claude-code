import { getAuthHeaders } from '@/lib/api'

const BASE = '/api/ut/admin'

export const adminApi = {
  getAnalytics: (params: { start: string; end: string }) =>
    fetch(`${BASE}/analytics?start=${encodeURIComponent(params.start)}&end=${encodeURIComponent(params.end)}`, { headers: getAuthHeaders() }).then(r => r.json()),

  triggerSync: () =>
    fetch(`${BASE}/sync/trigger`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),

  aiQuery: (query: string) =>
    fetch(`${BASE}/ai-query`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query }),
    }).then(r => r.json()),

  getPortalConfig: () =>
    fetch(`${BASE}/portal-config`, { headers: getAuthHeaders() }).then(r => r.json()),

  getJobs: (params?: { limit?: number; offset?: number; job?: string }) => {
    const qs = new URLSearchParams()
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.offset != null) qs.set('offset', String(params.offset))
    if (params?.job) qs.set('job', params.job)
    const q = qs.toString()
    return fetch(`${BASE}/jobs${q ? `?${q}` : ''}`, { headers: getAuthHeaders() }).then(r => r.json())
  },
}
