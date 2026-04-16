/**
 * Permission Registry — syncs module permission manifests to the database.
 *
 * Called once at API startup. Each route module declares a *.permissions.ts
 * manifest. This loader collects them all, upserts into auth.permissions,
 * and marks any DB-only permissions (removed from code) as deprecated.
 *
 * Adding a new module: create a *.permissions.ts file, restart the API.
 * The permission appears in the role editor automatically.
 */

import { pool } from '../../db';
import { PermissionDef } from './types';

// ── Import all permission manifests ──────────────────────────────────────────
// Explicit imports (no require.context in plain Node/TS).
// When adding a new route module, add its manifest import here.

import { permissions as adminPerms } from '../../routes/admin.permissions';
import { permissions as workshopPerms } from '../../routes/workshop.permissions';
import { permissions as rtQuotePerms } from '../../routes/rt-quote.permissions';
import { permissions as rtPlanPerms } from '../../routes/rt-plan.permissions';
import { permissions as rtAnalyzePerms } from '../../routes/rt-analyze.permissions';
import { permissions as quotePerms } from '../../routes/quote.permissions';
import { permissions as quotesPerms } from '../../routes/quotes.permissions';
import { permissions as settingsPerms } from '../../routes/settings.permissions';
import { permissions as documentsPerms } from '../../routes/documents.permissions';
import { permissions as sfAnalysisPerms } from '../../routes/sf-analysis.permissions';
import { permissions as utRulesPerms } from '../../routes/ut-rules.permissions';
import { permissions as utCalculatePerms } from '../../routes/ut-calculate.permissions';
import { permissions as inspectionTypesPerms } from '../../routes/inspection-types.permissions';
import { permissions as rbacPerms } from '../../routes/rbac.permissions';
import { permissions as integrationsPerms } from '../../routes/integrations.permissions';
import { permissions as bomPerms } from '../../routes/bom.permissions';
import { permissions as inboxPerms } from '../../routes/inbox.permissions';
import { permissions as diagramAnalysesPerms } from '../../routes/diagram-analyses.permissions';

// ── Cross-cutting permissions (not tied to a single route module) ────────────
const crossCuttingPerms: PermissionDef[] = [
  { code: 'DASHBOARD_VIEW', module: 'dashboard', label: 'View Dashboards',  description: 'View dashboards and KPIs',                category: 'view' },
  { code: 'TOOLS_VIEW',     module: 'tools',     label: 'View Tools',       description: 'Access tools and utilities',               category: 'view' },
  { code: 'REPORT_EXPORT',  module: 'reports',   label: 'Export Reports',   description: 'Export and download inspection reports',    category: 'export' },
];

/**
 * Collect all manifests, deduplicate by code (first occurrence wins).
 */
function collectAll(): PermissionDef[] {
  const all = [
    ...crossCuttingPerms,
    ...adminPerms,
    ...workshopPerms,
    ...rtQuotePerms,
    ...rtPlanPerms,
    ...rtAnalyzePerms,
    ...quotePerms,
    ...quotesPerms,
    ...settingsPerms,
    ...documentsPerms,
    ...sfAnalysisPerms,
    ...utRulesPerms,
    ...utCalculatePerms,
    ...inspectionTypesPerms,
    ...rbacPerms,
    ...integrationsPerms,
    ...bomPerms,
    ...inboxPerms,
    ...diagramAnalysesPerms,
  ];

  // Deduplicate — same code may appear in multiple manifests (e.g. UT_CALCULATE
  // in both ut-calculate.permissions.ts and quote.permissions.ts).
  const seen = new Set<string>();
  return all.filter((p) => {
    if (seen.has(p.code)) return false;
    seen.add(p.code);
    return true;
  });
}

/**
 * Sync permission manifests to auth.permissions.
 *
 * - Upserts every manifest entry (INSERT ON CONFLICT UPDATE).
 * - Marks DB entries NOT in code as deprecated.
 * - Returns { registered, deprecated, modules } for startup logging.
 */
export async function syncPermissions(): Promise<{
  registered: number;
  deprecated: number;
  modules: number;
}> {
  const perms = collectAll();
  const codes = perms.map((p) => p.code);
  const modules = new Set(perms.map((p) => p.module));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert each permission
    for (const p of perms) {
      await client.query(
        `INSERT INTO auth.permissions (code, description, module, label, category, deprecated, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, now())
         ON CONFLICT (code) DO UPDATE SET
           description = EXCLUDED.description,
           module      = EXCLUDED.module,
           label       = EXCLUDED.label,
           category    = EXCLUDED.category,
           deprecated  = false,
           updated_at  = now()`,
        [p.code, p.description, p.module, p.label, p.category]
      );
    }

    // Mark permissions not in code as deprecated
    const { rowCount } = await client.query(
      `UPDATE auth.permissions SET deprecated = true, updated_at = now()
       WHERE code != ALL($1) AND deprecated = false`,
      [codes]
    );

    await client.query('COMMIT');

    return {
      registered: perms.length,
      deprecated: rowCount ?? 0,
      modules: modules.size,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
