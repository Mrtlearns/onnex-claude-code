import { useEffect, useState } from "react";
import { LayoutDashboard, FileText, MessageSquare, Box, DollarSign, ArrowRight } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";

const ENTITY_COLORS: Record<string, string> = {
  organization: "hsl(220, 70%, 55%)", person: "hsl(150, 60%, 45%)", product: "hsl(30, 80%, 55%)",
  date: "hsl(280, 50%, 55%)", concept: "hsl(340, 60%, 55%)", event: "hsl(190, 70%, 45%)",
  technology: "hsl(100, 50%, 45%)", location: "hsl(50, 70%, 50%)", other: "hsl(0, 0%, 55%)",
};

export default function Dashboard() {
  const { selectedProject } = useProject();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ documents: 0, sessions: 0, entities: 0, spend: 0, cap: 10 });
  const [entityDist, setEntityDist] = useState<{ type: string; count: number }[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedProject) return;
    const pid = selectedProject.id;
    Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("project_id", pid),
      supabase.from("chat_sessions").select("*", { count: "exact", head: true }).eq("project_id", pid),
      supabase.from("entities").select("type").eq("project_id", pid),
      supabase.from("documents").select("id, name, status, created_at").eq("project_id", pid).order("created_at", { ascending: false }).limit(5),
    ]).then(([docRes, sesRes, entRes, recentRes]) => {
      const entTypes = entRes.data ?? [];
      const dist: Record<string, number> = {};
      entTypes.forEach((e) => { dist[e.type] = (dist[e.type] || 0) + 1; });
      setStats({
        documents: docRes.count ?? 0, sessions: sesRes.count ?? 0,
        entities: entTypes.length, spend: Number(selectedProject.current_spend_usd),
        cap: Number(selectedProject.spending_cap_usd),
      });
      setEntityDist(Object.entries(dist).map(([type, count]) => ({ type, count })));
      setRecentDocs(recentRes.data ?? []);
    });
  }, [selectedProject]);

  if (!selectedProject) {
    return <EmptyState icon={LayoutDashboard} title="No project selected" description="Select or create a project from the sidebar to view your dashboard overview." action={{ label: "Go to Projects", onClick: () => navigate("/projects") }} />;
  }

  const pct = stats.cap > 0 ? Math.min(100, (stats.spend / stats.cap) * 100) : 0;

  const statCards = [
    { label: "Documents", value: stats.documents, icon: FileText, href: "/documents" },
    { label: "Chat Sessions", value: stats.sessions, icon: MessageSquare, href: "/chat" },
    { label: "Entities", value: stats.entities, icon: Box, href: "/entities" },
    { label: "Budget Used", value: `${pct.toFixed(0)}%`, icon: DollarSign, href: "/usage" },
  ];

  return (
    <div className="space-y-8">
      <AnimateIn>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{selectedProject.name} overview</p>
          </div>
        </div>
      </AnimateIn>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <AnimateIn key={s.label} delay={i * 80}>
            <Card
              className="group cursor-pointer hover:shadow-md transition-[box-shadow] active:scale-[0.98] transition-transform"
              onClick={() => navigate(s.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
                <div className="rounded-md bg-muted p-1.5">
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
              </CardContent>
            </Card>
          </AnimateIn>
        ))}
      </div>

      <AnimateIn delay={350}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Budget</CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">${stats.spend.toFixed(2)} / ${stats.cap.toFixed(2)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={pct} className="h-2" />
          </CardContent>
        </Card>
      </AnimateIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnimateIn delay={450}>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Entity Distribution</CardTitle></CardHeader>
            <CardContent>
              {entityDist.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <Box className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm">No entities extracted yet</p>
                  <p className="text-xs mt-1">Upload and process documents to see entities here</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={entityDist} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="type" tick={{ fontSize: 12 }} width={75} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {entityDist.map((e) => <Cell key={e.type} fill={ENTITY_COLORS[e.type] ?? ENTITY_COLORS.other} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimateIn>

        <AnimateIn delay={530}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent Documents</CardTitle>
                {recentDocs.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/documents")}>
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentDocs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm">No documents uploaded yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/documents")}>
                    Upload documents
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                        <span className="text-sm truncate">{doc.name}</span>
                      </div>
                      <Badge variant={doc.status === "processed" ? "default" : doc.status === "error" ? "destructive" : "secondary"} className="text-[10px] shrink-0">{doc.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimateIn>
      </div>
    </div>
  );
}
