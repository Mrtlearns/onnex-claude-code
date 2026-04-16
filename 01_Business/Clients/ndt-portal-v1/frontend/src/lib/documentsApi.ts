import { getAuthHeaders } from '@/lib/api'

const BASE = '/api/documents'

function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/')
}

export const documentsApi = {
  /** PROPFIND — list directory or file metadata as XML string */
  list: (path: string) =>
    fetch(`${BASE}/${encodePath(path)}`, { headers: getAuthHeaders() }).then(r => r.text()),

  /** Download file bytes */
  download: (path: string) =>
    fetch(`${BASE}/${encodePath(path)}?download=1`, { headers: getAuthHeaders() }),

  /** Convert to PDF via Collabora */
  convertToPdf: (path: string) =>
    fetch(`${BASE}/${encodePath(path)}?convert=pdf`, { headers: getAuthHeaders() }),

  /** WebDAV PUT upload */
  upload: (path: string, body: BodyInit, contentType?: string) =>
    fetch(`${BASE}/${encodePath(path)}`, {
      method: 'PUT',
      headers: getAuthHeaders(contentType ? { 'Content-Type': contentType } : {}),
      body,
    }),

  /** OCS Sharing API — create public read-only share link */
  shareLink: (path: string) =>
    fetch(`${BASE}/${encodePath(path)}`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),

  /** MKCOL — create folder */
  mkdir: (path: string) =>
    fetch(`${BASE}/mkdir/${encodePath(path)}`, { method: 'POST', headers: getAuthHeaders() }),

  /** WebDAV DELETE */
  delete: (path: string) =>
    fetch(`${BASE}/${encodePath(path)}`, { method: 'DELETE', headers: getAuthHeaders() }),
}
