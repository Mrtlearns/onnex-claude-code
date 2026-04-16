import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_spend_usd: number;
  spending_cap_usd: number;
}

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProjectId: (id: number | null) => void;
  loading: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selectedProject: null,
  setSelectedProjectId: () => {},
  loading: true,
  refreshProjects: async () => {},
});

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("projects")
      .select("id, name, description, is_active, created_at, updated_at, current_spend_usd, spending_cap_usd")
      .order("created_at", { ascending: false });
    const list = (data as Project[]) ?? [];
    setProjects(list);
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        setSelectedProjectId: setSelectedId,
        loading,
        refreshProjects: fetchProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
