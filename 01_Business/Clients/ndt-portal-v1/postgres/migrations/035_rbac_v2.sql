-- ============================================================================
-- Migration 035: RBAC v2 — Dynamic Permission Registry + Role Management
-- Created: 2026-04-10
--
-- Extends the auth schema (032) with:
--   - Permission registry metadata (module, label, category, deprecated)
--   - Role metadata (description, is_system, timestamps)
--   - User profile cache (populated on login from Authentik)
--   - Per-user permission overrides (deny wins)
--   - New system roles: rt_manager, ut_manager, floor_manager
--   - Audit log JSONB details for ITAR compliance
-- ============================================================================

-- ============================================================================
-- 1. Extend auth.permissions with registry metadata
-- ============================================================================

ALTER TABLE auth.permissions
  ADD COLUMN IF NOT EXISTS module     TEXT,
  ADD COLUMN IF NOT EXISTS label      TEXT,
  ADD COLUMN IF NOT EXISTS category   TEXT,
  ADD COLUMN IF NOT EXISTS deprecated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add check constraint for category (separate statement for IF NOT EXISTS safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permissions_category_check'
  ) THEN
    ALTER TABLE auth.permissions
      ADD CONSTRAINT permissions_category_check
      CHECK (category IS NULL OR category IN ('view', 'edit', 'admin', 'export'));
  END IF;
END $$;

-- ============================================================================
-- 2. Extend auth.roles with metadata
-- ============================================================================

ALTER TABLE auth.roles
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_system   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Mark existing roles as system roles
UPDATE auth.roles SET is_system = true
WHERE name IN ('super_admin', 'admin', 'user')
  AND is_system = false;

-- ============================================================================
-- 3. Extend auth.user_roles with audit fields
-- ============================================================================

ALTER TABLE auth.user_roles
  ADD COLUMN IF NOT EXISTS assigned_by TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================================================
-- 4. Extend auth.access_log with JSONB details
-- ============================================================================

ALTER TABLE auth.access_log
  ADD COLUMN IF NOT EXISTS details JSONB;

-- ============================================================================
-- 5. New table: auth.users (profile cache from Authentik)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.users (
  sub        TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT,
  last_login TIMESTAMPTZ,
  tenant_id  UUID REFERENCES auth.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. New table: auth.user_permissions (per-user overrides)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.user_permissions (
  user_id       TEXT NOT NULL,
  permission_id UUID REFERENCES auth.permissions(id) ON DELETE CASCADE,
  granted       BOOLEAN NOT NULL DEFAULT true,
  assigned_by   TEXT,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON auth.user_permissions(user_id);

-- ============================================================================
-- 7. Seed new system roles
-- ============================================================================

INSERT INTO auth.roles (name, tenant_id, description, is_system)
SELECT r.name, t.id, r.description, true
FROM (VALUES
  ('rt_manager',    'Full access to RT inspection, costing, planning, and analysis'),
  ('ut_manager',    'Full access to UT inspection, calculator, and rule engine'),
  ('floor_manager', 'View and manage all client-facing workshop and quote operations')
) AS r(name, description)
CROSS JOIN auth.tenants t
WHERE t.slug = 'ndtesting'
ON CONFLICT (name, tenant_id) DO NOTHING;

-- ============================================================================
-- 8. Backfill existing permissions with module/label/category
-- ============================================================================

UPDATE auth.permissions SET module = 'rt',       label = 'RT Inspection',    category = 'view'   WHERE code = 'RT_INSPECTION'   AND module IS NULL;
UPDATE auth.permissions SET module = 'ut',       label = 'UT Inspection',    category = 'view'   WHERE code = 'UT_INSPECTION'   AND module IS NULL;
UPDATE auth.permissions SET module = 'admin',    label = 'Admin Panel',      category = 'admin'  WHERE code = 'ADMIN_PANEL'     AND module IS NULL;
UPDATE auth.permissions SET module = 'reports',  label = 'Report Export',    category = 'export'  WHERE code = 'REPORT_EXPORT'   AND module IS NULL;
UPDATE auth.permissions SET module = 'quotes',   label = 'Quote Management', category = 'edit'   WHERE code = 'QUOTE_MANAGE'    AND module IS NULL;
UPDATE auth.permissions SET module = 'workshop', label = 'Workshop Access',  category = 'view'   WHERE code = 'WORKSHOP_ACCESS' AND module IS NULL;

-- ============================================================================
-- 9. Insert new granular permissions (registry will keep these in sync)
-- ============================================================================

INSERT INTO auth.permissions (code, description, module, label, category) VALUES
  -- Dashboard
  ('DASHBOARD_VIEW',            'View dashboards and KPIs',                         'dashboard',    'View Dashboards',          'view'),
  -- RT (granular)
  ('RT_VIEW',                   'View RT costing and inspection data',              'rt',           'View RT',                  'view'),
  ('RT_QUOTE_CREATE',           'Create new RT quotes',                             'rt',           'Create RT Quotes',         'edit'),
  ('RT_QUOTE_EDIT',             'Edit existing RT quotes',                          'rt',           'Edit RT Quotes',           'edit'),
  ('RT_ANALYZE',                'Run RT two-stage LLM analysis',                    'rt',           'RT Analysis',              'edit'),
  ('RT_PLAN',                   'Create and manage RT inspection plans',            'rt',           'RT Planning',              'edit'),
  ('RT_SETTINGS',               'Configure RT machine profiles and settings',       'rt',           'RT Settings',              'admin'),
  -- UT (granular)
  ('UT_VIEW',                   'View UT calculator and inspection data',           'ut',           'View UT',                  'view'),
  ('UT_QUOTE_CREATE',           'Create new UT quotes',                             'ut',           'Create UT Quotes',         'edit'),
  ('UT_CALCULATE',              'Run UT rule engine calculations',                  'ut',           'UT Calculate',             'edit'),
  ('UT_RULES_VIEW',             'View UT rule sets and traces',                     'ut',           'View UT Rules',            'view'),
  ('UT_RULES_MANAGE',           'Create, edit, and version UT rule sets',           'ut',           'Manage UT Rules',          'admin'),
  ('UT_SETTINGS',               'Configure UT global settings and rates',           'ut',           'UT Settings',              'admin'),
  -- Quotes (granular)
  ('QUOTE_VIEW',                'View quote history and status',                    'quotes',       'View Quotes',              'view'),
  ('QUOTE_CREATE',              'Create new quotes',                                'quotes',       'Create Quotes',            'edit'),
  ('QUOTE_EDIT',                'Edit and update quote status',                     'quotes',       'Edit Quotes',              'edit'),
  ('QUOTE_EXPORT',              'Export quotes to PDF or CSV',                      'quotes',       'Export Quotes',            'export'),
  -- Documents
  ('DOCUMENT_VIEW',             'View documents in Nextcloud',                      'documents',    'View Documents',           'view'),
  ('DOCUMENT_UPLOAD',           'Upload documents to Nextcloud',                    'documents',    'Upload Documents',         'edit'),
  ('DOCUMENT_DELETE',           'Delete documents from Nextcloud',                  'documents',    'Delete Documents',         'admin'),
  -- SF Analysis
  ('SF_ANALYSIS_VIEW',          'View Salesforce analysis dashboards',              'sf-analysis',  'View SF Analysis',         'view'),
  ('SF_ANALYSIS_CHAT',          'Use AI chat for Salesforce analysis',              'sf-analysis',  'SF Analysis Chat',         'edit'),
  -- Workshop (granular)
  ('WORKSHOP_VIEW',             'View workshop dashboard and job queue',            'workshop',     'View Workshop',            'view'),
  ('WORKSHOP_SCHEDULE_EDIT',    'Assign and move jobs on machines',                 'workshop',     'Edit Schedules',           'edit'),
  ('WORKSHOP_SETTINGS',         'Configure machines and offline windows',           'workshop',     'Workshop Settings',        'admin'),
  ('WORKSHOP_SIMULATION',       'Access capacity simulation tool',                  'workshop',     'Run Simulations',          'view'),
  -- Settings
  ('SETTINGS_VIEW',             'View integration settings',                        'settings',     'View Settings',            'view'),
  ('SETTINGS_LLM',              'Configure LLM provider and API keys',             'settings',     'LLM Settings',             'admin'),
  ('SETTINGS_INTEGRATIONS',     'Configure Salesforce, email, n8n integrations',   'settings',     'Integration Settings',     'admin'),
  ('SETTINGS_INSPECTION_TYPES', 'Configure inspection types and steps',            'settings',     'Inspection Types',         'admin'),
  -- Admin
  ('ADMIN_VIEW',                'Access admin dashboard',                           'admin',        'View Admin',               'admin'),
  ('ADMIN_JOBS',                'View and manage background jobs',                  'admin',        'Manage Jobs',              'admin'),
  -- RBAC
  ('RBAC_VIEW',                 'View roles and user assignments',                  'rbac',         'View RBAC',                'view'),
  ('RBAC_ADMIN',                'Create/edit roles, assign users, manage permissions', 'rbac',      'Manage RBAC',              'admin'),
  -- Tools
  ('TOOLS_VIEW',                'Access tools and utilities',                       'tools',        'View Tools',               'view'),
  -- Reports
  ('REPORT_EXPORT',             'Export and download inspection reports',           'reports',      'Export Reports',           'export'),
  -- Pipeline
  ('PIPELINE_VIEW',             'View pipeline status and intake sessions',         'pipeline',     'View Pipeline',            'view'),
  ('PIPELINE_INTAKE',           'Submit and manage pipeline intake jobs',           'pipeline',     'Pipeline Intake',          'edit')
ON CONFLICT (code) DO UPDATE SET
  module     = EXCLUDED.module,
  label      = EXCLUDED.label,
  category   = EXCLUDED.category,
  deprecated = false,
  updated_at = now();

-- ============================================================================
-- 10. Seed role-permission mappings for new roles
-- ============================================================================

-- Helper: get tenant id
DO $$
DECLARE
  tid UUID;
BEGIN
  SELECT id INTO tid FROM auth.tenants WHERE slug = 'ndtesting';

  -- super_admin: ALL permissions (already done in 032, but ensure new ones too)
  INSERT INTO auth.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM auth.roles r, auth.permissions p
  WHERE r.name = 'super_admin' AND r.tenant_id = tid AND p.deprecated = false
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- admin: all except RBAC_ADMIN
  INSERT INTO auth.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM auth.roles r, auth.permissions p
  WHERE r.name = 'admin' AND r.tenant_id = tid AND p.deprecated = false AND p.code != 'RBAC_ADMIN'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- rt_manager: RT + quotes + documents + SF + workshop view + tools + reports + dashboard
  INSERT INTO auth.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM auth.roles r, auth.permissions p
  WHERE r.name = 'rt_manager' AND r.tenant_id = tid AND p.code IN (
    'DASHBOARD_VIEW',
    'RT_VIEW', 'RT_QUOTE_CREATE', 'RT_QUOTE_EDIT', 'RT_ANALYZE', 'RT_PLAN', 'RT_SETTINGS',
    'QUOTE_VIEW', 'QUOTE_CREATE', 'QUOTE_EDIT', 'QUOTE_EXPORT',
    'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD',
    'SF_ANALYSIS_VIEW', 'SF_ANALYSIS_CHAT',
    'WORKSHOP_VIEW',
    'TOOLS_VIEW', 'REPORT_EXPORT'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- ut_manager: UT + quotes + documents + SF + workshop view + tools + reports + dashboard
  INSERT INTO auth.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM auth.roles r, auth.permissions p
  WHERE r.name = 'ut_manager' AND r.tenant_id = tid AND p.code IN (
    'DASHBOARD_VIEW',
    'UT_VIEW', 'UT_QUOTE_CREATE', 'UT_CALCULATE', 'UT_RULES_VIEW', 'UT_RULES_MANAGE', 'UT_SETTINGS',
    'QUOTE_VIEW', 'QUOTE_CREATE', 'QUOTE_EDIT', 'QUOTE_EXPORT',
    'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD',
    'SF_ANALYSIS_VIEW', 'SF_ANALYSIS_CHAT',
    'WORKSHOP_VIEW',
    'TOOLS_VIEW', 'REPORT_EXPORT'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- floor_manager: client-facing operations, no settings/admin/platform
  INSERT INTO auth.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM auth.roles r, auth.permissions p
  WHERE r.name = 'floor_manager' AND r.tenant_id = tid AND p.code IN (
    'DASHBOARD_VIEW',
    'RT_VIEW', 'RT_QUOTE_CREATE',
    'UT_VIEW', 'UT_QUOTE_CREATE', 'UT_CALCULATE', 'UT_RULES_VIEW',
    'QUOTE_VIEW', 'QUOTE_CREATE', 'QUOTE_EXPORT',
    'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD',
    'SF_ANALYSIS_VIEW',
    'WORKSHOP_VIEW', 'WORKSHOP_SCHEDULE_EDIT', 'WORKSHOP_SIMULATION',
    'TOOLS_VIEW', 'REPORT_EXPORT'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- user: read-only baseline
  -- (existing mapping from 032 covers RT_INSPECTION, UT_INSPECTION, REPORT_EXPORT, WORKSHOP_ACCESS)
  -- Add new granular permissions for user role
  INSERT INTO auth.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM auth.roles r, auth.permissions p
  WHERE r.name = 'user' AND r.tenant_id = tid AND p.code IN (
    'DASHBOARD_VIEW',
    'QUOTE_VIEW', 'QUOTE_EXPORT',
    'DOCUMENT_VIEW',
    'TOOLS_VIEW', 'REPORT_EXPORT'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- ============================================================================
-- 11. PostgREST grants
-- ============================================================================

GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.user_permissions TO authenticated;
