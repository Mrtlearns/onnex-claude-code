import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

// Legacy `vci.*` prefix preserved so existing local state survives the rebrand.
const KEY = "vci.theme";

interface Ctx {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
  cycle: () => void;
}

const ThemeCtx = createContext<Ctx | null>(null);

const readStored = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
};

const systemDark = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const apply = (resolved: ResolvedTheme) => {
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => readStored());
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => systemDark());

  // React to OS-level theme changes when in "system" mode.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const resolved: ResolvedTheme = useMemo(
    () => (theme === "system" ? (systemIsDark ? "dark" : "light") : theme),
    [theme, systemIsDark],
  );

  useEffect(() => {
    apply(resolved);
  }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const cycle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, resolved, setTheme, cycle }), [theme, resolved, setTheme, cycle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
};

export const useTheme = (): Ctx => {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme must be used inside <ThemeProvider>");
  return v;
};
