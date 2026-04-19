import "server-only"
// ^ Build-time error if this file is imported in a use client component
// This guard prevents: AIOS_API_INTERNAL_URL, auth tokens, and credentials from
// reaching the browser bundle.

import type { Task, Subtask, TaskComment } from "@/types/api"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

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
  const data = await apiGet<{ tasks: Task[] } | Task[]>(`/api/v1/tasks${query ? `?${query}` : ""}`, token)
  return Array.isArray(data) ? data : (data as { tasks: Task[] }).tasks ?? []
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
  const data = await apiGet<{ clients: Client[] } | Client[]>(`/api/v1/clients${buildQueryString(params)}`, token)
  return Array.isArray(data) ? data : (data as { clients: Client[] }).clients ?? []
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
  const data = await apiGet<{ projects: Project[] } | Project[]>(`/api/v1/projects${buildQueryString(params)}`, token)
  return Array.isArray(data) ? data : (data as { projects: Project[] }).projects ?? []
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
  const data = await apiFetch<{ deals: Deal[] } | Deal[]>(`/api/v1/deals${qs}`, token);
  return Array.isArray(data) ? data : (data as { deals: Deal[] }).deals ?? [];
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
  const data = await apiFetch<{ invoices: Invoice[] } | Invoice[]>(`/api/v1/invoices${qs}`, token);
  return Array.isArray(data) ? data : (data as { invoices: Invoice[] }).invoices ?? [];
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
  const data = await apiFetch<{ timeEntries: TimeEntry[] } | TimeEntry[]>(`/api/v1/time-entries${qs}`, token);
  return Array.isArray(data) ? data : (data as { timeEntries: TimeEntry[] }).timeEntries ?? [];
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
  const data = await apiFetch<{ summary: WeeklySummaryDay[] } | WeeklySummaryDay[]>(`/api/v1/time-entries/weekly-summary?user_id=${params.user_id}&week_start=${params.week_start}`, token);
  return Array.isArray(data) ? data : (data as { summary: WeeklySummaryDay[] }).summary ?? [];
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
  const BASE_URL = process.env.AIOS_API_INTERNAL_URL ?? 'http://aios-api:3001'
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
  const data = await apiFetch<{ notifications: Notification[] } | Notification[]>(`/api/v1/notifications${qs}`, token)
  return Array.isArray(data) ? data : (data as { notifications: Notification[] }).notifications ?? []
}
export async function apiMarkNotificationRead(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/notifications/${id}/read`, token, { method: 'PATCH' })
}
export async function apiMarkAllNotificationsRead(token: string): Promise<void> {
  await apiFetch<void>('/api/v1/notifications/read-all', token, { method: 'PATCH' })
}

// === Phase 10: Dashboard ===
export async function apiGetDashboardKpis(token: string): Promise<DashboardKpis> {
  const data = await apiFetch<{ kpis: DashboardKpis }>('/api/v1/dashboard/kpis', token)
  return data.kpis
}
export async function apiGetActivity(token: string): Promise<ActivityEvent[]> {
  const data = await apiFetch<{ activity: ActivityEvent[] }>('/api/v1/activity', token)
  return data.activity ?? []
}
export async function apiGetTeamWorkload(token: string): Promise<TeamWorkloadItem[]> {
  return apiFetch<TeamWorkloadItem[]>('/api/v1/reports/team-workload', token)
}

// === Phase 11: Reports ===
import type { UtilizationRow, RevenueRow, ProfitabilityRow, ClientActivityRow, AdminUser, AuditLogEntry, ReportQueryParams } from "@/types/api"

function buildReportQs(params: ReportQueryParams): string {
  const qs = new URLSearchParams({ period: params.period })
  if (params.start) qs.set('start', params.start)
  if (params.end) qs.set('end', params.end)
  return qs.toString()
}

export async function apiGetUtilizationReport(token: string, params: ReportQueryParams): Promise<UtilizationRow[]> {
  return apiFetch<UtilizationRow[]>(`/api/v1/reports/utilization?${buildReportQs(params)}`, token)
}

export async function apiGetRevenueReport(token: string, params: ReportQueryParams): Promise<RevenueRow[]> {
  return apiFetch<RevenueRow[]>(`/api/v1/reports/revenue?${buildReportQs(params)}`, token)
}

export async function apiGetProfitabilityReport(token: string, params: ReportQueryParams): Promise<ProfitabilityRow[]> {
  return apiFetch<ProfitabilityRow[]>(`/api/v1/reports/profitability?${buildReportQs(params)}`, token)
}

export async function apiGetClientActivityReport(token: string, params: ReportQueryParams): Promise<ClientActivityRow[]> {
  return apiFetch<ClientActivityRow[]>(`/api/v1/reports/client-activity?${buildReportQs(params)}`, token)
}


// === Phase 11: Admin ===

export async function apiGetAdminUsers(token: string): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/api/v1/admin/users', token)
}

export async function apiPatchUserRole(token: string, userId: string, role: string): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/users/${userId}/role`, token, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export async function apiSuspendUser(token: string, userId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/users/${userId}/suspend`, token, { method: 'POST' })
}

export async function apiInviteUser(token: string, body: { email: string; role: string }): Promise<{ invited: boolean }> {
  return apiFetch<{ invited: boolean }>('/api/v1/admin/invite', token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// === Staff + User Profiles ===
import type { StaffMember, UserProfile, CreateStaffInput } from "@/types/api"

export async function apiGetStaff(token: string): Promise<StaffMember[]> {
  return apiFetch<StaffMember[]>("/api/v1/staff", token)
}

export async function apiCreateStaff(token: string, body: CreateStaffInput): Promise<{ id: string; name: string; email: string; role: string }> {
  return apiFetch("/api/v1/admin/staff", token, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function apiPatchStaff(token: string, userId: string, body: Partial<Pick<UserProfile, "timezone" | "job_title" | "phone"> & { status: string }>): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/staff/${userId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function apiGetMyProfile(token: string): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/me/profile", token)
}

export async function apiPatchMyProfile(token: string, body: Partial<Pick<UserProfile, "display_name" | "timezone" | "job_title" | "phone" | "avatar_url">>): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/me/profile", token, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function apiGetAuditLog(token: string): Promise<AuditLogEntry[]> {
  const data = await apiFetch<{ auditLog: AuditLogEntry[] } | { entries: AuditLogEntry[] } | AuditLogEntry[]>('/api/v1/admin/audit-log', token)
  if (Array.isArray(data)) return data
  return (data as any).auditLog ?? (data as any).entries ?? (data as any).log ?? []
}

// === Phase 12: Settings, AI Assistant, Client Portal ===
import type { WorkspaceSettings, SmtpConfig, SmtpConfigInput, N8nConfig, IntegrationStatus, AiChatResponse, AiMemoryStats, PortalMe, PortalProject, PortalInvoice, PortalDocument } from '@/types/api'

// ─── Settings Wrappers ────────────────────────────────────────────────────────

export const apiGetWorkspaceSettings = (token: string) =>
  apiFetch<WorkspaceSettings>('/api/v1/settings/workspace', token)

export const apiUpdateWorkspaceSettings = (token: string, data: Partial<WorkspaceSettings>) =>
  apiFetch<WorkspaceSettings>('/api/v1/settings/workspace', token, { method: 'PUT', body: JSON.stringify(data) })

export const apiGetSmtpConfig = (token: string) =>
  apiFetch<SmtpConfig>('/api/v1/settings/smtp', token)

export const apiUpdateSmtpConfig = (token: string, data: SmtpConfigInput) =>
  apiFetch<{ ok: true }>('/api/v1/settings/smtp', token, { method: 'PUT', body: JSON.stringify(data) })

export const apiTestSmtpSend = (token: string, to: string) =>
  apiFetch<{ success: boolean; error?: string }>('/api/v1/settings/smtp/test-send', token, {
    method: 'POST', body: JSON.stringify({ to })
  })

export const apiGetN8nConfig = (token: string) =>
  apiFetch<N8nConfig>('/api/v1/settings/n8n', token)

export const apiUpdateN8nConfig = (token: string, data: N8nConfig) =>
  apiFetch<{ ok: true }>('/api/v1/settings/n8n', token, { method: 'PUT', body: JSON.stringify(data) })

export const apiGetIntegrations = (token: string) =>
  apiFetch<IntegrationStatus[]>('/api/v1/settings/integrations', token)

// ─── AI Assistant Wrappers ────────────────────────────────────────────────────

export const apiAiChat = (token: string, query: string) =>
  apiFetch<AiChatResponse>('/api/v1/ai/chat', token, { method: 'POST', body: JSON.stringify({ query }) })

export const apiGetAiMemoryStats = (token: string) =>
  apiFetch<AiMemoryStats>('/api/v1/ai/memory/stats', token)

export const apiClearAiMemory = (token: string) =>
  apiFetch<{ deleted: number }>('/api/v1/ai/memory', token, { method: 'DELETE' })

// ─── Client Portal Wrappers ───────────────────────────────────────────────────

export const apiGetPortalMe = (token: string) =>
  apiFetch<PortalMe>('/api/v1/portal/me', token)

export const apiGetPortalProjects = (token: string) =>
  apiFetch<{ projects: PortalProject[] }>('/api/v1/portal/projects', token)

export const apiGetPortalInvoices = (token: string) =>
  apiFetch<{ invoices: PortalInvoice[] }>('/api/v1/portal/invoices', token)

export const apiGetPortalDocuments = (token: string) =>
  apiFetch<{ documents: PortalDocument[] }>('/api/v1/portal/documents', token)
