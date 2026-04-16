-- ============================================================================
-- Migration 032: Authentication schema (tenants, roles, permissions, audit)
-- Created: 2026-04-06
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- Tenants (one per NDT company for multi-tenant support)
CREATE TABLE auth.tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,       -- 'ndtesting'
  ms365_tenant_id TEXT,                       -- Entra ID tenant GUID for Phase 2 SSO
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles (coarse-grained — identity layer)
CREATE TABLE auth.roles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,                   -- 'super_admin' | 'admin' | 'user'
  tenant_id UUID REFERENCES auth.tenants(id),
  UNIQUE(name, tenant_id)
);

-- Permissions (fine-grained business capabilities)
CREATE TABLE auth.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,          -- 'RT_INSPECTION' | 'UT_INSPECTION' | etc.
  description TEXT
);

-- Role ↔ Permission mapping
CREATE TABLE auth.role_permissions (
  role_id       UUID REFERENCES auth.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES auth.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- User ↔ Role mapping (user_id = Authentik 'sub' claim UUID)
CREATE TABLE auth.user_roles (
  user_id   TEXT NOT NULL,                   -- Authentik subject UUID
  role_id   UUID REFERENCES auth.roles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES auth.tenants(id),
  PRIMARY KEY (user_id, role_id)
);

-- Audit log (ITAR requirement: must track all access)
CREATE TABLE auth.access_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  tenant_id   UUID,
  action      TEXT NOT NULL,                 -- 'login' | 'logout' | 'access' | 'permission_denied'
  resource    TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_user_roles_user_id ON auth.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id ON auth.user_roles(tenant_id);
CREATE INDEX idx_access_log_user_id ON auth.access_log(user_id);
CREATE INDEX idx_access_log_created_at ON auth.access_log(created_at DESC);
CREATE INDEX idx_access_log_action ON auth.access_log(action);

-- ============================================================================
-- Seed: Initial tenant
-- ============================================================================

INSERT INTO auth.tenants (name, slug)
VALUES ('NDT Testing LLC', 'ndtesting')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Seed: Roles for default tenant
-- ============================================================================

INSERT INTO auth.roles (name, tenant_id)
SELECT rname.name, t.id
FROM (VALUES ('super_admin'), ('admin'), ('user')) AS rname(name)
CROSS JOIN auth.tenants t
WHERE t.slug = 'ndtesting'
ON CONFLICT (name, tenant_id) DO NOTHING;

-- ============================================================================
-- Seed: Permissions
-- ============================================================================

INSERT INTO auth.permissions (code, description) VALUES
  ('RT_INSPECTION',   'Access RT inspection workflows and findings'),
  ('UT_INSPECTION',   'Access UT inspection workflows and quoting'),
  ('ADMIN_PANEL',     'Access admin dashboard and LLM configuration'),
  ('REPORT_EXPORT',   'Export and download inspection reports'),
  ('QUOTE_MANAGE',    'Create, edit, and approve quotes'),
  ('WORKSHOP_ACCESS', 'Access workshop floor management')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Seed: Role-Permission mappings
-- ============================================================================

-- super_admin: all permissions
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r, auth.permissions p
WHERE r.name = 'super_admin' AND r.tenant_id = (SELECT id FROM auth.tenants WHERE slug = 'ndtesting')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- admin: all permissions (can be customized later)
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r, auth.permissions p
WHERE r.name = 'admin' AND r.tenant_id = (SELECT id FROM auth.tenants WHERE slug = 'ndtesting')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- user: RT + UT + export + workshop by default (admin can restrict per user)
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r, auth.permissions p
WHERE r.name = 'user'
  AND r.tenant_id = (SELECT id FROM auth.tenants WHERE slug = 'ndtesting')
  AND p.code IN ('RT_INSPECTION','UT_INSPECTION','REPORT_EXPORT','WORKSHOP_ACCESS')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- PostgREST: Grant auth schema access to authenticated role
-- ============================================================================

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.user_roles, auth.roles, auth.role_permissions, auth.permissions, auth.tenants TO authenticated;
GRANT INSERT, UPDATE ON auth.access_log TO authenticated;
