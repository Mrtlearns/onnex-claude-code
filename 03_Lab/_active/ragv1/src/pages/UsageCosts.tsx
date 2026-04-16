import { useEffect, useState } from "react";
import { DollarSign, TrendingUp } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";

interface UsageLog {
  operation: string;
  model_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

export default function UsageCosts() {
  const { selectedProject } = useProject();
  const [retrievalEvents, setRetrievalEvents] = useState<any[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);

  useEffect(() => {
    if (!selectedProject) return;
    supabase.from("chat_retrieval_events").select("total_cost_usd, retrieval_mode, model_used, created_at")
      .order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRetrievalEvents(data ?? []));
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    supabase
      .from("usage_logs")
      .select("operation, model_used, input_tokens, output_tokens, cost_usd, created_at")
      .eq("project_id", selectedProject.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setUsageLogs((data ?? []) as UsageLog[]));
  }, [selectedProject]);

  if (!selectedProject) {
    return <EmptyState icon={DollarSign} title="No project selected" description="Select a project to view usage and costs." />;
  }

  const spend = Number(selectedProject.current_spend_usd);
  const cap = Number(selectedProject.spending_cap_usd);
  const pct = cap > 0 ? Math.min(100, (spend / cap) * 100) : 0;
  const costByMode: Record<string, number> = {};
  retrievalEvents.forEach((e) => { costByMode[e.retrieval_mode] = (costByMode[e.retrieval_mode] || 0) + Number(e.total_cost_usd); });
  const modeData = Object.entries(costByMode).map(([mode, cost]) => ({ mode, cost: Number(cost.toFixed(4)) }));
  const COLORS = ["hsl(220, 70%, 55%)", "hsl(150, 60%, 45%)", "hsl(30, 80%, 55%)", "hsl(280, 50%, 55%)"];

  const totalInputTokens = usageLogs.reduce((sum, r) => sum + (r.input_tokens ?? 0), 0);
  const totalOutputTokens = usageLogs.reduce((sum, r) => sum + (r.output_tokens ?? 0), 0);
  const totalLogCost = usageLogs.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  return (
    <div className="space-y-8">
      <AnimateIn>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">Usage & Costs</h1>
            <p className="text-sm text-muted-foreground">{retrievalEvents.length} retrieval events</p>
          </div>
        </div>
      </AnimateIn>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Current Spend", value: `$${spend.toFixed(4)}` },
          { label: "Spending Cap", value: `$${cap.toFixed(2)}` },
          { label: "Remaining", value: `$${Math.max(0, cap - spend).toFixed(4)}` },
        ].map((item, i) => (
          <AnimateIn key={item.label} delay={i * 80}>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold tabular-nums">{item.value}</p></CardContent>
            </Card>
          </AnimateIn>
        ))}
      </div>

      <AnimateIn delay={280}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
            </div>
          </CardHeader>
          <CardContent><Progress value={pct} className="h-2.5" /></CardContent>
        </Card>
      </AnimateIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnimateIn delay={360}>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Cost by Retrieval Mode</CardTitle></CardHeader>
            <CardContent>
              {modeData.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm">No usage data yet</p>
                  <p className="text-xs mt-1">Start chatting to see cost breakdowns</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}><BarChart data={modeData}><XAxis dataKey="mode" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimateIn>
        <AnimateIn delay={440}>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Cost Distribution</CardTitle></CardHeader>
            <CardContent>
              {modeData.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm">No usage data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={modeData} dataKey="cost" nameKey="mode" cx="50%" cy="50%" outerRadius={80} label>{modeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Legend /><Tooltip /></PieChart></ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimateIn>
      </div>

      {/* Usage Breakdown by Operation */}
      <AnimateIn delay={520}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Usage Breakdown by Operation</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total Input Tokens", value: totalInputTokens.toLocaleString() },
              { label: "Total Output Tokens", value: totalOutputTokens.toLocaleString() },
              { label: "Total Log Cost", value: `$${totalLogCost.toFixed(4)}` },
            ].map((item, i) => (
              <AnimateIn key={item.label} delay={520 + i * 60}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                  </CardContent>
                </Card>
              </AnimateIn>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              {usageLogs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm">No usage logs yet</p>
                  <p className="text-xs mt-1">Process documents or chat to generate usage data</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Operation</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Model</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Input Tokens</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Output Tokens</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageLogs.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{row.operation}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.model_used ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{(row.input_tokens ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{(row.output_tokens ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">${Number(row.cost_usd ?? 0).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AnimateIn>
    </div>
  );
}
