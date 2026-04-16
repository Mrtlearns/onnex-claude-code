import { getAuthHeaders } from '@/lib/api'

const BASE = '/api/ut/settings'

export interface FolderReference {
  id: string
  alias: string
  displayName: string
  nextcloudPath: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const settingsApi = {
  // LLM providers
  getProviders: () =>
    fetch(`${BASE}/providers`, { headers: getAuthHeaders() }).then(r => r.json()),

  saveProvider: (name: string, data: { apiKey?: string; model?: string; setDefault?: boolean }) =>
    fetch(`${BASE}/providers/${name}`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),

  testProvider: (name: string, data: { apiKey?: string; model?: string }) =>
    fetch(`${BASE}/providers/${name}/test`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),

  // Chat AI
  getChat: () =>
    fetch(`${BASE}/chat`, { headers: getAuthHeaders() }).then(r => r.json()),

  saveChat: (data: { chatProvider: string; chatModel: string }) =>
    fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),

  // LLM auth method
  getLlmAuthMethod: () =>
    fetch(`${BASE}/llm-auth-method`, { headers: getAuthHeaders() }).then(r => r.json()),

  saveLlmAuthMethod: (method: string) =>
    fetch(`${BASE}/llm-auth-method`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ method }),
    }).then(r => r.json()),

  // Folder references
  getFolderReferences: (): Promise<FolderReference[]> =>
    fetch(`${BASE}/folder-references`, { headers: getAuthHeaders() }).then(r => r.json()),

  createFolderReference: (data: {
    alias: string
    displayName: string
    nextcloudPath: string
    description?: string
  }): Promise<FolderReference> =>
    fetch(`${BASE}/folder-references`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),

  updateFolderReference: (id: string, data: Partial<{
    alias: string
    displayName: string
    nextcloudPath: string
    description: string
    isActive: boolean
  }>): Promise<FolderReference> =>
    fetch(`${BASE}/folder-references/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteFolderReference: (id: string) =>
    fetch(`${BASE}/folder-references/${id}`, { method: 'DELETE', headers: getAuthHeaders() }),

  // ITAR keyword library
  getItarKeywords: () =>
    fetch(`${BASE}/itar-keywords`, { headers: getAuthHeaders() }).then(r => r.json()),

  addItarKeyword: (data: { keyword: string; category: string; weight: number; description?: string }) =>
    fetch(`${BASE}/itar-keywords`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),

  updateItarKeyword: (id: number, data: { category?: string; weight?: number; description?: string }) =>
    fetch(`${BASE}/itar-keywords/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteItarKeyword: (id: number) =>
    fetch(`${BASE}/itar-keywords/${id}`, { method: 'DELETE', headers: getAuthHeaders() }).then(r => r.json()),

  getItarAuditLog: (limit = 50, offset = 0) =>
    fetch(`${BASE}/itar-keywords/audit-log?limit=${limit}&offset=${offset}`, { headers: getAuthHeaders() }).then(r => r.json()),
}
