// apps/api/src/db/schema.ts
export interface Client {
  id: string; tenant_id: string; name: string
  type: 'Agency' | 'Direct'
  status: 'Active' | 'Prospect' | 'Churned'
  billing_address: string | null; created_at: Date; archived_at: Date | null
}
export interface Contact {
  id: string; tenant_id: string; client_id: string; name: string
  email: string | null; phone: string | null; role: string | null
}
export interface Project {
  id: string; tenant_id: string; client_id: string | null; name: string
  status: 'Active' | 'Completed' | 'On Hold'
  start_date: string | null; end_date: string | null; budget: string | null
  phases: unknown[]; created_at: Date; archived_at: Date | null
}
export interface Task {
  id: string; tenant_id: string; project_id: string | null; assignee_id: string | null
  title: string; description: string | null
  status: 'Backlog' | 'In Progress' | 'Review' | 'Done'
  due_date: string | null; created_at: Date
}
export interface Subtask {
  id: string; task_id: string; title: string; completed: boolean
}
export interface TaskComment {
  id: string; task_id: string; author_id: string; body: string; created_at: Date
}

// Phase 9: Financial Loop
export interface Deal {
  id: string; tenant_id: string; client_id: string; title: string;
  value: number; probability: number;
  status: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  stage: string; expected_close: string | null; owner_id: string | null;
  created_at: string;
}
export interface Invoice {
  id: string; tenant_id: string; client_id: string; deal_id: string | null;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'void';
  due_date: string | null; sent_at: string | null; paid_at: string | null;
  tax_pct: number; notes: string | null; created_at: string;
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
