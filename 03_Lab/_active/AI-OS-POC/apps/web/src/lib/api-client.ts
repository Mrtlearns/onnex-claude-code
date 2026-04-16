import "server-only"
// ^ Build-time error if this file is imported in a use client component
// This guard prevents: AIOS_API_INTERNAL_URL, auth tokens, and credentials from
// reaching the browser bundle.

import type { Task, Subtask, TaskComment } from "@/types/api"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3000"

export async function apiFetch<T>(
  path: string,
  bearerToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${AIOS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    next: { tags: [path.split("/").filter(Boolean)[1] ?? "api"] },
  })

  if (res.status === 401) throw new Error("Unauthorized -- session may have expired")
  if (res.status === 403) throw new Error("Forbidden -- insufficient role")
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)

  return res.json() as Promise<T>
}

export async function apiGet<T>(path: string, bearerToken: string): Promise<T> {
  return apiFetch<T>(path, bearerToken)
}

export async function apiPost<T>(path: string, bearerToken: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, bearerToken, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function apiPatch<T>(path: string, bearerToken: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, bearerToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function apiDelete(path: string, bearerToken: string): Promise<void> {
  await apiFetch<void>(path, bearerToken, { method: "DELETE" })
}

// ---------------------------------------------------------------------------
// Task-specific typed wrappers
// ---------------------------------------------------------------------------

export async function apiGetTasks(
  token: string,
  params?: Record<string, string | undefined>,
): Promise<Task[]> {
  const searchParams = new URLSearchParams()
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) searchParams.set(key, val)
    }
  }
  const query = searchParams.toString()
  return apiGet<Task[]>(`/api/v1/tasks${query ? `?${query}` : ""}`, token)
}

export async function apiGetTask(token: string, id: string): Promise<Task> {
  return apiGet<Task>(`/api/v1/tasks/${id}`, token)
}

export async function apiCreateTask(
  token: string,
  body: Record<string, unknown>,
): Promise<Task> {
  return apiPost<Task>("/api/v1/tasks", token, body)
}

export async function apiPatchTask(
  token: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Task> {
  return apiPatch<Task>(`/api/v1/tasks/${id}`, token, body)
}

export async function apiGetSubtasks(token: string, taskId: string): Promise<Subtask[]> {
  return apiGet<Subtask[]>(`/api/v1/tasks/${taskId}/subtasks`, token)
}

export async function apiGetComments(token: string, taskId: string): Promise<TaskComment[]> {
  return apiGet<TaskComment[]>(`/api/v1/tasks/${taskId}/comments`, token)
}

import type { Client, Contact, Project, CreateClientInput, CreateProjectInput } from "@/types/api"

// ─── Client Typed Wrappers ────────────────────────────────────────────────────

function buildQueryString(params?: Record<string, string | undefined>): string {
  if (!params) return ""
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") qs.set(key, val)
  }
  const str = qs.toString()
  return str ? `?${str}` : ""
}

export async function apiGetClients(
  token: string,
  params?: Record<string, string | undefined>,
): Promise<Client[]> {
  return apiGet<Client[]>(`/api/v1/clients${buildQueryString(params)}`, token)
}

export async function apiGetClient(token: string, id: string): Promise<Client> {
  return apiGet<Client>(`/api/v1/clients/${id}`, token)
}

export async function apiCreateClient(token: string, body: CreateClientInput): Promise<Client> {
  return apiPost<Client>("/api/v1/clients", token, body)
}

export async function apiPatchClient(
  token: string,
  id: string,
  body: Partial<CreateClientInput>,
): Promise<Client> {
  return apiPatch<Client>(`/api/v1/clients/${id}`, token, body)
}

export async function apiArchiveClient(token: string, id: string): Promise<void> {
  return apiPatch<void>(`/api/v1/clients/${id}/archive`, token, {})
}

export async function apiCreateContact(
  token: string,
  clientId: string,
  body: { name: string; email?: string; phone?: string; role?: string },
): Promise<Contact> {
  return apiPost<Contact>(`/api/v1/clients/${clientId}/contacts`, token, body)
}

// ─── Project Typed Wrappers ───────────────────────────────────────────────────

export async function apiGetProjects(
  token: string,
  params?: Record<string, string | undefined>,
): Promise<Project[]> {
  return apiGet<Project[]>(`/api/v1/projects${buildQueryString(params)}`, token)
}

export async function apiGetProject(token: string, id: string): Promise<Project> {
  return apiGet<Project>(`/api/v1/projects/${id}`, token)
}

export async function apiCreateProject(token: string, body: CreateProjectInput): Promise<Project> {
  return apiPost<Project>("/api/v1/projects", token, body)
}

export async function apiPatchProject(
  token: string,
  id: string,
  body: Partial<CreateProjectInput>,
): Promise<Project> {
  return apiPatch<Project>(`/api/v1/projects/${id}`, token, body)
}

export async function apiArchiveProject(token: string, id: string): Promise<void> {
  return apiPatch<void>(`/api/v1/projects/${id}/archive`, token, {})
}

// -- Phase 9: Financial Loop -- Deals -----------------------------------------
import type { Deal, Invoice, InvoiceLineItem, TimeEntry, WeeklySummaryDay } from "@/types/api"

export async function apiGetDeals(token: string, params?: Record<string, string>): Promise<Deal[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch(`/api/v1/deals${qs}`, token);
}
export async function apiGetDeal(token: string, id: string): Promise<Deal> {
  return apiFetch(`/api/v1/deals/${id}`, token);
}
export async function apiCreateDeal(token: string, body: unknown): Promise<Deal> {
  return apiFetch('/api/v1/deals', token, { method: 'POST', body: JSON.stringify(body) });
}
export async function apiPatchDeal(token: string, id: string, body: unknown): Promise<Deal> {
  return apiFetch(`/api/v1/deals/${id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function apiPatchDealStage(token: string, id: string, body: { status: string; stage: string }): Promise<Deal> {
  return apiFetch(`/api/v1/deals/${id}/stage`, token, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function apiConvertDealToInvoice(token: string, dealId: string): Promise<Invoice> {
  return apiFetch(`/api/v1/deals/${dealId}/convert`, token, { method: 'POST' });
}

// -- Phase 9: Financial Loop -- Invoices --------------------------------------
export async function apiGetInvoices(token: string, params?: Record<string, string>): Promise<Invoice[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch(`/api/v1/invoices${qs}`, token);
}
export async function apiGetInvoice(token: string, id: string): Promise<Invoice> {
  return apiFetch(`/api/v1/invoices/${id}`, token);
}
export async function apiCreateInvoice(token: string, body: unknown): Promise<Invoice> {
  return apiFetch('/api/v1/invoices', token, { method: 'POST', body: JSON.stringify(body) });
}
export async function apiPatchInvoiceStatus(token: string, id: string, body: { status: string; paid_at?: string }): Promise<Invoice> {
  return apiFetch(`/api/v1/invoices/${id}/status`, token, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function apiSendInvoice(token: string, id: string): Promise<{ sent: boolean }> {
  return apiFetch(`/api/v1/invoices/${id}/send`, token, { method: 'POST' });
}
export async function apiGetInvoiceTimeEntries(token: string, invoiceId: string, projectId: string): Promise<TimeEntry[]> {
  return apiFetch(`/api/v1/invoices/${invoiceId}/time-entries?project_id=${projectId}`, token);
}
export async function apiCreateLineItem(token: string, invoiceId: string, body: unknown): Promise<InvoiceLineItem> {
  return apiFetch(`/api/v1/invoices/${invoiceId}/line-items`, token, { method: 'POST', body: JSON.stringify(body) });
}

// -- Phase 9: Financial Loop -- Time Entries ----------------------------------
export async function apiGetTimeEntries(token: string, params?: Record<string, string>): Promise<TimeEntry[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch(`/api/v1/time-entries${qs}`, token);
}
export async function apiCreateTimeEntry(token: string, body: unknown): Promise<TimeEntry> {
  return apiFetch('/api/v1/time-entries', token, { method: 'POST', body: JSON.stringify(body) });
}
export async function apiPatchTimeEntry(token: string, id: string, body: unknown): Promise<TimeEntry> {
  return apiFetch(`/api/v1/time-entries/${id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function apiDeleteTimeEntry(token: string, id: string): Promise<void> {
  return apiFetch(`/api/v1/time-entries/${id}`, token, { method: 'DELETE' });
}
export async function apiGetWeeklySummary(token: string, params: { user_id: string; week_start: string }): Promise<WeeklySummaryDay[]> {
  return apiFetch(`/api/v1/time-entries/weekly-summary?user_id=${params.user_id}&week_start=${params.week_start}`, token);
}

// === Phase 10: Documents, Dashboard, Notifications ===
import type { PaperlessDocument, DocumentLink, Notification, ActivityEvent, DashboardKpis, TeamWorkloadItem } from "@/types/api"
import type { CreateDocumentLinkInput } from "@/lib/schemas"

// === Phase 10: Documents (via BFF proxies — NOT direct to Paperless/Nextcloud) ===
// These functions call BFF Route Handlers, NOT the external services directly.

// Paperless proxy (BFF → /api/bff/paperless/documents)
export async function apiGetPaperlessDocs(token: string): Promise<PaperlessDocument[]> {
  return apiFetch<PaperlessDocument[]>('/api/v1/bff/paperless/documents', token)
  // NOTE: This wrapper is for server-side use; BFF routes handle Paperless auth
}

// Document upload → triggers Temporal workflow
export async function apiUploadDocument(token: string, formData: FormData): Promise<{ workflowRunId: string }> {
  const BASE_URL = process.env.AIOS_API_INTERNAL_URL ?? 'http://aios-api:3000'
  const res = await fetch(`${BASE_URL}/api/v1/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // NO Content-Type — fetch sets multipart boundary
    body: formData,
  })
  if (!res.ok) throw new Error(`Upload error ${res.status}`)
  return res.json()
}

// Document links
export async function apiGetDocumentLinks(token: string, params: { entity_type: string; entity_id: string }): Promise<DocumentLink[]> {
  const qs = new URLSearchParams(params as Record<string, string>)
  return apiFetch<DocumentLink[]>(`/api/v1/document-links?${qs}`, token)
}
export async function apiCreateDocumentLink(token: string, body: CreateDocumentLinkInput): Promise<DocumentLink> {
  return apiFetch<DocumentLink>('/api/v1/document-links', token, { method: 'POST', body: JSON.stringify(body) })
}
export async function apiDeleteDocumentLink(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/document-links/${id}`, token, { method: 'DELETE' })
}

// === Phase 10: Notifications ===
export async function apiGetNotifications(token: string, unreadOnly?: boolean): Promise<Notification[]> {
  const qs = unreadOnly ? '?unread_only=true' : ''
  return apiFetch<Notification[]>(`/api/v1/notifications${qs}`, token)
}
export async function apiMarkNotificationRead(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/notifications/${id}/read`, token, { method: 'PATCH' })
}
export async function apiMarkAllNotificationsRead(token: string): Promise<void> {
  await apiFetch<void>('/api/v1/notifications/read-all', token, { method: 'PATCH' })
}

// === Phase 10: Dashboard ===
export async function apiGetDashboardKpis(token: string): Promise<DashboardKpis> {
  return apiFetch<DashboardKpis>('/api/v1/dashboard/kpis', token)
}
export async function apiGetActivity(token: string): Promise<ActivityEvent[]> {
  return apiFetch<ActivityEvent[]>('/api/v1/activity', token)
}
export async function apiGetTeamWorkload(token: string): Promise<TeamWorkloadItem[]> {
  return apiFetch<TeamWorkloadItem[]>('/api/v1/reports/team-workload', token)
}
