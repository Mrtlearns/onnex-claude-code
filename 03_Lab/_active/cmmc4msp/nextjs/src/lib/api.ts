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
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

export async function generateReport(
  programId: string,
  type: 'ssp' | 'poam'
): Promise<{ download_url: string }> {
  const res = await fetchWithAuth(`${API_URL}/api/reports/${programId}/${type}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Report generation failed')
  return res.json()
}
