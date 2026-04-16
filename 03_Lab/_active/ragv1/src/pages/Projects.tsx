import { useState } from "react";
import { FolderKanban, Plus, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { createProject, deleteProject, updateProject } from "@/lib/db/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

export default function Projects() {
  const { projects, refreshProjects, setSelectedProjectId } = useProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: number; name: string; description: string } | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const openCreate = () => { setEditingProject(null); setName(""); setDescription(""); setDialogOpen(true); };
  const openEdit = (p: { id: number; name: string; description: string | null }) => {
    setEditingProject({ id: p.id, name: p.name, description: p.description ?? "" });
    setName(p.name); setDescription(p.description ?? ""); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, { name, description: description || null });
        toast.success("Project updated");
      } else {
        const p = await createProject(name, description || undefined);
        setSelectedProjectId(p.id);
        toast.success("Project created");
      }
      await refreshProjects();
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this project and all its data?")) return;
    try { await deleteProject(id); toast.success("Project deleted"); await refreshProjects(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><FolderKanban className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight leading-tight">Projects</h1>
              <p className="text-sm text-muted-foreground">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <Button onClick={openCreate} size="sm" className="active:scale-[0.97] transition-transform">
            <Plus className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        {projects.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create your first project to start uploading documents and building a knowledge base."
              action={{ label: "Create your first project", onClick: openCreate, icon: Plus }}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <AnimateIn key={p.id} delay={i * 60} animation="scale-in">
                <Card
                  className="group relative hover:shadow-md transition-[box-shadow] cursor-pointer active:scale-[0.98]"
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base truncate">{p.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2">{p.description || "No description"}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(p); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">{p.is_active ? "Active" : "Inactive"}</Badge>
                      <span className="tabular-nums">${Number(p.current_spend_usd).toFixed(2)} / ${Number(p.spending_cap_usd).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </AnimateIn>
            ))}
          </div>
        )}
      </AnimateIn>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingProject ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My RAG Project" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading || !name.trim()}>{loading ? "Saving..." : editingProject ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
