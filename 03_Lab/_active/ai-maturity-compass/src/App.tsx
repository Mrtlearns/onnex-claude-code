import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminOrgDetail from "./pages/admin/OrgDetail";
import AdminReport from "./pages/admin/Report";
import AdminQuestions from "./pages/admin/Questions";
import EmployeeRegister from "./pages/employee/Register";
import EmployeeQuestionnaire from "./pages/employee/Questionnaire";
import EmployeeWaiting from "./pages/employee/Waiting";
import SharedReport from "./pages/SharedReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/report/share/:token" element={<SharedReport />} />

            {/* Admin — requires admin role */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/org/:id"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminOrgDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/report/:cycleId"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/questions"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminQuestions />
                </ProtectedRoute>
              }
            />

            {/* Employee — requires employee role */}
            <Route
              path="/employee/register"
              element={
                <ProtectedRoute requiredRole="employee">
                  <EmployeeRegister />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/questionnaire"
              element={
                <ProtectedRoute requiredRole="employee">
                  <EmployeeQuestionnaire />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/waiting"
              element={
                <ProtectedRoute requiredRole="employee">
                  <EmployeeWaiting />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
