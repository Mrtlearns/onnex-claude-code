/**
 * RBAC API client — typed wrappers for /api/rbac/* endpoints.
 */

const BASE = '/api/rbac';

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RbacMe {
  user_id: string;
  email: string;
  name: string;
  roles: { id: string; name: string }[];
  permissions: string[];
  is_super_admin: boolean;
  tenant: { id: string; slug: string; name: string };
}

export interface PermissionItem {
  id: string;
  code: string;
  module: string;
  label: string;
  description: string;
  category: 'view' | 'edit' | 'admin' | 'export';
  deprecated: boolean;
}

export interface RoleItem {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permission_count: number;
  user_count: number;
}

export interface RoleDetail extends Omit<RoleItem, 'permission_count' | 'user_count'> {
  permissions: string[]; // permission codes
}

export interface UserItem {
  sub: string;
  email: string;
  name: string;
  last_login: string | null;
  roles: { id: string; name: string }[];
}

export interface CreateUserResult {
  sub: string;
  email: string;
  name: string;
  temp_password: string;
}

export interface AuditEntry {
  id: number;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  action: string;
  resource: string;
  ip_address: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ── Token getter (set by AuthContext) ────────────────────────────────────────

let tokenGetter: (() => string | null) | null = null;

export function setRbacTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

function getToken(): string | null {
  return tokenGetter?.() ?? null;
}

// ── API calls ────────────────────────────────────────────────────────────────

export class RbacAuthError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'RbacAuthError';
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(getToken()) });
  if (res.status === 401) throw new RbacAuthError(401, `GET ${path} unauthorized — token may be expired`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(getToken()),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `POST ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(getToken()),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `PUT ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(getToken()),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

// ── Exported API ─────────────────────────────────────────────────────────────

export const rbacApi = {
  /** Get current user's effective permissions, roles, tenant */
  me: () => get<RbacMe>('/me'),

  /** List all non-deprecated permissions grouped by module */
  permissions: () => get<{
    permissions: PermissionItem[];
    grouped: Record<string, PermissionItem[]>;
  }>('/permissions'),

  /** List roles for current tenant */
  roles: () => get<{ roles: RoleItem[] }>('/roles'),

  /** Get role detail with permission codes */
  role: (id: string) => get<RoleDetail>(`/roles/${id}`),

  /** Create a custom role */
  createRole: (name: string, description: string) =>
    post<{ id: string; name: string }>('/roles', { name, description }),

  /** Update role description */
  updateRole: (id: string, description: string) =>
    patch<{ success: boolean }>(`/roles/${id}`, { description }),

  /** Delete a custom role */
  deleteRole: (id: string) => del<{ success: boolean }>(`/roles/${id}`),

  /** Replace permission set for a role */
  setRolePermissions: (roleId: string, permissions: string[]) =>
    put<{ success: boolean; permissions: string[] }>(`/roles/${roleId}/permissions`, { permissions }),

  /** List users with roles */
  users: () => get<{ users: UserItem[] }>('/users'),

  /** Assign roles to a user */
  setUserRoles: (sub: string, roleIds: string[]) =>
    put<{ success: boolean; roles: { id: string; name: string }[] }>(`/users/${sub}/roles`, { role_ids: roleIds }),

  /** Create a user in Authentik + portal, returns invite link */
  createUser: (params: { email: string; name: string; role_ids?: string[] }) =>
    post<CreateUserResult>('/users', params),

  /** Delete a user from portal + Authentik */
  deleteUser: (sub: string) => del<{ success: boolean }>(`/users/${sub}`),

  /** Paginated audit log */
  auditLog: (params?: { limit?: number; offset?: number; action?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.action) qs.set('action', params.action);
    const suffix = qs.toString() ? `?${qs}` : '';
    return get<{ entries: AuditEntry[]; total: number; limit: number; offset: number }>(`/audit-log${suffix}`);
  },
};
