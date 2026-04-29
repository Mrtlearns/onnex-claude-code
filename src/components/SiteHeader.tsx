import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Pencil, X, BookOpen } from "lucide-react";
import { OSToggle } from "@/components/OSToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useOS } from "@/context/OSContext";
import { useAdmin } from "@/context/AdminContext";
import { BRAND } from "@/lib/brand";

export const SiteHeader = () => {
  const { os } = useOS();
  const { admin, setAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const enterAdmin = () => {
    setAdmin(true);
    navigate("/admin");
  };
  const exitAdmin = () => {
    setAdmin(false);
    if (location.pathname.startsWith("/admin")) navigate("/lessons");
  };

  // On the OS picker (no OS chosen yet) we still render a slim header
  // so the theme toggle is reachable. Other controls are hidden.
  if (!os) {
    return (
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            {BRAND.short}
          </span>
          <ThemeToggle />
        </div>
      </header>
    );
  }

  return (
    <header className="absolute top-0 inset-x-0 z-30">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
        {/* The OSToggle must NOT be wrapped in a Link — clicking a chip would
            navigate away from the current lesson. The brand-home affordance
            lives on the dedicated logo/Docs links instead. */}
        <OSToggle />
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
          <Link
            to="/docs"
            aria-label="Documentation"
            title="Documentation"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground text-xs font-semibold transition"
          >
            <BookOpen className="h-3.5 w-3.5" /> Docs
          </Link>
          <ThemeToggle />
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
