import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Ctx = {
  admin: boolean;
  toggle: () => void;
  setAdmin: (v: boolean) => void;
};

const AdminContext = createContext<Ctx | null>(null);
const KEY = "vci.admin";

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdminState] = useState(false);

  useEffect(() => {
    setAdminState(localStorage.getItem(KEY) === "1");
  }, []);

  const setAdmin = (v: boolean) => {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
    setAdminState(v);
  };

  return (
    <AdminContext.Provider value={{ admin, setAdmin, toggle: () => setAdmin(!admin) }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
};
