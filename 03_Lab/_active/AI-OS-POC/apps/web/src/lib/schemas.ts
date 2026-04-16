// apps/web/src/lib/schemas.ts
// Zod validation schemas for all form inputs
import { z } from "zod"

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  project_id: z.string().uuid().optional(),
  assignee_id: z.string().optional(),
  status: z.enum(["Backlog", "In Progress", "Review", "Done"]).default("Backlog"),
  due_date: z.string().optional(),
  description: z.string().optional(),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>

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

// === Phase 10 ===
export const CreateDocumentLinkSchema = z.object({
  document_source: z.enum(['paperless', 'nextcloud']),
  document_id: z.string().min(1),
  entity_type: z.enum(['client', 'project', 'deal']),
  entity_id: z.string().uuid(),
})
export type CreateDocumentLinkInput = z.infer<typeof CreateDocumentLinkSchema>

export const UploadDocumentSchema = z.object({
  entity_type: z.enum(['client', 'project', 'deal']).optional(),
  entity_id: z.string().uuid().optional(),
})
export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>
