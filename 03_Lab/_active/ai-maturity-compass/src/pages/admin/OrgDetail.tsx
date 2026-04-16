import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { generateReport } from "@/lib/scoring-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Zap, Copy, UserPlus, Eye, Brain, Loader2, Check, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TrendChart from "@/components/report/TrendChart";

const ANALYSIS_STEPS = [
  "Collecting submitted responses…",
  "Calculating dimension scores…",
  "Running gap analysis…",
  "Generating transformation narratives…",
  "Building training syllabus…",
  "Computing engagement costing…",
  "Finalizing report…",
];

const OrgDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [credentialDialog, setCredentialDialog] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalStep, setEvalStep] = useState(0);
  const [evalProgress, setEvalProgress] = useState(0);

  // Fetch org
  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["org", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch employees
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ["employees", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("organization_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // Fetch cycles
  const { data: cycles = [], isLoading: cyclesLoading } = useQuery({
    queryKey: ["cycles", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_cycles")
        .select("*")
        .eq("organization_id", id)
        .order("triggered_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const completedEmployees = employees.filter((e: { status: string }) => e.status === "completed");
  const completedCount = completedEmployees.length;
  const pendingEmployees = employees.filter((e: { status: string }) => e.status === "in_progress");

  const generatedCreds = (() => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    const password = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const orgSlug = (org?.name ?? "org").toLowerCase().replace(/[^a-z0-9]/g, "");
    const username = `${orgSlug}.user${(employees.length + 1).toString().padStart(2, "0")}`;
    return { username, password };
  })();

  const handleEvaluateNow = async () => {
    if (completedCount === 0 || !org) return;
    setEvaluating(true);
    setEvalStep(0);
    setEvalProgress(0);

    // Step 1 — fetch real employee answers from DB
    setEvalStep(0);
    setEvalProgress(14);

    let employeeAnswers: {
      name: string;
      title: string;
      employeesAffected: number;
      answers: Record<number, number>;
    }[] = [];

    try {
      const completedIds = completedEmployees.map((e: { id: string }) => e.id);
      const { data: answerRows } = await supabase
        .from("employee_answers")
        .select("employee_id, question_id, score")
        .in("employee_id", completedIds);

      // Group by employee
      const answersByEmployee: Record<string, Record<number, number>> = {};
      for (const row of answerRows ?? []) {
        if (!answersByEmployee[row.employee_id]) answersByEmployee[row.employee_id] = {};
        answersByEmployee[row.employee_id][row.question_id] = row.score;
      }

      employeeAnswers = completedEmployees.map((e: { id: string; full_name: string; job_title: string; employees_affected: number }) => ({
        name: e.full_name,
        title: e.job_title,
        employeesAffected: e.employees_affected ?? 1,
        answers: answersByEmployee[e.id] ?? {},
      }));
    } catch {
      // Fall back to default answers (scoring engine fills missing with 3)
      employeeAnswers = completedEmployees.map((e: { full_name: string; job_title: string; employees_affected: number }) => ({
        name: e.full_name,
        title: e.job_title,
        employeesAffected: e.employees_affected ?? 1,
        answers: {},
      }));
    }

    // Animate remaining steps
    for (let i = 1; i < ANALYSIS_STEPS.length; i++) {
      setEvalStep(i);
      setEvalProgress(Math.round(((i + 1) / ANALYSIS_STEPS.length) * 100));
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    }

    const versionNumber = cycles.length + 1;
    const { report, internal } = generateReport(
      org.name,
      org.industry,
      employeeAnswers,
      versionNumber
    );

    // Persist report to DB, get real UUID for navigation
    let dbCycleId: string | null = null;
    try {
      const { data: cycleRow, error: cycleErr } = await supabase
        .from("evaluation_cycles")
        .insert({
          organization_id: id,
          version_number: versionNumber,
          version_label: report.versionLabel,
          respondent_count: report.respondentCount,
          status: "evaluated",
        })
        .select("id")
        .single();
      if (cycleErr) throw cycleErr;
      dbCycleId = cycleRow.id;

      const { data: reportRow, error: reportErr } = await supabase
        .from("reports")
        .insert({
          cycle_id: dbCycleId,
          organization_id: id,
          overall_score: report.overallScore,
          overall_weighted: report.overallWeighted,
          maturity_stage: report.maturityStage,
          shareable_token: report.shareableToken,
        })
        .select("id")
        .single();
      if (reportErr) throw reportErr;
      const reportId = reportRow.id;

      await Promise.all([
        supabase.from("dimension_scores").insert(
          report.dimensionScores.map((ds) => ({
            report_id: reportId,
            dimension: ds.dimension,
            avg_score: ds.avg,
            weighted_score: ds.weighted,
          }))
        ),
        supabase.from("gap_analysis").insert(
          report.gapAnalysis.map((g) => ({
            report_id: reportId,
            dimension: g.dimension,
            current_score: g.current,
            target_score: g.target,
            gap: g.gap,
            priority: g.priority,
          }))
        ),
        supabase.from("report_costing").insert({
          report_id: reportId,
          phases: internal.costingPhases,
          scale_multiplier: internal.scaleMultiplier,
          total_fee: internal.totalFee,
          delivery_cost: internal.deliveryCost,
          net_profit: internal.netProfit,
          gross_margin: internal.grossMargin,
        }),
        internal.syllabus.length > 0 && supabase.from("syllabus_modules").insert(
          internal.syllabus.map((s) => ({
            report_id: reportId,
            dimension: s.dimension,
            title: s.title,
            target_audience: s.targetAudience,
            objectives: s.objectives,
            format: s.format,
            duration: s.duration,
            score: s.score,
          }))
        ),
        completedEmployees.length > 0 && supabase.from("respondent_results").insert(
          (completedEmployees as { id: string }[]).slice(0, internal.respondents.length).map((emp, idx) => {
            const r = internal.respondents[idx];
            const plan = internal.trainingPlans?.[idx] ?? null;
            return {
              report_id: reportId,
              employee_id: emp.id,
              scores: r.scores,
              avg_score: r.avgScore,
              archetype: r.archetype ?? null,
              archetype_rationale: r.archetypeRationale ?? null,
              training_plan_json: plan,
              competency_level: plan?.competencyLevel ?? null,
              competency_label: plan?.competencyLabel ?? null,
            };
          })
        ),
      ]);
    } catch (err) {
      console.warn("Failed to persist report to DB — using sessionStorage fallback:", err);
    }

    // Store in sessionStorage with DB UUID (or fallback key)
    const reportKey = dbCycleId ?? `eval-${id}-${versionNumber}`;
    sessionStorage.setItem(reportKey, JSON.stringify({ report, internal }));

    setEvaluating(false);
    toast({ title: "Evaluation complete!", description: `Report v${versionNumber} generated successfully.` });
    navigate(`/admin/report/${reportKey}`);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
      in_progress: "bg-amber-100 text-amber-700 border-amber-200",
      not_started: "bg-muted text-muted-foreground",
    };
    const label: Record<string, string> = { completed: "Completed", in_progress: "In Progress", not_started: "Not Started" };
    return <Badge className={`${map[status] ?? map.not_started} hover:${map[status] ?? map.not_started}`}>{label[status] ?? "Unknown"}</Badge>;
  };

  if (orgLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!org) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">Organization not found.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold text-foreground">{org.name}</h1>
              <Badge variant="secondary">{org.industry}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Created {new Date(org.created_at).toLocaleDateString()}</p>
          </div>
          <Button
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={completedCount === 0 || evaluating || empLoading}
            onClick={handleEvaluateNow}
          >
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Evaluate Now
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="employees">
          <TabsList className="mb-6">
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>

          <TabsContent value="employees">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="font-display font-semibold">Employee Directory ({employees.length})</h3>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => setCredentialDialog(true)}>
                    <UserPlus className="w-4 h-4" />
                    Generate Login
                  </Button>
                </div>
                {empLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : employees.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No employees yet. Generate login credentials and share them.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Employees Affected</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp: { id: string; full_name: string; job_title: string; email: string; employees_affected: number; status: string }) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.full_name}</TableCell>
                          <TableCell>{emp.job_title}</TableCell>
                          <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                          <TableCell className="text-right">{emp.employees_affected}</TableCell>
                          <TableCell>{statusBadge(emp.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evaluations">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-0">
                {cyclesLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : cycles.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No evaluations yet. Run "Evaluate Now" once employees complete their assessments.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Respondents</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycles.map((c: { id: string; version_label: string; triggered_at: string; respondent_count: number; status: string }) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium font-display">{c.version_label}</TableCell>
                          <TableCell>{new Date(c.triggered_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{c.respondent_count}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                              {c.status === "evaluated" ? "Evaluated" : "Draft"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => navigate(`/admin/report/${c.id}`)}>
                              <Eye className="w-4 h-4" /> View Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">At least 2 evaluations are needed to display trends.</p>
                  <p className="text-xs text-muted-foreground mt-1">Run evaluations to start tracking progress over time.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-6">
                {pendingEmployees.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending assessments.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingEmployees.map((emp: { id: string; full_name: string; job_title: string; questions_completed: number }) => (
                      <div key={emp.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                        <div>
                          <p className="font-medium">{emp.full_name}</p>
                          <p className="text-sm text-muted-foreground">{emp.job_title}</p>
                        </div>
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <Progress value={((emp.questions_completed ?? 0) / 39) * 100} className="h-2 flex-1" />
                          <Badge variant="secondary" className="whitespace-nowrap">{emp.questions_completed ?? 0} / 39</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Credential Dialog */}
        <Dialog open={credentialDialog} onOpenChange={setCredentialDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generated Login Credentials</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Username</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-md bg-secondary text-sm font-mono">{generatedCreds.username}</code>
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedCreds.username); toast({ title: "Copied!" }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Temporary Password</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-md bg-secondary text-sm font-mono">{generatedCreds.password}</code>
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedCreds.password); toast({ title: "Copied!" }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Share these credentials securely. The password is only shown once.</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Evaluation Progress Dialog */}
        <Dialog open={evaluating} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" /> AI Analysis in Progress
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <Progress value={evalProgress} className="h-2" />
              <div className="space-y-2">
                {ANALYSIS_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {i < evalStep ? (
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : i === evalStep ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />
                    )}
                    <span className={i <= evalStep ? "text-foreground" : "text-muted-foreground"}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Analyzing {completedCount} completed evaluations…
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default OrgDetail;
