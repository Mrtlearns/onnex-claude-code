import { getAuthHeaders } from '@/lib/api'

const BASE = '/api/ut/integrations/pipeline'

export const integrationsApi = {
  analyze: (body: BodyInit) =>
    fetch(`${BASE}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      body,
    }).then(r => r.json()),

  getStatus: (intakeId: string) =>
    fetch(`${BASE}/status/${intakeId}`, { headers: getAuthHeaders() }).then(r => r.json()),

  getAudit: (intakeId: string) =>
    fetch(`${BASE}/audit/${intakeId}`, { headers: getAuthHeaders() }).then(r => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    }),

  getSessions: () =>
    fetch(`${BASE}/sessions`, { headers: getAuthHeaders() }).then(r => r.json()),
}
