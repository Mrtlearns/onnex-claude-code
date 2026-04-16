/**
 * loadPermissions middleware — resolves effective permissions from the database.
 *
 * Runs after jwtMiddleware. Replaces the empty JWT permissions with the real
 * permission set computed from auth.role_permissions + auth.user_permissions.
 *
 * Uses an in-memory LRU cache (60s TTL) to avoid per-request DB queries.
 * Cache is busted globally when RBAC mutations occur (role/permission changes).
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { AuthUser } from './jwt';

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  permissions: string[];
  roles: string[];
  is_super_admin: boolean;
  tenant_id: string;
  expires: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 500;
const cache = new Map<string, CacheEntry>();

/** Global version counter — increment to bust all caches. */
let cacheVersion = 0;
let cacheVersionAtFill = 0;

/**
 * Call this after any RBAC mutation (role change, user assignment, etc.)
 * to force all cached permissions to refresh on next request.
 */
export function bustPermissionCache(): void {
  cacheVersion++;
  cache.clear();
}

// ── Permission resolution query ──────────────────────────────────────────────

const EFFECTIVE_PERMISSIONS_SQL = `
  SELECT DISTINCT p.code
  FROM auth.user_roles ur
  JOIN auth.role_permissions rp ON rp.role_id = ur.role_id
  JOIN auth.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = $1 AND p.deprecated = false
  EXCEPT
  SELECT p.code
  FROM auth.user_permissions up
  JOIN auth.permissions p ON p.id = up.permission_id
  WHERE up.user_id = $1 AND up.granted = false
`;

const USER_ROLES_SQL = `
  SELECT r.name
  FROM auth.user_roles ur
  JOIN auth.roles r ON r.id = ur.role_id
  WHERE ur.user_id = $1
`;

const ALL_ACTIVE_PERMISSIONS_SQL = `
  SELECT code FROM auth.permissions WHERE deprecated = false
`;

const USER_TENANT_SQL = `
  SELECT t.slug
  FROM auth.user_roles ur
  JOIN auth.roles r ON r.id = ur.role_id
  JOIN auth.tenants t ON t.id = r.tenant_id
  WHERE ur.user_id = $1
  LIMIT 1
`;

async function resolvePermissions(userSub: string): Promise<CacheEntry> {
  // Get roles
  const rolesResult = await pool.query(USER_ROLES_SQL, [userSub]);
  const roles = rolesResult.rows.map((r: { name: string }) => r.name);
  const is_super_admin = roles.includes('super_admin');

  // Get tenant
  const tenantResult = await pool.query(USER_TENANT_SQL, [userSub]);
  const tenant_id = tenantResult.rows[0]?.slug || 'ndtesting';

  let permissions: string[];
  if (is_super_admin) {
    // Super admin gets ALL non-deprecated permissions
    const allResult = await pool.query(ALL_ACTIVE_PERMISSIONS_SQL);
    permissions = allResult.rows.map((r: { code: string }) => r.code);
  } else {
    const permResult = await pool.query(EFFECTIVE_PERMISSIONS_SQL, [userSub]);
    permissions = permResult.rows.map((r: { code: string }) => r.code);
  }

  return {
    permissions,
    roles,
    is_super_admin,
    tenant_id,
    expires: Date.now() + CACHE_TTL_MS,
  };
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Public paths that skip permission loading (same as jwt.ts).
 */
const PUBLIC_PATHS = [
  '/health',
  '/integrations/n8n/quote',
  '/integrations/email/quote',
  '/inbox/process',
  '/api/inbox/process',
];

export function loadPermissions(req: Request, res: Response, next: NextFunction) {
  // Skip for public paths or unauthenticated requests
  if (PUBLIC_PATHS.some((p) => req.path.startsWith(p)) || !req.user) {
    return next();
  }

  // Skip for internal service users (gateway → API) — they have synthetic permissions
  if (req.user.sub?.startsWith('service:')) {
    return next();
  }

  const userSub = req.user.sub;

  // Check cache
  const cached = cache.get(userSub);
  if (cached && cached.expires > Date.now() && cacheVersionAtFill === cacheVersion) {
    req.user.permissions = cached.permissions;
    req.user.roles = cached.roles;
    req.user.is_super_admin = cached.is_super_admin;
    req.user.tenant_id = cached.tenant_id;
    req.user.role = cached.roles[0] || 'user';
    return next();
  }

  // Resolve from DB
  resolvePermissions(userSub)
    .then((entry) => {
      // Evict oldest if cache is full
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }

      cache.set(userSub, entry);
      cacheVersionAtFill = cacheVersion;

      req.user!.permissions = entry.permissions;
      req.user!.roles = entry.roles;
      req.user!.is_super_admin = entry.is_super_admin;
      req.user!.tenant_id = entry.tenant_id;
      req.user!.role = entry.roles[0] || 'user';
      next();
    })
    .catch((err) => {
      console.error('[loadPermissions] Failed to resolve permissions:', err);
      // Fall through with empty permissions — requirePermission will block
      req.user!.permissions = [];
      req.user!.roles = [];
      req.user!.is_super_admin = false;
      next();
    });
}
