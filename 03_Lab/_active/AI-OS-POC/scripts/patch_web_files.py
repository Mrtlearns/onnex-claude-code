#!/usr/bin/env python3
# Append Phase 9 content to web files on the VM
import subprocess

types_addition = """
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
"""

schemas_addition = """
// -- Phase 9: Financial Loop --------------------------------------------------
export const CreateDealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  client_id: z.string().uuid('Select a client'),
  value: z.number().min(0, 'Value must be non-negative'),
  probability: z.number().int().min(0).max(100),
  expected_close: z.string().optional(),
  owner_id: z.string().optional(),
});
export type CreateDealInput = z.infer<typeof CreateDealSchema>;

export const CreateInvoiceSchema = z.object({
  client_id: z.string().uuid('Select a client'),
  due_date: z.string().optional(),
  tax_pct: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export const CreateTimeEntrySchema = z.object({
  project_id: z.string().uuid('Select a project'),
  task_id: z.string().uuid().optional(),
  description: z.string().min(1, 'Description is required'),
  duration_minutes: z.number().int().min(1, 'Duration must be at least 1 minute'),
  date: z.string().min(1, 'Date is required'),
  billable: z.boolean().default(true),
});
export type CreateTimeEntryInput = z.infer<typeof CreateTimeEntrySchema>;
"""

api_client_addition = """
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
"""

with open('/tmp/types_addition.txt', 'w', encoding='utf-8') as f:
    f.write(types_addition)
with open('/tmp/schemas_addition.txt', 'w', encoding='utf-8') as f:
    f.write(schemas_addition)
with open('/tmp/api_client_addition.txt', 'w', encoding='utf-8') as f:
    f.write(api_client_addition)

print("Done writing addition files")
