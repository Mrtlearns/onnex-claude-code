#!/usr/bin/env python3
# Append Phase 9 interfaces to schema.ts on the VM
import subprocess

addition = """
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
"""

with open('/tmp/schema_addition.txt', 'w', encoding='utf-8') as f:
    f.write(addition)
print("Done writing /tmp/schema_addition.txt")
