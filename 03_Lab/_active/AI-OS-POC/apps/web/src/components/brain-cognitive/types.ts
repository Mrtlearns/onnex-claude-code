// ─────────────────────────────────────────────────────────────────────────────
// BRAIN Cognitive Architecture — shared types
//
// DEV NOTE: This is an optional feature module. To remove it:
//   1. Delete src/components/brain-cognitive/
//   2. Delete src/app/(protected)/brain-cognitive/
//   3. Delete src/app/api/bff/brain-cognitive/
//   4. Remove the nav item from src/components/layout/sidebar.tsx
// ─────────────────────────────────────────────────────────────────────────────

export interface BrainEntity {
  id: string
  entity_type: string
  name: string
  aliases?: string[]
  properties?: Record<string, unknown>
  folder_scope?: string
  source_count?: number
}

export interface BrainLink {
  source: string
  target: string
  rel_type: string
  weight?: number
}

export interface BrainGraphData {
  entities: BrainEntity[]
  links: BrainLink[]
}

export interface BrainJobRun {
  id: string
  sop_slug: string
  sop_title: string
  status: "running" | "completed" | "failed"
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
  error?: string | null
  started_at: string
  completed_at?: string | null
}

export interface EmbedStatus {
  status: "ok" | "degraded"
  model: string
  dimensions: number
}

export interface BrainMetrics {
  totalEntities: number
  totalLinks: number
  entityTypes: Record<string, number>
  recentJobs: BrainJobRun[]
  embedStatus: EmbedStatus | null
}
