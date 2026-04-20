const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.cmmc4msp.on-nex.us'

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { getSession } = await import('next-auth/react')
  const session = await getSession() as any
  const token = (session?.user as any)?.accessToken || ''
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.clone().json()
      detail = j.detail || j.message || detail
    } catch {
      // ignore parse errors
    }
    const err = new Error(detail) as Error & { status?: number; correlationId?: string }
    err.status = res.status
    err.correlationId = res.headers.get('X-Correlation-ID') ?? undefined
    throw err
  }
}

export async function uploadArtifact(
  programControlId: string,
  file: File,
): Promise<{ artifact_id: string; minio_key: string }> {
  const { getSession } = await import('next-auth/react')
  const session = await getSession() as any
  const token = (session?.user as any)?.accessToken || ''
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/artifacts/${programControlId}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  await throwIfNotOk(res)
  return res.json()
}

export async function generateReport(
  programId: string,
  type: 'ssp' | 'poam' | 'sprs-sheet' | 'audit-package'
): Promise<{ download_url: string }> {
  const res = await fetchWithAuth(`${API_URL}/api/reports/${programId}/${type}`, {
    method: 'POST',
  })
  await throwIfNotOk(res)
  return res.json()
}
