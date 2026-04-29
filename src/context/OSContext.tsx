import { createContext, useContext, useState, ReactNode } from "react";

export type OS = "mac" | "windows" | "linux";

type Ctx = {
  os: OS | null;
  setOS: (os: OS) => void;
  clear: () => void;
};

const OSContext = createContext<Ctx | null>(null);
const KEY = "vci.os";

export const OSProvider = ({ children }: { children: ReactNode }) => {
  const [os, setOSState] = useState<OS | null>(() => {
    try {
      const v = localStorage.getItem(KEY) as OS | null;
      if (v === "mac" || v === "windows" || v === "linux") return v;
    } catch { /* ignore */ }
    return null;
  });

  const setOS = (v: OS) => {
    localStorage.setItem(KEY, v);
    setOSState(v);
  };
  const clear = () => {
    localStorage.removeItem(KEY);
    setOSState(null);
  };

  return <OSContext.Provider value={{ os, setOS, clear }}>{children}</OSContext.Provider>;
};

export const useOS = () => {
  const ctx = useContext(OSContext);
  if (!ctx) throw new Error("useOS must be used within OSProvider");
  return ctx;
};

export const OS_LABELS: Record<OS, string> = {
  mac: "macOS",
  windows: "Windows",
  linux: "Linux",
};
export const OS_SHORT: Record<OS, string> = {
  mac: "Mac",
  windows: "Win",
  linux: "Linux",
};
