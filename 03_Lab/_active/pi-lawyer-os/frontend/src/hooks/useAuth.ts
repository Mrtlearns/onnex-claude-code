import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, AUTH_BASE } from '../lib/api';
import { setToken, setUser, clearAuth } from '../lib/auth';
import type { User } from '../types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const authKeys = {
  me: ['auth', 'me'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LoginCredentials {
  email: string;
  password: string;
}

export interface FirmBranding {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color: string;
  sms_signature: string;
}

interface LoginResponse {
  token: string;
  user: User;
  firm: FirmBranding;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the currently authenticated user from GET /auth/me.
 * Disabled when no token is present so unauthenticated pages don't trigger
 * a 401 on load.
 */
export function useCurrentUser() {
  return useQuery<User>({
    queryKey: authKeys.me,
    queryFn: () => apiGet<User>(`${AUTH_BASE}/me`),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Login mutation. On success persists the token and user to localStorage and
 * invalidates the current-user query so any listener re-fetches.
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, Error, LoginCredentials>({
    mutationFn: (credentials) =>
      apiPost<LoginResponse>(`${AUTH_BASE}/login`, credentials),
    onSuccess: (data) => {
      setToken(data.token);
      setUser(data.user);
      // Persist firm branding for use across components
      localStorage.setItem('firm', JSON.stringify(data.firm));
      queryClient.setQueryData(authKeys.me, data.user);
    },
  });
}

/**
 * Returns the firm branding stored at login time.
 */
export function useFirmBranding(): FirmBranding | null {
  const raw = localStorage.getItem('firm');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirmBranding;
  } catch {
    return null;
  }
}

/**
 * Clears auth state from localStorage, wipes the query cache for the current
 * user, and navigates to /login.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return () => {
    clearAuth();
    queryClient.removeQueries({ queryKey: authKeys.me });
    navigate('/login');
  };
}
