import { getAuthHeaders } from '@/lib/api'

const SF_BASE = '/api/ut/sf-analysis'
const BOM_BASE = '/api/ut/bom'

export const sfAnalysisApi = {
  chat: (messages: Array<{ role: string; content: string }>) =>
    fetch(`${SF_BASE}/chat`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ messages }),
    }).then(r => r.json()),

  getCustomers: (q?: string, limit?: number) => {
    const qs = new URLSearchParams()
    if (q) qs.set('q', q)
    if (limit != null) qs.set('limit', String(limit))
    const query = qs.toString()
    return fetch(`${SF_BASE}/customers${query ? `?${query}` : ''}`, { headers: getAuthHeaders() }).then(r => r.json())
  },

  getCustomerActivity: (sfId: string) =>
    fetch(`${SF_BASE}/customers/${sfId}/activity`, { headers: getAuthHeaders() }).then(r => r.json()),

  getAccounts: (limit = 200) =>
    fetch(`${BOM_BASE}/accounts?limit=${limit}`, { headers: getAuthHeaders() }).then(r => r.json()),

  getParts: (params?: {
    q?: string
    account?: string
    service?: string
    limit?: number
    offset?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.account) qs.set('account', params.account)
    if (params?.service) qs.set('service', params.service)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.offset != null) qs.set('offset', String(params.offset))
    return fetch(`${BOM_BASE}/parts?${qs}`, { headers: getAuthHeaders() }).then(r => r.json())
  },

  getPartHistory: (partNumber: string) =>
    fetch(`${BOM_BASE}/parts/${encodeURIComponent(partNumber)}/history`, { headers: getAuthHeaders() }).then(r => r.json()),

  getAccountParts: (sfId: string) =>
    fetch(`${BOM_BASE}/accounts/${sfId}/parts`, { headers: getAuthHeaders() }).then(r => r.json()),
}
