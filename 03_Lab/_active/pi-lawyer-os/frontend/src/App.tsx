import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import LandingPage from '@/pages/LandingPage';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import LeadDetail from '@/pages/LeadDetail';
import Cases from '@/pages/Cases';
import CaseDetail from '@/pages/CaseDetail';
import Partners from '@/pages/Partners';
import PartnerDetail from '@/pages/PartnerDetail';
import Analytics from '@/pages/Analytics';
import PortalLogin from '@/pages/PortalLogin';
import ClientPortal from '@/pages/ClientPortal';
import SettingsPage from '@/pages/Settings';
import AIAgent from '@/pages/AIAgent';
import IntakeForm from '@/pages/IntakeForm';

function RootRedirect() {
  return isAuthenticated() ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<RootRedirect />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <Leads />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedRoute>
            <LeadDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases"
        element={
          <ProtectedRoute>
            <Cases />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases/:id"
        element={
          <ProtectedRoute>
            <CaseDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners"
        element={
          <ProtectedRoute>
            <Partners />
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners/:id"
        element={
          <ProtectedRoute>
            <PartnerDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-agent"
        element={
          <ProtectedRoute>
            <AIAgent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      {/* Client portal — no ProtectedRoute, uses portal JWT */}
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal" element={<ClientPortal />} />
      {/* Public intake form — no auth required */}
      <Route path="/intake" element={<IntakeForm />} />
    </Routes>
  );
}
