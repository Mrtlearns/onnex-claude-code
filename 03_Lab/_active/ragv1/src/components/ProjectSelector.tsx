import { useProject } from "@/contexts/ProjectContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen } from "lucide-react";

export function ProjectSelector() {
  const { projects, selectedProject, setSelectedProjectId, loading } = useProject();

  if (loading) return null;

  if (projects.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOpen className="h-4 w-4" />
        No projects yet
      </div>
    );
  }

  return (
    <Select
      value={selectedProject?.id.toString() ?? ""}
      onValueChange={(val) => setSelectedProjectId(Number(val))}
    >
      <SelectTrigger className="w-[220px] h-9">
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id.toString()}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
