import { Apple, Monitor, Terminal } from "lucide-react";
import { useOS, type OS, OS_SHORT } from "@/context/OSContext";
import { cn } from "@/lib/utils";

const items: { id: OS; Icon: typeof Apple }[] = [
  { id: "mac", Icon: Apple },
  { id: "windows", Icon: Monitor },
  { id: "linux", Icon: Terminal },
];

export const OSToggle = () => {
  const { os, setOS } = useOS();
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-card border border-border p-1 shadow-sm">
      {items.map(({ id, Icon }) => {
        const active = os === id;
        return (
          <button
            key={id}
            onClick={() => setOS(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {OS_SHORT[id]}
          </button>
        );
      })}
    </div>
  );
};
