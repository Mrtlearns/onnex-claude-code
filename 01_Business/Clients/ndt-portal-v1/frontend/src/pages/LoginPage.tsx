import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * LoginPage: initial login page
 * Immediately redirects to Authentik OIDC login
 * Can show a login button as fallback
 */
export function LoginPage() {
  const { login, user } = useAuth();
  const loginCalledRef = useRef(false);

  useEffect(() => {
    // If already logged in, redirect to home
    if (user) {
      window.location.href = '/';
      return;
    }

    // Guard: only call signinRedirect once per page mount.
    // login() is now memoized via useCallback, but this ref provides
    // a belt-and-suspenders guard against double-firing in StrictMode
    // or any future re-render before the redirect completes.
    if (loginCalledRef.current) return;
    loginCalledRef.current = true;

    login().catch(console.error);
  }, [user, login]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f5f5f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginBottom: '20px', color: '#333' }}>NDT Portal</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>Redirecting to login...</p>
        <button
          onClick={() => login()}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
