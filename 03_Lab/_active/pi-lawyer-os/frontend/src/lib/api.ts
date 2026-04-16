import { getToken, clearAuth } from './auth';

export const API_BASE = '/api';
export const AUTH_BASE = '/auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });

  if (response.status === 401) {
    clearAuth();
    let detail = 'Unauthorized — session expired';
    try {
      const body = await response.clone().json();
      if (body?.detail) detail = body.detail;
    } catch { /* ignore parse errors */ }
    throw new ApiError(401, detail);
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(
      response.status,
      `API error ${response.status}: ${response.statusText}`,
      body,
    );
  }

  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      Prefer: 'return=representation',
    },
  });
  return response.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  await apiFetch(path, { method: 'DELETE' });
}
