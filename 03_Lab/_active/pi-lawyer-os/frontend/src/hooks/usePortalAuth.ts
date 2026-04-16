import { useMutation } from '@tanstack/react-query';
import { AUTH_BASE } from '../lib/api';

const PORTAL_TOKEN_KEY = 'plo_portal_token';

export interface PortalLoginInput {
  firm_slug: string;
  email: string;
  password: string;
}

export interface PortalLoginResult {
  token: string;
  client_id: string;
  case_id: string | null;
}

async function portalLoginFetch(input: PortalLoginInput): Promise<PortalLoginResult> {
  const res = await fetch(`${AUTH_BASE}/portal-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Login failed');
  }
  return res.json();
}

export function usePortalLogin() {
  return useMutation<PortalLoginResult, Error, PortalLoginInput>({
    mutationFn: portalLoginFetch,
    onSuccess: (data) => {
      localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
      if (data.case_id) {
        localStorage.setItem('plo_portal_case_id', data.case_id);
      } else {
        localStorage.removeItem('plo_portal_case_id');
      }
    },
  });
}

export function getPortalToken(): string | null {
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function portalLogout(): void {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

/** Decode portal JWT payload (no verification — trust server-issued token). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export function usePortalSession(): {
  isAuthenticated: boolean;
  clientId: string | null;
  firmId: string | null;
} {
  const token = getPortalToken();
  if (!token) return { isAuthenticated: false, clientId: null, firmId: null };
  const payload = decodeJwtPayload(token);
  const exp = payload.exp as number | undefined;
  if (exp && exp * 1000 < Date.now()) {
    portalLogout();
    return { isAuthenticated: false, clientId: null, firmId: null };
  }
  return {
    isAuthenticated: true,
    clientId: (payload.client_id as string) ?? null,
    firmId: (payload.firm_id as string) ?? null,
  };
}
