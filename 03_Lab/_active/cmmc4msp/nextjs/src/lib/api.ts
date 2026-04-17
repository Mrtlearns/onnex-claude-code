const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.cmmc4msp.on-nex.us'
const MINIO_PUBLIC_URL = (process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL || 'https://s3.cmmc4msp.on-nex.us').replace(/\/$/, '')

function rewriteMinioUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Rewrite any non-https or private-network MinIO URL to the public endpoint
    const isPrivate = parsed.protocol === 'http:' && (
      parsed.hostname.startsWith('10.') ||
      parsed.hostname.startsWith('192.168.') ||
      parsed.hostname.startsWith('172.') ||
      parsed.hostname === 'minio' ||
      parsed.hostname === 'localhost'
    )
    if (isPrivate || parsed.protocol === 'http:') {
      const pub = new URL(MINIO_PUBLIC_URL)
      parsed.protocol = pub.protocol
      parsed.host = pub.host
      return parsed.toString()
    }
    return url
  } catch {
    return url
  }
}

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

export async function initArtifactUpload(
  programControlId: string,
  fileName: string,
  mimeType: string
): Promise<{ presigned_url: string; artifact_id: string; minio_key: string }> {
  const res = await fetchWithAuth(`${API_URL}/api/artifacts/${programControlId}/upload`, {
    method: 'POST',
    body: JSON.stringify({ file_name: fileName, mime_type: mimeType }),
  })
  if (!res.ok) throw new Error('Failed to init upload')
  return res.json()
}

export async function uploadFileToMinIO(presignedUrl: string, file: File): Promise<void> {
  const res = await fetch(rewriteMinioUrl(presignedUrl), {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!res.ok) throw new Error('MinIO upload failed')
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
