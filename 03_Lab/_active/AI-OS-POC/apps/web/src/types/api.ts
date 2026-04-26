// apps/web/src/types/api.ts
// Shared API response types — mirrors aios-api DB schema (008_core_ops.sql)

import { z } from "zod"

// ─── Task Types (from 08-01) ──────────────────────────────────────────────────

export type TaskStatus = 'Backlog' | 'In Progress' | 'Review' | 'Done'

export interface Task {
  id: string
  tenant_id: string
  project_id?: string
  parent_task_id?: string
  assignee_id?: string
  assignee_ids?: string[]
  title: string
  description?: string
  status: TaskStatus
  priority?: string
  due_date?: string
  start_date?: string
  end_date?: string
  estimated_hours?: number
  actual_hours?: number
  task_type?: 'manual' | 'code' | 'content' | 'research' | 'business'
  ai_output?: string
  ai_completed_at?: string
  ai_session_id?: string
  external_id?: string
  external_source?: string
  created_at: string
  archived_at?: string
}

export interface TaskDependency {
  id: string
  task_id: string
  depends_on_task_id: string
  depends_on_title?: string
  dependency_type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate'
  created_at: string
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  completed: boolean
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
}

// ─── Client + Contact Types ───────────────────────────────────────────────────

export interface Client {
  id: string
  tenant_id: string
  name: string
  type: "Agency" | "Direct"
  status: "Active" | "Prospect" | "Churned"
  billing_address?: string
  created_at: string
  archived_at?: string
  contacts?: Contact[] // present on GET /:id
}

export interface Contact {
  id: string
  client_id: string
  name: string
  email?: string
  phone?: string
  role?: string
}

// ─── Project Types ────────────────────────────────────────────────────────────

export interface Project {
  id: string
  tenant_id: string
  client_id?: string
  name: string
  description?: string
  health?: 'on_track' | 'at_risk' | 'blocked'
  color?: string
  status: "Active" | "Completed" | "On Hold" | "Onboarding"
  start_date?: string
  end_date?: string
  budget?: number
  phases: Array<{
    name: string
    completed: boolean
    start_date?: string
    end_date?: string
    assignee_id?: string
    assignee_name?: string
  }>
  created_at: string
  archived_at?: string
  task_count?: number // present on GET /:id
  client_name?: string // joined from clients table
  plane_project_id?: string | null
  plane_workspace_slug?: string | null
  plane_project_name?: string | null
}

// ─── Plane Integration ────────────────────────────────────────────────────────

export interface PlaneIssue {
  id: string
  sequence_id: number
  name: string
  state: { name: string; group: "backlog" | "unstarted" | "started" | "completed" | "cancelled" }
  priority: "urgent" | "high" | "medium" | "low" | "none"
  assignees: string[]
  plane_url: string
}

export interface PlaneProject {
  id: string
  name: string
  identifier: string
  workspace_slug: string
}

export interface ProjectNote {
  id: string
  project_id: string
  content: string
  author_id: string
  author_name: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  user_name: string
  avatar_url?: string | null
  role: string
  added_at: string
  logged_minutes: number
}

// ─── Generic Pagination ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Zod Schemas for Form Validation ─────────────────────────────────────────

export const CreateClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Agency", "Direct"], { required_error: "Type is required" }),
  status: z.enum(["Active", "Prospect", "Churned"]).default("Prospect"),
  billing_address: z.string().optional(),
})

export type CreateClientInput = z.infer<typeof CreateClientSchema>

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  client_id: z.string().uuid("Must be a valid UUID").optional().or(z.literal("")),
  status: z.enum(["Active", "Completed", "On Hold", "Onboarding"]).default("Active"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.number().positive("Budget must be positive").optional(),
  description: z.string().optional(),
  health: z.enum(["on_track", "at_risk", "blocked"]).optional(),
  color: z.string().optional(),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>

// -- Phase 9: Financial Loop --------------------------------------------------
export type DealStatus = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export interface Deal {
  id: string; tenant_id: string; client_id: string; title: string;
  value: number; probability: number; status: DealStatus;
  stage: string; expected_close: string | null; owner_id: string | null;
  created_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'void';
export interface Invoice {
  id: string; tenant_id: string; client_id: string; deal_id: string | null;
  status: InvoiceStatus; due_date: string | null; sent_at: string | null;
  paid_at: string | null; tax_pct: number; notes: string | null; created_at: string;
}
export interface InvoiceLineItem {
  id: string; invoice_id: string; description: string;
  qty: number; rate: number; time_entry_id: string | null;
}
export interface TimeEntry {
  id: string; tenant_id: string; project_id: string; task_id: string | null;
  user_id: string; description: string; duration_minutes: number;
  date: string; billable: boolean;
  started_at: string | null; stopped_at: string | null; created_at: string;
}
export interface WeeklySummaryDay {
  date: string; total_minutes: number; billable_minutes: number;
}

// === Phase 10: Documents, Dashboard, Notifications ===

export interface PaperlessDocument {
  id: number; title: string; created: string; modified: string;
  correspondent: string | null; tags: string[]; archived_file_name: string | null;
}

export interface NextcloudFile {
  name: string; path: string; type: 'file' | 'directory'; size: number; lastModified: string;
}

export type DocumentSource = 'paperless' | 'nextcloud'
export type DocumentEntityType = 'client' | 'project' | 'deal' | 'task'

export interface DocumentLink {
  id: string
  tenant_id: string
  document_source: DocumentSource
  document_id: string
  entity_type: DocumentEntityType
  entity_id: string
  link_type: 'file' | 'folder'
  display_name?: string
  created_at: string
}

export interface DocumentComment {
  id: string
  tenant_id: string
  document_source: string
  document_id: string
  entity_type: string
  entity_id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
}

export interface Notification {
  id: string; tenant_id: string; user_id: string; type: string;
  title: string; body: string; entity_type: string | null; entity_id: string | null;
  read_at: string | null; created_at: string;
}

export interface ActivityEvent {
  id: string; tenant_id: string; user_id: string;
  event_type: 'task_updated' | 'deal_stage_changed' | 'document_uploaded' | 'invoice_sent';
  entity_type: string; entity_id: string; metadata: Record<string, unknown>; created_at: string;
}

export interface DashboardKpis {
  active_projects_count: number;
  overdue_invoices_count?: number;
  overdue_invoices_total?: number;
  utilization_pct?: number;
  open_deals_value?: number;
  team_workload_count?: number;
}

export interface TeamWorkloadItem {
  assignee_id: string; task_count: number; hours_this_week: number;
}

// === Phase 11: Reports + Admin ===

export type ReportPeriod = 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'

export interface ReportQueryParams {
  period: ReportPeriod
  start?: string   // ISO date string, only used when period='custom'
  end?: string     // ISO date string, only used when period='custom'
}

export interface UtilizationRow {
  user_id: string
  user_name: string
  total_minutes: number
  capacity_minutes: number
  utilization_pct: number
}

export interface RevenueRow {
  client_id: string
  client_name: string
  invoiced_total: number
  received_total: number
}

export interface ProfitabilityRow {
  project_id: string
  project_name: string
  revenue: number
  cost: number
  margin: number
  margin_pct: number
}

export interface ClientActivityRow {
  client_id: string
  client_name: string
  event_count: number
  last_active_at: string | null
}

export interface AdminUser {
  id: string
  name: string
  email: string
  is_active: boolean
  role: string
}

export interface StaffMember {
  user_id: string
  display_name: string
  avatar_url: string | null
  job_title: string | null
  status: string
  timezone: string | null
}

export interface UserProfile extends StaffMember {
  tenant_id: string
  phone: string | null
  created_at: string
  updated_at: string
}

export interface CreateStaffInput {
  name: string
  email: string
  password: string
  role: string
  timezone?: string | null
  job_title?: string | null
  phone?: string | null
}

export interface AuditLogEntry {
  id: string
  actor_id: string
  actor_name: string
  action: string
  target_type: string
  target_id: string | null
  target_label: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

// ─── Phase 12: Settings ───────────────────────────────────────────────────

export interface WorkspaceSettings {
  name: string
  logo_url: string | null
  timezone: string
  default_currency: string
}

export interface SmtpConfig {
  host: string
  port: number
  user: string
  from_address: string
  has_password: boolean
}

export interface SmtpConfigInput extends Omit<SmtpConfig, 'has_password'> {
  password?: string
}

export interface N8nConfig {
  webhook_url: string | null
  enabled_events: string[]
}

export interface IntegrationStatus {
  service: 'Authentik' | 'Nextcloud' | 'Paperless-ngx' | 'Temporal'
  status: 'healthy' | 'degraded'
  last_checked: string  // ISO timestamp
}

export interface StorageSettings {
  provider: string
  url: string | null
  bucket: string | null
  access_key: string | null
  region: string
  has_secret_key: boolean
}

// ─── AI Brain ─────────────────────────────────────────────────────────────

export interface Sop {
  id: string
  tenant_id: string
  slug: string
  title: string
  description: string
  category: 'sales' | 'operations' | 'maintenance' | 'hr'
  auto: boolean
  input_label: string | null
  system_prompt: string
  created_at: string
  updated_at: string
}

export interface StorageTestResult {
  ok: boolean
  latency_ms?: number
  error?: string
}

// ─── Phase 12: AI Assistant ───────────────────────────────────────────────

export interface AiSourceRef {
  entity_type: string
  entity_id: string
  label: string
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  source_refs?: AiSourceRef[]
}

export interface AiChatResponse {
  response: string
  source_refs: AiSourceRef[]
}

export interface AiMemoryStats {
  entry_count: number
  vector_storage_bytes: number
}

// ─── Phase 12: Client Portal ──────────────────────────────────────────────

export interface PortalMe {
  client_id: string
  client_name: string
}

export interface PortalProject {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  budget: number | null
  tasks_total: number
  tasks_done: number
}

export interface PortalInvoice {
  id: string
  invoice_number: string
  status: string
  due_date: string | null
  total_amount: number
  sent_at: string | null
  pdf_download_url: string
}

export interface PortalDocument {
  id: string
  document_type: 'paperless' | 'nextcloud'
  document_id: string
  entity_type: string
  entity_id: string
  created_at: string
}

// ─── Nextcloud RAG ────────────────────────────────────────────────────────────

export interface RagChunk {
  id: string
  text: string
  file_path: string
  file_name: string
  folder_scope: string
  metadata: Record<string, unknown>
  similarity: number
}

export type RagSearchResult = RagChunk

export interface RagSourceRef {
  file_name: string
  file_path: string
  folder_scope: string
}

export interface RagChatResponse {
  response: string
  source_refs: RagSourceRef[]
}

export interface KgEntity {
  id: string
  entity_type: string
  name: string
  aliases: string[]
  properties: Record<string, unknown>
  folder_scope: string | null
  source_count: number | null
}

export interface KgRelationship {
  id: string
  rel_type: string
  weight: number
  context: string | null
  source_path: string | null
  to_id: string
  to_type: string
  to_name: string
}

export interface KgEntityDetail {
  entity: KgEntity
  relationships: KgRelationship[]
  source_docs: Array<{ file_path: string; file_name: string }>
}

export interface KgLink {
  source: string
  target: string
  rel_type: string
  weight: number
}

// ─── Document Signing (LibreSign) ─────────────────────────────────────────────

export interface DocumentSignatureSigner {
  name: string
  email: string
  description?: string
}

export interface DocumentSignature {
  id: string
  tenant_id: string
  file_path: string
  file_name: string
  entity_type: string | null
  entity_id: string | null
  signers: DocumentSignatureSigner[]
  status: 'pending' | 'partial' | 'completed' | 'expired' | 'cancelled'
  libresign_uuid: string | null
  signed_file_path: string | null
  initiated_by: string
  initiated_at: string
  completed_at: string | null
  expires_at: string | null
}
