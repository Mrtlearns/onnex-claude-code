/**
 * RBAC API Routes — Role & permission management
 *
 * GET  /rbac/me                    Current user's effective permissions
 * GET  /rbac/permissions           All non-deprecated permissions (grouped by module)
 * GET  /rbac/roles                 List roles for current tenant
 * GET  /rbac/roles/:id             Role detail + assigned permission codes
 * POST /rbac/roles                 Create custom role
 * PATCH /rbac/roles/:id            Update role name/description
 * DELETE /rbac/roles/:id           Delete custom role
 * PUT  /rbac/roles/:id/permissions Replace permission set for role
 * GET  /rbac/users                 List users with roles
 * PUT  /rbac/users/:sub/roles      Assign roles to user
 * GET  /rbac/audit-log             Paginated audit log
 */

import { Router, Request, Response } from 'express';
import { pool, query, queryOne } from '../db';
import { requirePermission } from '../middleware/requirePermission';
import { bustPermissionCache } from '../middleware/loadPermissions';
import { AuthUser } from '../middleware/jwt';
import {
  authentikCreateUser,
  authentikSetTempPassword,
  authentikFindByUuid,
  authentikDeleteUser,
  AuthentikUser,
} from '../lib/authentikClient';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getUser(req: Request): AuthUser {
  if (!req.user) throw new Error('Unauthenticated');
  return req.user;
}

async function auditLog(
  userId: string,
  tenantId: string | null,
  action: string,
  resource: string,
  ip: string,
  details?: Record<string, unknown>
) {
  await pool.query(
    `INSERT INTO auth.access_log (user_id, tenant_id, action, resource, ip_address, details)
     VALUES ($1, (SELECT id FROM auth.tenants WHERE slug = $2 LIMIT 1), $3, $4, $5::inet, $6)`,
    [userId, tenantId || 'ndtesting', action, resource, ip || '0.0.0.0', details ? JSON.stringify(details) : null]
  );
}

// ── GET /rbac/me ─────────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  const user = getUser(req);

  // Upsert user profile cache (for the Users management tab).
  // email/name may be absent from access tokens — use COALESCE so existing
  // values are preserved if the new token doesn't carry them.
  await pool.query(
    `INSERT INTO auth.users (sub, email, name, last_login, tenant_id)
     VALUES ($1, $2, $3, now(), (SELECT id FROM auth.tenants WHERE slug = $4 LIMIT 1))
     ON CONFLICT (sub) DO UPDATE SET
       email = COALESCE(EXCLUDED.email, auth.users.email),
       name  = COALESCE(EXCLUDED.name,  auth.users.name),
       last_login = now()`,
    [user.sub, user.email || null, user.name || null, user.tenant_id || 'ndtesting']
  );

  // Get roles with IDs
  const roles = await query<{ id: string; name: string }>(
    `SELECT r.id::text, r.name FROM auth.user_roles ur
     JOIN auth.roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [user.sub]
  );

  // Get tenant info
  const tenant = await queryOne<{ id: string; slug: string; name: string }>(
    `SELECT id::text, slug, name FROM auth.tenants WHERE slug = $1`,
    [user.tenant_id || 'ndtesting']
  );

  res.json({
    user_id: user.sub,
    email: user.email,
    name: user.name,
    roles,
    permissions: user.permissions,
    is_super_admin: user.is_super_admin,
    tenant: tenant || { id: '', slug: 'ndtesting', name: 'NDT Testing LLC' },
  });
});

// ── GET /rbac/permissions ────────────────────────────────────────────────────

router.get('/permissions', async (_req: Request, res: Response) => {
  const perms = await query<{
    id: string; code: string; module: string; label: string;
    description: string; category: string; deprecated: boolean;
  }>(
    `SELECT id::text, code, module, label, description, category, deprecated
     FROM auth.permissions
     WHERE deprecated = false
     ORDER BY module, category, code`
  );

  // Group by module
  const grouped: Record<string, typeof perms> = {};
  for (const p of perms) {
    const mod = p.module || 'other';
    if (!grouped[mod]) grouped[mod] = [];
    grouped[mod].push(p);
  }

  res.json({ permissions: perms, grouped });
});

// ── GET /rbac/roles ──────────────────────────────────────────────────────────

router.get('/roles', requirePermission('RBAC_VIEW', 'RBAC_ADMIN'), async (req: Request, res: Response) => {
  const user = getUser(req);

  const roles = await query<{
    id: string; name: string; description: string;
    is_system: boolean; permission_count: number;
    user_count: number;
  }>(
    `SELECT r.id::text, r.name, r.description, r.is_system,
       (SELECT COUNT(*) FROM auth.role_permissions rp WHERE rp.role_id = r.id)::int AS permission_count,
       (SELECT COUNT(*) FROM auth.user_roles ur WHERE ur.role_id = r.id)::int AS user_count
     FROM auth.roles r
     JOIN auth.tenants t ON t.id = r.tenant_id
     WHERE t.slug = $1
     ORDER BY r.is_system DESC, r.name`,
    [user.tenant_id || 'ndtesting']
  );

  res.json({ roles });
});

// ── GET /rbac/roles/:id ──────────────────────────────────────────────────────

router.get('/roles/:id', requirePermission('RBAC_VIEW', 'RBAC_ADMIN'), async (req: Request, res: Response) => {
  const role = await queryOne<{
    id: string; name: string; description: string; is_system: boolean;
  }>(
    `SELECT id::text, name, description, is_system FROM auth.roles WHERE id = $1`,
    [req.params.id]
  );

  if (!role) return res.status(404).json({ error: 'Role not found' });

  const permissions = await query<{ code: string }>(
    `SELECT p.code FROM auth.role_permissions rp
     JOIN auth.permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1
     ORDER BY p.module, p.code`,
    [req.params.id]
  );

  res.json({ ...role, permissions: permissions.map((p) => p.code) });
});

// ── POST /rbac/roles ─────────────────────────────────────────────────────────

router.post('/roles', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const user = getUser(req);
  const { name, description } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  const slug = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const existing = await queryOne(
    `SELECT id FROM auth.roles WHERE name = $1 AND tenant_id = (SELECT id FROM auth.tenants WHERE slug = $2)`,
    [slug, user.tenant_id || 'ndtesting']
  );
  if (existing) return res.status(409).json({ error: 'Role already exists' });

  const role = await queryOne<{ id: string; name: string }>(
    `INSERT INTO auth.roles (name, description, tenant_id, is_system)
     VALUES ($1, $2, (SELECT id FROM auth.tenants WHERE slug = $3), false)
     RETURNING id::text, name`,
    [slug, description || '', user.tenant_id || 'ndtesting']
  );

  await auditLog(user.sub, user.tenant_id, 'role_created', `role:${slug}`, req.ip || '', { role_name: slug });

  res.status(201).json(role);
});

// ── PATCH /rbac/roles/:id ────────────────────────────────────────────────────

router.patch('/roles/:id', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const user = getUser(req);
  const { description } = req.body;

  const role = await queryOne<{ id: string; name: string; is_system: boolean }>(
    `SELECT id::text, name, is_system FROM auth.roles WHERE id = $1`,
    [req.params.id]
  );
  if (!role) return res.status(404).json({ error: 'Role not found' });

  // Only update description (name changes blocked for system roles)
  await pool.query(
    `UPDATE auth.roles SET description = $1, updated_at = now() WHERE id = $2`,
    [description ?? role.name, req.params.id]
  );

  await auditLog(user.sub, user.tenant_id, 'role_updated', `role:${role.name}`, req.ip || '', { description });

  res.json({ success: true });
});

// ── DELETE /rbac/roles/:id ───────────────────────────────────────────────────

router.delete('/roles/:id', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const user = getUser(req);

  const role = await queryOne<{ id: string; name: string; is_system: boolean }>(
    `SELECT id::text, name, is_system FROM auth.roles WHERE id = $1`,
    [req.params.id]
  );
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.is_system) return res.status(403).json({ error: 'Cannot delete system roles' });

  await pool.query(`DELETE FROM auth.roles WHERE id = $1`, [req.params.id]);
  bustPermissionCache();

  await auditLog(user.sub, user.tenant_id, 'role_deleted', `role:${role.name}`, req.ip || '', { role_name: role.name });

  res.json({ success: true });
});

// ── PUT /rbac/roles/:id/permissions ──────────────────────────────────────────

router.put('/roles/:id/permissions', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const user = getUser(req);
  const { permissions: permCodes } = req.body;

  if (!Array.isArray(permCodes)) {
    return res.status(400).json({ error: 'permissions must be an array of permission codes' });
  }

  const role = await queryOne<{ id: string; name: string }>(
    `SELECT id::text, name FROM auth.roles WHERE id = $1`,
    [req.params.id]
  );
  if (!role) return res.status(404).json({ error: 'Role not found' });

  // super_admin always has all — block edits
  if (role.name === 'super_admin') {
    return res.status(403).json({ error: 'super_admin always has all permissions' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get previous permissions for audit
    const prev = await client.query(
      `SELECT p.code FROM auth.role_permissions rp JOIN auth.permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1`,
      [req.params.id]
    );
    const prevCodes = prev.rows.map((r: { code: string }) => r.code);

    // Clear existing
    await client.query(`DELETE FROM auth.role_permissions WHERE role_id = $1`, [req.params.id]);

    // Insert new
    if (permCodes.length > 0) {
      await client.query(
        `INSERT INTO auth.role_permissions (role_id, permission_id)
         SELECT $1, p.id FROM auth.permissions p WHERE p.code = ANY($2)`,
        [req.params.id, permCodes]
      );
    }

    await client.query('COMMIT');
    bustPermissionCache();

    await auditLog(user.sub, user.tenant_id, 'role_permissions_updated', `role:${role.name}`, req.ip || '', {
      previous: prevCodes,
      current: permCodes,
    });

    res.json({ success: true, permissions: permCodes });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ── GET /rbac/users ──────────────────────────────────────────────────────────

router.get('/users', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const user = getUser(req);

  const users = await query<{
    sub: string; email: string; name: string;
    last_login: string; roles: string;
  }>(
    `SELECT u.sub, u.email, u.name, u.last_login,
       COALESCE(
         (SELECT json_agg(json_build_object('id', r.id, 'name', r.name))
          FROM auth.user_roles ur
          JOIN auth.roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.sub
         ), '[]'
       )::text AS roles
     FROM auth.users u
     WHERE u.tenant_id = (SELECT id FROM auth.tenants WHERE slug = $1)
        OR u.tenant_id IS NULL
     ORDER BY u.name, u.email`,
    [user.tenant_id || 'ndtesting']
  );

  // Parse roles JSON string back to objects
  const parsed = users.map((u) => ({
    ...u,
    roles: JSON.parse(u.roles),
  }));

  res.json({ users: parsed });
});

// ── PUT /rbac/users/:sub/roles ───────────────────────────────────────────────

router.put('/users/:sub/roles', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const user = getUser(req);
  const targetSub = req.params.sub;
  const { role_ids } = req.body;

  if (!Array.isArray(role_ids)) {
    return res.status(400).json({ error: 'role_ids must be an array of role UUIDs' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get previous roles for audit
    const prev = await client.query(
      `SELECT r.name FROM auth.user_roles ur JOIN auth.roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [targetSub]
    );
    const prevRoles = prev.rows.map((r: { name: string }) => r.name);

    // Clear existing
    await client.query(`DELETE FROM auth.user_roles WHERE user_id = $1`, [targetSub]);

    // Insert new
    if (role_ids.length > 0) {
      for (const roleId of role_ids) {
        await client.query(
          `INSERT INTO auth.user_roles (user_id, role_id, tenant_id, assigned_by, assigned_at)
           VALUES ($1, $2, (SELECT tenant_id FROM auth.roles WHERE id = $2), $3, now())
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [targetSub, roleId, user.sub]
        );
      }
    }

    await client.query('COMMIT');
    bustPermissionCache();

    // Get new roles for response
    const newRoles = await query<{ id: string; name: string }>(
      `SELECT r.id::text, r.name FROM auth.user_roles ur
       JOIN auth.roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [targetSub]
    );

    await auditLog(user.sub, user.tenant_id, 'user_roles_updated', `user:${targetSub}`, req.ip || '', {
      target_user: targetSub,
      previous: prevRoles,
      current: newRoles.map((r) => r.name),
    });

    res.json({ success: true, roles: newRoles });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ── POST /rbac/users ─────────────────────────────────────────────────────────

router.post('/users', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const admin = getUser(req);
  const { email, name, role_ids } = req.body as {
    email: string;
    name: string;
    role_ids?: string[];
  };

  if (!email?.trim() || !name?.trim()) {
    return res.status(400).json({ error: 'email and name are required' });
  }

  // 1. Create user in Authentik
  let akUser: AuthentikUser;
  try {
    akUser = await authentikCreateUser({ email: email.trim(), name: name.trim() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: `Failed to create Authentik user: ${msg}` });
  }

  // 2. Set temporary password (best-effort — non-fatal)
  let tempPassword = '';
  try {
    tempPassword = await authentikSetTempPassword(akUser.pk);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[rbac] Could not set temp password:', msg);
  }

  const userSub = akUser.uuid;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3. Upsert portal user record
    await client.query(
      `INSERT INTO auth.users (sub, email, name, tenant_id)
       VALUES ($1, $2, $3, (SELECT id FROM auth.tenants WHERE slug = $4 LIMIT 1))
       ON CONFLICT (sub) DO UPDATE SET
         email = EXCLUDED.email,
         name  = EXCLUDED.name`,
      [userSub, email.trim(), name.trim(), admin.tenant_id || 'ndtesting']
    );

    // 4. Assign initial roles
    if (role_ids && role_ids.length > 0) {
      for (const roleId of role_ids) {
        await client.query(
          `INSERT INTO auth.user_roles (user_id, role_id, tenant_id, assigned_by, assigned_at)
           VALUES ($1, $2, (SELECT tenant_id FROM auth.roles WHERE id = $2), $3, now())
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [userSub, roleId, admin.sub]
        );
      }
    }

    await client.query('COMMIT');
    bustPermissionCache();

    await auditLog(admin.sub, admin.tenant_id, 'user_created', `user:${userSub}`, req.ip || '', {
      email: email.trim(),
      name: name.trim(),
      authentik_pk: akUser.pk,
      role_ids: role_ids ?? [],
    });

    res.status(201).json({
      sub: userSub,
      email: email.trim(),
      name: name.trim(),
      temp_password: tempPassword,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ── DELETE /rbac/users/:sub ───────────────────────────────────────────────────

router.delete('/users/:sub', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const admin = getUser(req);
  const targetSub = req.params.sub;

  if (targetSub === admin.sub) {
    return res.status(403).json({ error: 'Cannot delete your own account' });
  }

  const targetUser = await queryOne<{ sub: string; email: string; name: string }>(
    `SELECT sub, email, name FROM auth.users WHERE sub = $1`,
    [targetSub]
  );
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  // Find Authentik pk via UUID (best-effort)
  const akUser = await authentikFindByUuid(targetSub);
  const authentikPk = akUser?.pk ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM auth.user_roles WHERE user_id = $1`, [targetSub]);
    await client.query(`DELETE FROM auth.users WHERE sub = $1`, [targetSub]);
    await client.query('COMMIT');
    bustPermissionCache();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Delete from Authentik (best-effort — log but don't fail)
  if (authentikPk) {
    try {
      await authentikDeleteUser(authentikPk);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[rbac] Failed to delete Authentik user:', msg);
    }
  }

  await auditLog(admin.sub, admin.tenant_id, 'user_deleted', `user:${targetSub}`, req.ip || '', {
    email: targetUser.email,
    name: targetUser.name,
    authentik_pk: authentikPk,
  });

  res.json({ success: true });
});

// ── GET /rbac/audit-log ──────────────────────────────────────────────────────

router.get('/audit-log', requirePermission('RBAC_ADMIN'), async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const action = req.query.action as string | undefined;

  let sql = `
    SELECT al.id, al.user_id, u.name AS user_name, u.email AS user_email,
           al.action, al.resource, al.ip_address, al.details, al.created_at
    FROM auth.access_log al
    LEFT JOIN auth.users u ON u.sub = al.user_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (action) {
    params.push(action);
    sql += ` AND al.action = $${params.length}`;
  }

  sql += ` ORDER BY al.created_at DESC`;
  params.push(limit);
  sql += ` LIMIT $${params.length}`;
  params.push(offset);
  sql += ` OFFSET $${params.length}`;

  const entries = await query(sql, params);

  // Get total count for pagination
  let countSql = `SELECT COUNT(*)::int AS total FROM auth.access_log WHERE 1=1`;
  const countParams: unknown[] = [];
  if (action) {
    countParams.push(action);
    countSql += ` AND action = $${countParams.length}`;
  }
  const countResult = await queryOne<{ total: number }>(countSql, countParams);

  res.json({
    entries,
    total: countResult?.total ?? 0,
    limit,
    offset,
  });
});

export default router;
