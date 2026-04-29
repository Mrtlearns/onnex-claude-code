import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Sun, Pencil, X } from "lucide-react";
import { OSToggle } from "@/components/OSToggle";
import { useOS } from "@/context/OSContext";
import { useAdmin } from "@/context/AdminContext";

export const SiteHeader = () => {
  const { os } = useOS();
  const { admin, setAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  if (!os) return null;

  const enterAdmin = () => {
    setAdmin(true);
    navigate("/admin");
  };
  const exitAdmin = () => {
    setAdmin(false);
    if (location.pathname.startsWith("/admin")) navigate("/lessons");
  };

  return (
    <header className="absolute top-0 inset-x-0 z-30">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
        <Link to={admin ? "/admin" : "/lessons"} aria-label="Lessons home">
          <OSToggle />
        </Link>
        <div className="flex items-center gap-1.5">
          {admin ? (
            <button
              onClick={exitAdmin}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              <X className="h-3.5 w-3.5" /> Exit Admin
            </button>
          ) : (
            <button
              onClick={enterAdmin}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground text-xs font-semibold transition"
            >
              <Pencil className="h-3.5 w-3.5" /> Admin
            </button>
          )}
          <IconBtn label="Theme">
            <Sun className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Search">
            <Search className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Settings">
            <SlidersHorizontal className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
    </header>
  );
};

const IconBtn = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <button
    aria-label={label}
    className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
  >
    {children}
  </button>
);
