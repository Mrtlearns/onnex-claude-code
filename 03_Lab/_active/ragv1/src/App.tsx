import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Documents from "./pages/Documents";
import Entities from "./pages/Entities";
import Relations from "./pages/Relations";
import KnowledgeGraph from "./pages/KnowledgeGraph";
import ApiKeys from "./pages/ApiKeys";
import UsageCosts from "./pages/UsageCosts";
import ApiDocs from "./pages/ApiDocs";
import Settings from "./pages/Settings";
import Evaluation from "./pages/Evaluation";
import Organizations from "./pages/Organizations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <AuthProvider>
      <OrgProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/entities" element={<Entities />} />
              <Route path="/relations" element={<Relations />} />
              <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
              <Route path="/api-keys" element={<ApiKeys />} />
              <Route path="/usage" element={<UsageCosts />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/evaluation" element={<Evaluation />} />
              <Route path="/organizations" element={<Organizations />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </OrgProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
