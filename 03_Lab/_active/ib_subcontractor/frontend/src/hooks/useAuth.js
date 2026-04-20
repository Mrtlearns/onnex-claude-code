import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";

const TOKEN_KEY = "prequal_token";
const AUTH_EVENT = "prequal-auth-changed";

function dispatchAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function isTokenExpired(token) {
  try {
    const decoded = jwtDecode(token);
    if (!decoded?.exp) {
      return false;
    }

    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function readStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    window.localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  return token;
}

function readStoredUser() {
  const token = readStoredToken();
  if (!token) {
    return { token: null, user: null };
  }

  try {
    return {
      token,
      user: jwtDecode(token)
    };
  } catch {
    window.localStorage.removeItem(TOKEN_KEY);
    return { token: null, user: null };
  }
}

export default function useAuth() {
  const [{ token, user }, setAuthState] = useState(() => ({ token: null, user: null }));

  useEffect(() => {
    const syncAuth = () => {
      setAuthState(readStoredUser());
    };

    syncAuth();
    window.addEventListener(AUTH_EVENT, syncAuth);
    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener(AUTH_EVENT, syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  const login = (nextToken) => {
    window.localStorage.setItem(TOKEN_KEY, nextToken);
    setAuthState(readStoredUser());
    dispatchAuthChange();
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setAuthState({ token: null, user: null });
    dispatchAuthChange();
  };

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  return {
    token,
    user,
    login,
    logout,
    isAuthenticated
  };
}
