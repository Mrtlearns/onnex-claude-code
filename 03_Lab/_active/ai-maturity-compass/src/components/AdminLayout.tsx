import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, LogOut, Shield, ClipboardList, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navBtnClass = (path: string) =>
    isActive(path)
      ? "text-foreground bg-secondary"
      : "text-muted-foreground hover:text-foreground";

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => navigate("/admin/dashboard")}
            >
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-display font-bold text-foreground">
                AI Maturity
              </span>
            </div>
            <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Shield className="w-3 h-3" />
              Admin
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/dashboard")}
              className={`ml-2 ${navBtnClass("/admin/dashboard")}`}
            >
              <LayoutDashboard className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/questions")}
              className={navBtnClass("/admin/questions")}
            >
              <ClipboardList className="w-4 h-4 mr-1" />
              Questions
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container py-8">{children}</main>
    </div>
  );
};

export default AdminLayout;
