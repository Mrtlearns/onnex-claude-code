import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Organization,
  getOrganizations,
  createOrganization,
} from "@/lib/db/organizations";

interface OrgContextType {
  organizations: Organization[];
  selectedOrg: Organization | null;
  setSelectedOrg: (org: Organization | null) => void;
  loading: boolean;
  createOrg: (name: string) => Promise<Organization>;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType>({
  organizations: [],
  selectedOrg: null,
  setSelectedOrg: () => {},
  loading: true,
  createOrg: async () => { throw new Error("OrgProvider not mounted"); },
  refreshOrgs: async () => {},
});

export const useOrg = () => useContext(OrgContext);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = async () => {
    if (!user) {
      setOrganizations([]);
      setSelectedOrg(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getOrganizations(user.id);
      setOrganizations(list);
      if (list.length > 0 && !selectedOrg) {
        setSelectedOrg(list[0]);
      }
    } catch {
      // silently ignore — UI surfaces errors via toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [user]);

  const createOrg = async (name: string): Promise<Organization> => {
    if (!user) throw new Error("Must be authenticated to create an org");
    const org = await createOrganization(name, user.id);
    await fetchOrgs();
    return org;
  };

  return (
    <OrgContext.Provider
      value={{
        organizations,
        selectedOrg,
        setSelectedOrg,
        loading,
        createOrg,
        refreshOrgs: fetchOrgs,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}
