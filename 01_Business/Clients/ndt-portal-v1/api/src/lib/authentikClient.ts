/**
 * Authentik REST API client — server-side only (Node.js API service).
 * Used for user provisioning: create, invite, delete.
 * Token never exposed to browser.
 */

const AUTHENTIK_BASE = process.env.AUTHENTIK_INTERNAL_URL || 'http://authentik:9000';
const API_BASE = `${AUTHENTIK_BASE}/api/v3`;

function getToken(): string {
  const token = process.env.AUTHENTIK_API_TOKEN;
  if (!token) throw new Error('AUTHENTIK_API_TOKEN is not configured');
  return token;
}

function apiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

export interface AuthentikUser {
  pk: number;
  uuid: string;
  username: string;
  name: string;
  email: string;
  is_active: boolean;
}

export interface CreateUserParams {
  email: string;
  name: string;
}

/**
 * Create a user in Authentik.
 * Username is derived from email (lowercased, special chars normalized).
 * Returns the full user object including uuid (which becomes the OIDC sub).
 */
export async function authentikCreateUser(params: CreateUserParams): Promise<AuthentikUser> {
  const username = params.email
    .toLowerCase()
    .replace('@', '.')
    .replace(/[^a-z0-9._-]/g, '');

  const res = await fetch(`${API_BASE}/core/users/`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      username,
      name: params.name,
      email: params.email,
      is_active: true,
      path: 'users',
      groups: [],
      attributes: {},
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Authentik createUser ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<AuthentikUser>;
}

/**
 * Set a temporary random password for a new Authentik user (by integer pk).
 * Returns the generated password so the admin can share it with the user.
 * The user must change it on first login via the portal settings.
 *
 * NOTE: Authentik's /recovery/ endpoint requires a "recovery" flow to be
 * configured in the tenant — which is not present in the default setup.
 * We use set_password instead, which always works.
 */
export async function authentikSetTempPassword(pk: number): Promise<string> {
  // Generate a secure random password: 3 segments of 6 chars each
  const { randomBytes } = await import('crypto');
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const rand = (n: number) =>
    Array.from(randomBytes(n)).map(b => chars[b % chars.length]).join('');
  const tempPassword = `${rand(6)}-${rand(6)}-${rand(6)}`;

  const res = await fetch(`${API_BASE}/core/users/${pk}/set_password/`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ password: tempPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Authentik setTempPassword ${res.status}: ${JSON.stringify(err)}`);
  }

  return tempPassword;
}

/**
 * Find an Authentik user by UUID (= OIDC sub claim).
 * Returns null if not found or on error.
 */
export async function authentikFindByUuid(uuid: string): Promise<AuthentikUser | null> {
  try {
    const res = await fetch(`${API_BASE}/core/users/?uuid=${encodeURIComponent(uuid)}`, {
      headers: apiHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json() as { results: AuthentikUser[]; count: number };
    return data.results[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete a user from Authentik by their integer pk.
 * 404 is treated as success (already gone).
 */
export async function authentikDeleteUser(pk: number): Promise<void> {
  const res = await fetch(`${API_BASE}/core/users/${pk}/`, {
    method: 'DELETE',
    headers: apiHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Authentik deleteUser ${res.status}`);
  }
}
