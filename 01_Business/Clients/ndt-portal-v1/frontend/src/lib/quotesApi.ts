import { getAuthHeaders } from '@/lib/api'

export const quotesApi = {
  // Combined UT+RT quote history
  list: () =>
    fetch('/api/quotes', { headers: getAuthHeaders() }).then(r => r.json()),

  // UT quote (PostgREST row access)
  listUt: () =>
    fetch('/api/ut/quote', { headers: getAuthHeaders() }).then(r => r.json()),

  getUt: (id: string) =>
    fetch(`/api/ut/quote/${id}`, { headers: getAuthHeaders() }).then(r => r.json()),

  updateUt: (id: string, data: Record<string, unknown>) =>
    fetch(`/api/ut/quote/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }),

  // RT quote
  calculateRt: (data: unknown) =>
    fetch('/api/rt/quote', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),
}
