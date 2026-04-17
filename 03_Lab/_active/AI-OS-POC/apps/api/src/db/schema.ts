// apps/api/src/db/schema.ts
// TypeScript interfaces for all database tables

// Phase 8: Core Operations
export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'on_hold' | 'complete' | 'archived';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  project_id: string | null;
  parent_task_id: string | null;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  task_type: 'manual' | 'code' | 'content' | 'research' | 'business';
  ai_output: string | null;
  ai_completed_at: string | null;
  ai_session_id: string | null;
  external_id: string | null;
  external_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate';
  created_at: string;
}

// Phase 9: Financial Loop
export interface Deal {
  id: string;
  tenant_id: string;
  client_id: string;
  title: string;
  value: number;
  probability: number;
  status: string;
  stage: string;
  expected_close: string | null;
  owner_id: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  client_id: string;
  deal_id: string | null;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'void';
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  tax_pct: number;
  notes: string | null;
  created_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  qty: number;
  rate: number;
  time_entry_id: string | null;
}

export interface TimeEntry {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id: string | null;
  user_id: string;
  description: string;
  duration_minutes: number;
  date: string;
  billable: boolean;
  started_at: string | null;
  stopped_at: string | null;
  created_at: string;
}

// Phase 10: Documents, Dashboard, Notifications
export interface DocumentLink {
  id: string;
  tenant_id: string;
  document_source: 'paperless' | 'nextcloud';
  document_id: string;
  entity_type: 'client' | 'project' | 'deal';
  entity_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  tenant_id: string;
  user_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
