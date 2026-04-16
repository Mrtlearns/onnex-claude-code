/**
 * Permission definition — declared by each route module's *.permissions.ts manifest.
 * The registry loader upserts these into auth.permissions at API startup.
 */
export interface PermissionDef {
  /** Unique code, e.g. 'WORKSHOP_VIEW'. Used in requirePermission() checks. */
  code: string;
  /** Module this permission belongs to, e.g. 'workshop', 'rt', 'ut'. */
  module: string;
  /** Human-readable label for the role editor UI. */
  label: string;
  /** Longer description for tooltips in the permission matrix. */
  description: string;
  /** Category for grouping in the UI. */
  category: 'view' | 'edit' | 'admin' | 'export';
}
