import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 animate-fade-in", className)}>
      <div className="rounded-2xl bg-muted/60 p-5 mb-5">
        <Icon className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-[280px] mb-5">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline" size="sm" className="active:scale-[0.97] transition-transform">
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
