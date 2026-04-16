import { pgTable, pgSchema, text, timestamp, integer, boolean, jsonb, real } from 'drizzle-orm/pg-core'

export const pocSchema = pgSchema('poc_personal_to_do')

export const nodes = pocSchema.table('nodes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  type: text('type').notNull().default('note'), // note | task | idea | reference | person | project
  status: text('status').notNull().default('fresh'), // fresh | aging | urgent | catchall
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  z: real('z').notNull().default(0),
  color: text('color'),
  tags: jsonb('tags').$type<string[]>().default([]),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  is_public: boolean('is_public').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
  last_accessed_at: timestamp('last_accessed_at').notNull().defaultNow(),
  due_date: timestamp('due_date'),
})

export const edges = pocSchema.table('edges', {
  id: text('id').primaryKey(),
  source_id: text('source_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  target_id: text('target_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  label: text('label'),
  type: text('type').notNull().default('relates_to'),
  strength: real('strength').notNull().default(1.0),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const node_attachments = pocSchema.table('node_attachments', {
  id: text('id').primaryKey(),
  node_id: text('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  artifact_type: text('artifact_type').notNull().default('file'), // text | image | file
  content: text('content'),       // for artifact_type='text'
  filename: text('filename'),     // nullable for text artifacts
  storage_path: text('storage_path'), // nullable for text artifacts
  mime_type: text('mime_type'),
  size_bytes: integer('size_bytes'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  deleted_at: timestamp('deleted_at'),  // null = active; set = soft-deleted, purged after 7 days
})

export const action_logs = pocSchema.table('action_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  entity_type: text('entity_type'),
  entity_id: text('entity_id'),
  payload: jsonb('payload'),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export type Node = typeof nodes.$inferSelect
export type NewNode = typeof nodes.$inferInsert
export type Edge = typeof edges.$inferSelect
export type NewEdge = typeof edges.$inferInsert
export type NodeAttachment = typeof node_attachments.$inferSelect
export type NewNodeAttachment = typeof node_attachments.$inferInsert
export type ActionLog = typeof action_logs.$inferSelect
export type NewActionLog = typeof action_logs.$inferInsert
