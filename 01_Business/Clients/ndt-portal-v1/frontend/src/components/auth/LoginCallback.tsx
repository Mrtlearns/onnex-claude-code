import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * LoginCallback: handles Authentik OIDC redirect
 * Completes the sign-in flow and redirects to the return path.
 *
 * Race-condition fix: signinRedirectCallback() triggers the addUserLoaded event
 * handler in AuthContext, which is async (awaits loadRbacPermissions → HTTP).
 * Navigating immediately after signinRedirectCallback() resolves means
 * RequireAuth can see user=null and redirect back to /login before setUser()
 * completes. We now wait for user to be non-null before navigating, with a
 * 5-second fallback to avoid getting stuck.
 */
export function LoginCallback() {
  const navigate = useNavigate();
  const { userManager, user } = useAuth();

  // Guard: signinRedirectCallback must run exactly once.
  const processedRef = useRef(false);
  // Capture return path immediately (before sessionStorage is cleared)
  const returnPath = useRef(sessionStorage.getItem('auth_return_path') || '/');
  // Set to true after signinRedirectCallback succeeds — triggers user-watch effect
  const [callbackDone, setCallbackDone] = useState(false);

  useEffect(() => {
    if (!userManager || processedRef.current) return;
    processedRef.current = true;
    sessionStorage.removeItem('auth_return_path');

    userManager
      .signinRedirectCallback()
      .then(() => setCallbackDone(true))
      .catch((err) => {
        console.error('OIDC callback failed:', err);
        navigate('/login', { replace: true });
      });
  }, [userManager, navigate]);

  // Navigate as soon as user is set after a successful callback
  useEffect(() => {
    if (callbackDone && user) {
      navigate(returnPath.current, { replace: true });
    }
  }, [callbackDone, user, navigate]);

  // Fallback: if user state is still null 5s after callback (shouldn't happen),
  // navigate anyway so the user isn't stuck on the callback page.
  useEffect(() => {
    if (!callbackDone) return;
    const t = setTimeout(() => {
      navigate(returnPath.current, { replace: true });
    }, 5000);
    return () => clearTimeout(t);
  }, [callbackDone, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', color: '#666' }}>
        {callbackDone ? 'Completing login…' : 'Processing login…'}
      </div>
    </div>
  );
}
