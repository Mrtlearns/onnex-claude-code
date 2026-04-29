import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Sun } from "lucide-react";
import { OSToggle } from "@/components/OSToggle";
import { useOS } from "@/context/OSContext";

export const SiteHeader = () => {
  const { os } = useOS();
  if (!os) return null;
  return (
    <header className="absolute top-0 inset-x-0 z-30">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
        <Link to="/lessons" aria-label="Lessons home">
          <OSToggle />
        </Link>
        <div className="flex items-center gap-1.5">
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
