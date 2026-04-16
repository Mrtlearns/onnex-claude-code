import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import AIInsightsBar from "@/components/dashboard/AIInsightsBar";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building2, Users, ClipboardCheck, Calendar } from "lucide-react";
import type { Organization } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface OrgRow {
  id: string;
  name: string;
  industry: string;
  status: string;
  created_at: string;
  employees: { count: number }[];
  completed_employees: { count: number }[];
  last_cycle: { triggered_at: string }[];
}

function rowToOrg(row: OrgRow): Organization {
  const registered = row.employees?.[0]?.count ?? 0;
  const completed = row.completed_employees?.[0]?.count ?? 0;
  const lastDate = row.last_cycle?.[0]?.triggered_at ?? null;
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    status: (row.status as Organization["status"]) ?? "active",
    createdAt: row.created_at,
    employeeCount: registered,
    registeredCount: registered,
    completedCount: completed,
    lastEvaluationDate: lastDate,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select(`
          id, name, industry, status, created_at,
          employees:employees(count),
          completed_employees:employees(count).filter(status.eq.completed),
          last_cycle:evaluation_cycles(triggered_at).order(triggered_at.desc).limit(1)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback: simple query without complex selects
        const { data: simple, error: simpleError } = await supabase
          .from("organizations")
          .select("id, name, industry, status, created_at")
          .order("created_at", { ascending: false });
        if (simpleError) throw simpleError;
        return (simple ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          industry: row.industry,
          status: (row.status ?? "active") as Organization["status"],
          createdAt: row.created_at,
          employeeCount: 0,
          registeredCount: 0,
          completedCount: 0,
          lastEvaluationDate: null,
        }));
      }
      return (data ?? []).map((row) => rowToOrg(row as unknown as OrgRow));
    },
  });

  const createOrg = useMutation({
    mutationFn: async ({ name, industry }: { name: string; industry: string }) => {
      const { data, error } = await supabase
        .from("organizations")
        .insert({ name, industry, status: "active" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setOpen(false);
      setNewName("");
      setNewIndustry("");
      toast({ title: "Organization created!" });
    },
    onError: (err) => {
      toast({ title: "Failed to create organization", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createOrg.mutate({ name: newName.trim(), industry: newIndustry.trim() });
  };

  return (
    <AdminLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Organizations
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage client organizations and their AI maturity assessments
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
              </DialogHeader>
              <form className="space-y-4 pt-2" onSubmit={handleCreateOrg}>
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    placeholder="e.g. Acme Corp"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    placeholder="e.g. Financial Services"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createOrg.isPending}>
                  {createOrg.isPending ? "Creating..." : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <AIInsightsBar organizations={orgs} />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="shadow-card border-border/50">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">No organizations yet</h3>
            <p className="text-muted-foreground mb-4">Create your first client organization to get started.</p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> New Organization
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orgs.map((org) => (
              <Card
                key={org.id}
                className="shadow-card hover:shadow-card-hover transition-all duration-200 cursor-pointer group border-border/50"
                onClick={() => navigate(`/admin/org/${org.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg text-foreground">
                          {org.name}
                        </h3>
                        {org.industry && (
                          <Badge variant="secondary" className="text-xs mt-0.5">
                            {org.industry}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={org.status === "active" ? "default" : "secondary"}
                      className={
                        org.status === "active"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {org.status === "active" ? "Active" : "Archived"}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{org.registeredCount} employees registered</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ClipboardCheck className="w-4 h-4" />
                      <span>{org.completedCount} / {org.registeredCount} completed</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {org.lastEvaluationDate
                          ? `Last evaluated: ${new Date(org.lastEvaluationDate).toLocaleDateString()}`
                          : "Not yet evaluated"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
