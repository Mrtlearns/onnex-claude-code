import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export const ThemeToggle = () => {
  const { theme, cycle } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  const label =
    theme === "dark" ? "Theme: dark (click for system)" :
    theme === "system" ? "Theme: system (click for light)" :
    "Theme: light (click for dark)";

  return (
    <button
      onClick={cycle}
      aria-label={label}
      title={label}
      className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};
