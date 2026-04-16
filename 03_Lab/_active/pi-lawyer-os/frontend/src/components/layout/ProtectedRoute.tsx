import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';
import AppShell from './AppShell';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
}
