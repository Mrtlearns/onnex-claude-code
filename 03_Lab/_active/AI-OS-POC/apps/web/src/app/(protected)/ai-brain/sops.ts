// apps/web/src/app/(protected)/ai-brain/sops.ts
// SopCategory type — used for category badge color mapping in the UI.
// SOP definitions are now persisted in the DB (see migration 016_sops.sql).

export type SopCategory = 'sales' | 'operations' | 'maintenance' | 'hr'
