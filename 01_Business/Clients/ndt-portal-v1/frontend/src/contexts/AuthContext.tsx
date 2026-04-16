import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { UserManager, User as OidcUser, UserManagerSettings } from 'oidc-client-ts';
import { setTokenGetter } from '../lib/api';
import { rbacApi, setRbacTokenGetter, RbacMe, RbacAuthError } from '../lib/rbac-api';

/**
 * PKCE crypto provider that works over plain HTTP.
 * Crypto.subtle requires a secure context (HTTPS), but PKCE code verifier
 * generation only needs getRandomValues (works on HTTP) + SHA-256.
 * Uses a minimal pure-JS SHA-256 so the portal works on HTTP dev environments.
 */
function base64urlEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Minimal pure-JS SHA-256 (FIPS 180-4). No dependencies.
function sha256(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const len = data.length;
  const padLen = (len % 64 < 56 ? 56 : 120) - (len % 64);
  const padded = new Uint8Array(len + padLen + 8);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, (len * 8) >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000), false);
  for (let i = 0; i < padded.length; i += 64) {
    const w = new Array(64);
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = r(w[j-15],7)^r(w[j-15],18)^(w[j-15]>>>3);
      const s1 = r(w[j-2],17)^r(w[j-2],19)^(w[j-2]>>>10);
      w[j] = (w[j-16]+s0+w[j-7]+s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let j = 0; j < 64; j++) {
      const S1 = r(e,6)^r(e,11)^r(e,25);
      const ch = (e&f)^(~e&g);
      const t1 = (hh+S1+ch+K[j]+w[j]) >>> 0;
      const S0 = r(a,2)^r(a,13)^r(a,22);
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0+maj) >>> 0;
      [hh,g,f,e,d,c,b,a] = [g,f,e,(d+t1)>>>0,c,b,a,(t1+t2)>>>0];
    }
    h = h.map((v, i) => (v + [a,b,c,d,e,f,g,hh][i]) >>> 0);
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  h.forEach((v, i) => ov.setUint32(i * 4, v, false));
  return out;
}

/**
 * Polyfill window.crypto.subtle for HTTP environments.
 * oidc-client-ts v3.x calls crypto.subtle.digest('SHA-256',...) for PKCE — it
 * doesn't expose a cryptoProvider hook. We install an own-property on
 * window.crypto that shadows the prototype getter, giving oidc-client-ts a
 * working SHA-256 digest without requiring HTTPS.
 *
 * Only runs when crypto.subtle is unavailable (plain HTTP).
 * Safe to call multiple times (no-op when subtle is already present).
 */
function installCryptoSubtlePolyfill(): void {
  if (window.crypto?.subtle) return;
  const polyfill: Pick<SubtleCrypto, 'digest'> = {
    async digest(_algorithm: AlgorithmIdentifier, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> {
      return sha256(new Uint8Array(data instanceof ArrayBuffer ? data : (data as ArrayBufferView).buffer)).buffer;
    },
  };
  try {
    Object.defineProperty(window.crypto, 'subtle', {
      value: polyfill as SubtleCrypto,
      writable: true,
      configurable: true,
    });
    console.log('[auth] crypto.subtle polyfilled for HTTP environment');
  } catch (e) {
    console.warn('[auth] Could not polyfill crypto.subtle:', e);
  }
}

/**
 * Auth user — identity from OIDC, permissions from portal DB
 */
export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: string;                                   // Primary role (backward compat)
  roles: { id: string; name: string }[];          // All assigned roles
  tenant_id: string;
  permissions: string[];                          // Effective permission codes from DB
  is_super_admin: boolean;
}

/**
 * Auth context value
 */
interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  refreshPermissions: () => Promise<void>;
  userManager: UserManager | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider: OIDC code flow with Authentik
 * - Stores tokens in memory (not localStorage) for XSS mitigation
 * - Handles silent token renewal
 * - Exposes user + permissions + login/logout
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userManager, setUserManager] = useState<UserManager | null>(null);

  // Initialize OIDC UserManager
  useEffect(() => {
    // Register token getter for API calls
    setTokenGetter(() => accessToken);
    setRbacTokenGetter(() => accessToken);
  }, [accessToken]);

  /**
   * Fetch effective permissions from portal DB via /api/rbac/me.
   * Called after OIDC login and on manual refresh.
   */
  const loadRbacPermissions = useCallback(async (
    profile: { sub: string; email?: string; name?: string; preferred_username?: string },
    manager?: UserManager | null,
  ): Promise<AuthUser | null> => {
    try {
      const rbac = await rbacApi.me();
      return {
        sub: profile.sub,
        email: rbac.email || profile.email || '',
        name: rbac.name || profile.name || profile.preferred_username || '',
        role: rbac.roles[0]?.name || 'user',
        roles: rbac.roles,
        tenant_id: rbac.tenant.slug,
        permissions: rbac.permissions,
        is_super_admin: rbac.is_super_admin,
      };
    } catch (err) {
      if (err instanceof RbacAuthError && err.status === 401) {
        // Token rejected by API (expired, invalid signature, key rotation).
        // Try silent renew first; if that fails, redirect to login.
        console.warn('[auth] Token rejected by API (401) — attempting silent renew');
        try {
          if (manager) await manager.signinSilent();
          // signinSilent fires addUserLoaded which will re-call loadRbacPermissions
          return null;
        } catch {
          console.warn('[auth] Silent renew failed — redirecting to login');
          if (manager) {
            sessionStorage.setItem('auth_return_path', window.location.pathname + window.location.search);
            await manager.signinRedirect();
          }
          return null;
        }
      }
      console.warn('[auth] Failed to load RBAC permissions, using empty set:', err);
      return {
        sub: profile.sub,
        email: profile.email || '',
        name: profile.name || profile.preferred_username || '',
        role: 'user',
        roles: [],
        tenant_id: 'ndtesting',
        permissions: [],
        is_super_admin: false,
      };
    }
  }, []);

  useEffect(() => {
    // OIDC config — env vars with hardcoded fallbacks for the production portal.
    // import.meta.env.VITE_* is replaced at Vite build time; if undefined (Vite 8
    // tree-shaking issue when env files aren't loaded), fall back to the known
    // production values so the OIDC setup is never silently skipped.
    const oidcIssuer   = import.meta.env.VITE_AUTHENTIK_ISSUER   || 'https://ndt-v1.on-nex.us/application/o/ndt-portal/';
    const oidcClientId = import.meta.env.VITE_AUTHENTIK_CLIENT_ID || 'ndt-portal-606dbe86-3d7';

    // Polyfill crypto.subtle before UserManager is created.
    // oidc-client-ts v3.x calls crypto.subtle.digest('SHA-256') for PKCE; it
    // has no cryptoProvider hook. The polyfill patches window.crypto.subtle
    // with our inline SHA-256 so PKCE works over HTTP.
    installCryptoSubtlePolyfill();

    const settings: UserManagerSettings = {
      authority: oidcIssuer,
      client_id: oidcClientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: `${window.location.origin}/login/callback`,
      post_logout_redirect_uri: `${window.location.origin}/login`,
      useRefreshTokens: true,
      silentRequestTimeoutInSeconds: 10,
      automaticSilentRenew: true,
    };

    const manager = new UserManager(settings);
    setUserManager(manager);

    // Handle token renewal callback
    manager.events.addAccessTokenExpiring(async () => {
      console.log('Token expiring, attempting silent renew...');
      try {
        await manager.signinSilent();
      } catch (err) {
        // Silent renew failed — don't force logout. The token may still be valid
        // for a few more seconds. If an API call 401s, the hook catch handler will
        // surface the error gracefully. User keeps working until the token truly expires.
        console.warn('Silent renew failed (will retry on next expiry event):', err);
      }
    });

    // Handle sign-in/logout events
    manager.events.addUserLoaded(async (loadedUser) => {
      if (loadedUser) {
        setAccessToken(loadedUser.access_token);
        // Register token immediately so rbacApi.me() gets the right token.
        // setAccessToken() queues a React state update (re-render); the useEffect
        // that re-registers the token getter won't fire until after the render.
        // Updating the module-level getter here closes that race condition.
        setRbacTokenGetter(() => loadedUser.access_token);
        // Fetch real permissions from portal DB (not JWT claims)
        const profile = loadedUser.profile as any;
        const authUser = await loadRbacPermissions(profile, manager);
        if (authUser) setUser(authUser);
      }
    });

    manager.events.addUserUnloaded(() => {
      setUser(null);
      setAccessToken(null);
    });

    // On mount: check if user is already signed in
    (async () => {
      try {
        const cachedUser = await manager.getUser();
        if (cachedUser && !cachedUser.expired) {
          setAccessToken(cachedUser.access_token);
          // Register token immediately (same race condition fix as addUserLoaded).
          setRbacTokenGetter(() => cachedUser.access_token);
          const profile = cachedUser.profile as any;
          const authUser = await loadRbacPermissions(profile, manager);
          if (authUser) setUser(authUser);
        } else if (cachedUser?.expired) {
          // Token expired, try silent renew
          try {
            await manager.signinSilent();
          } catch {
            // Silent renew failed, will prompt login
            await manager.removeUser();
          }
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async () => {
    if (!userManager) return;
    try {
      sessionStorage.setItem('auth_return_path', window.location.pathname + window.location.search);
      await userManager.signinRedirect();
    } catch (err) {
      console.error('Login failed:', err);
    }
  }, [userManager]);

  const logout = useCallback(async () => {
    if (!userManager) return;
    try {
      await userManager.signoutRedirect();
    } catch (err) {
      console.error('Logout failed:', err);
      // Force local logout if redirect fails
      await userManager.removeUser();
      setUser(null);
      setAccessToken(null);
      window.location.href = '/login';
    }
  }, [userManager]);

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    return user.permissions.includes(code);
  };

  const refreshPermissions = useCallback(async () => {
    if (!user) return;
    const updated = await loadRbacPermissions({ sub: user.sub, email: user.email, name: user.name }, userManager);
    if (updated) setUser(updated);
  }, [user, userManager, loadRbacPermissions]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, hasPermission, refreshPermissions, userManager }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook: use auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be called within AuthProvider');
  }
  return context;
}

/**
 * Helper: get access token for API calls
 */
export function getAccessToken(): string | null {
  // This is a workaround for cases where you need the token outside of React context
  // In most cases, use useAuth() instead
  const el = document.getElementById('auth-token');
  return el?.textContent || null;
}
