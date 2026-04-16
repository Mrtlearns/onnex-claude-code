import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * RequireAuth: route guard component
 * Redirects to login if user is not authenticated
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * RequirePermission: gate specific features by permission
 */
export function RequirePermission({
  permission,
  fallback = null,
  children,
}: {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { user, hasPermission } = useAuth();

  if (!user || !hasPermission(permission)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
