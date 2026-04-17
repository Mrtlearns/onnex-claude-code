// apps/web/src/types/api.ts
// Shared API response types — mirrors aios-api DB schema (008_core_ops.sql)

import { z } from "zod"

// ─── Task Types (from 08-01) ──────────────────────────────────────────────────

export type TaskStatus = 'Backlog' | 'In Progress' | 'Review' | 'Done'

export interface Task {
  id: string
  tenant_id: string
  project_id?: string
  assignee_id?: string
  title: string
  description?: string
  status: TaskStatus
  due_date?: string
  created_at: string
  archived_at?: string
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
  status: "Active" | "Completed" | "On Hold"
  start_date?: string
  end_date?: string
  budget?: number
  phases: Array<{ name: string; completed: boolean }>
  created_at: string
  archived_at?: string
  task_count?: number // present on GET /:id
  client_name?: string // joined from clients table
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
  status: z.enum(["Active", "Completed", "On Hold"]).default("Active"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.number().positive("Budget must be positive").optional(),
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
export type DocumentEntityType = 'client' | 'project' | 'deal'

export interface DocumentLink {
  id: string; tenant_id: string; document_source: DocumentSource;
  document_id: string; entity_type: DocumentEntityType; entity_id: string; created_at: string;
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
