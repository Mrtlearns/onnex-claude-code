const RT_API = '/api/rt';
const UT_API = '/api/ut';

type QueryParams = Record<string, string>;

// Token getter — set by AuthProvider
let getAccessToken: (() => string | null) | null = null;

/**
 * Register the token getter function (called from AuthContext during initialization)
 */
export function setTokenGetter(getter: () => string | null) {
  getAccessToken = getter;
}

/**
 * Build headers with Authorization token
 */
function makeHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers = { ...additionalHeaders };
  const token = getAccessToken?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Get auth headers for use in other API clients.
 * Returns { Authorization: 'Bearer <token>' } when a token is available,
 * or {} when no token is set.
 */
export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return makeHeaders(extra);
}

function qs(params: QueryParams): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
}

export function snakeCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())] = v;
  }
  return out;
}

export function camelCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out;
}

function makeApi(base: string, { includeAuth = false } = {}) {
  const headers = () => includeAuth ? makeHeaders() : {};
  return {
    async list<T>(table: string, params: QueryParams = {}): Promise<T[]> {
      const res = await fetch(`${base}/${table}${qs(params)}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
      return ((await res.json()) as Record<string, unknown>[]).map(camelCaseKeys) as T[];
    },
    async singleton<T>(table: string): Promise<T> {
      const res = await fetch(`${base}/${table}?limit=1`, {
        headers: includeAuth ? makeHeaders({ Accept: 'application/vnd.pgrst.object+json' }) : { Accept: 'application/vnd.pgrst.object+json' },
      });
      if (!res.ok) throw new Error(`GET ${table} singleton failed: ${res.status}`);
      return camelCaseKeys(await res.json() as Record<string, unknown>) as T;
    },
    async get<T>(table: string, id: string): Promise<T> {
      const res = await fetch(`${base}/${table}?id=eq.${id}`, {
        headers: includeAuth ? makeHeaders({ Accept: 'application/vnd.pgrst.object+json' }) : { Accept: 'application/vnd.pgrst.object+json' },
      });
      if (!res.ok) throw new Error(`GET ${table}/${id} failed: ${res.status}`);
      return camelCaseKeys(await res.json() as Record<string, unknown>) as T;
    },
    async create<T>(table: string, data: Partial<T>): Promise<T> {
      const res = await fetch(`${base}/${table}`, {
        method: 'POST',
        headers: includeAuth
          ? makeHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' })
          : { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(snakeCaseKeys(data as Record<string, unknown>)),
      });
      if (!res.ok) throw new Error(`POST ${table} failed: ${res.status}`);
      return camelCaseKeys(((await res.json()) as Record<string, unknown>[])[0]) as T;
    },
    async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
      const res = await fetch(`${base}/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: includeAuth
          ? makeHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' })
          : { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(snakeCaseKeys(data as Record<string, unknown>)),
      });
      if (!res.ok) throw new Error(`PATCH ${table}/${id} failed: ${res.status}`);
      return camelCaseKeys(((await res.json()) as Record<string, unknown>[])[0]) as T;
    },
    async remove(table: string, id: string): Promise<void> {
      const res = await fetch(`${base}/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) throw new Error(`DELETE ${table}/${id} failed: ${res.status}`);
    },
  };
}

export const rtApi = makeApi(RT_API);
export const utApi = makeApi(UT_API);
