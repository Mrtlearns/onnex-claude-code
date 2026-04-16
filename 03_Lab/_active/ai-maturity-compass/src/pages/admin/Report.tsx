import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import ClientReport from "@/components/report/ClientReport";
import {
  RespondentBreakdownTable,
  EngagementCostingCard,
  ProfitabilityCard,
  ProposedSyllabusAccordion,
  IndividualTrainingPlansSection,
} from "@/components/report/InternalSections";
import AIExecutiveSummary from "@/components/report/AIExecutiveSummary";
import AIReportChat from "@/components/report/AIReportChat";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, FileText, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { captureAndDownloadPdf } from "@/lib/pdf-export";
import type { ReportData, InternalReportData, MaturityStage, IndividualTrainingPlan } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadReportFromDB(cycleId: string): Promise<{ report: ReportData; internalData: InternalReportData } | null> {
  // 1. Cycle + org
  const { data: cycle, error: cycleErr } = await supabase
    .from("evaluation_cycles")
    .select("*, organizations(name, industry)")
    .eq("id", cycleId)
    .single();
  if (cycleErr || !cycle) return null;

  // 2. Report row
  const { data: reportRow, error: reportErr } = await supabase
    .from("reports")
    .select("*")
    .eq("cycle_id", cycleId)
    .single();
  if (reportErr || !reportRow) return null;

  const reportId = reportRow.id;

  // 3. All sub-tables in parallel
  const [dimRes, gapRes, costRes, syllRes, respRes] = await Promise.all([
    supabase.from("dimension_scores").select("*").eq("report_id", reportId),
    supabase.from("gap_analysis").select("*").eq("report_id", reportId),
    supabase.from("report_costing").select("*").eq("report_id", reportId).maybeSingle(),
    supabase.from("syllabus_modules").select("*").eq("report_id", reportId),
    supabase.from("respondent_results")
      .select("*, employees(full_name, job_title, employees_affected)")
      .eq("report_id", reportId),
  ]);

  const org = cycle.organizations as { name: string; industry: string };
  const dimScores = dimRes.data ?? [];
  const gapRows = gapRes.data ?? [];
  const costing = costRes.data;
  const syllabus = syllRes.data ?? [];
  const respondents = respRes.data ?? [];

  const report: ReportData = {
    orgName: org.name,
    industry: org.industry,
    version: `v${cycle.version_number}`,
    versionLabel: cycle.version_label,
    date: (reportRow.created_at as string).slice(0, 10),
    respondentCount: cycle.respondent_count,
    overallScore: Number(reportRow.overall_score),
    overallWeighted: Number(reportRow.overall_weighted),
    maturityStage: reportRow.maturity_stage as MaturityStage,
    dimensionScores: dimScores.map((ds: { dimension: string; avg_score: number; weighted_score: number }) => ({
      dimension: ds.dimension,
      avg: Number(ds.avg_score),
      weighted: Number(ds.weighted_score),
    })),
    gapAnalysis: gapRows.map((g: { dimension: string; current_score: number; target_score: number; gap: number; priority: string }) => ({
      dimension: g.dimension,
      current: Number(g.current_score),
      target: Number(g.target_score),
      gap: Number(g.gap),
      priority: g.priority as "High" | "Medium" | "Low",
    })),
    shareableToken: reportRow.shareable_token,
  };

  const internalData: InternalReportData = {
    respondents: respondents.map((r: {
      employees: { full_name: string; job_title: string; employees_affected: number };
      scores: Record<string, number>;
      avg_score: number;
      archetype: string;
      archetype_rationale: string;
    }) => ({
      name: r.employees?.full_name ?? "Unknown",
      title: r.employees?.job_title ?? "",
      employeesAffected: r.employees?.employees_affected ?? 1,
      scores: r.scores ?? {},
      avgScore: Number(r.avg_score),
      archetype: r.archetype ?? undefined,
      archetypeRationale: r.archetype_rationale ?? undefined,
    })),
    weightedAverages: Object.fromEntries(
      dimScores.map((ds: { dimension: string; weighted_score: number }) => [ds.dimension, Number(ds.weighted_score)])
    ),
    costingPhases: costing?.phases ?? [],
    scaleMultiplier: Number(costing?.scale_multiplier ?? 1),
    totalFee: costing?.total_fee ?? 0,
    deliveryCost: costing?.delivery_cost ?? 0,
    netProfit: costing?.net_profit ?? 0,
    grossMargin: Number(costing?.gross_margin ?? 0),
    syllabus: syllabus.map((s: {
      dimension: string; title: string; target_audience: string[];
      objectives: string[]; format: string; duration: string; score: number;
    }) => ({
      dimension: s.dimension,
      title: s.title,
      targetAudience: s.target_audience,
      objectives: s.objectives,
      format: s.format,
      duration: s.duration,
      score: Number(s.score),
    })),
    trainingPlans: respondents
      .filter((r: { training_plan_json: unknown }) => r.training_plan_json)
      .map((r: { training_plan_json: IndividualTrainingPlan }) => r.training_plan_json),
  };

  return { report, internalData };
}

const Report = () => {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState("internal");
  const [downloading, setDownloading] = useState<string | null>(null);
  const clientRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLDivElement>(null);

  // Try sessionStorage synchronously — zero latency for fresh reports
  const [reportState, setReportState] = useState<{ report: ReportData; internalData: InternalReportData } | null>(() => {
    if (!cycleId) return null;
    const stored = sessionStorage.getItem(cycleId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { report: parsed.report, internalData: parsed.internal };
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!reportState);
  const [notFound, setNotFound] = useState(false);

  // If not in sessionStorage, load from DB
  useEffect(() => {
    if (reportState || !cycleId) return;

    if (!UUID_RE.test(cycleId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    loadReportFromDB(cycleId).then((data) => {
      if (data) {
        // Cache in sessionStorage for subsequent visits
        sessionStorage.setItem(cycleId, JSON.stringify({ report: data.report, internal: data.internalData }));
        setReportState(data);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [cycleId, reportState]);

  const handleDownload = async (type: "client" | "internal") => {
    if (!reportState) return;
    const { report } = reportState;
    setDownloading(type);
    try {
      const ref = type === "client" ? clientRef.current : internalRef.current;
      await captureAndDownloadPdf(ref, {
        filename:
          type === "client"
            ? `${report.orgName.replace(/\s+/g, "_")}_AI_Maturity_${report.version}_${report.date}.pdf`
            : `${report.orgName.replace(/\s+/g, "_")}_INTERNAL_AI_Maturity_${report.version}_${report.date}.pdf`,
        isInternal: type === "internal",
      });
      toast({ title: `${type === "client" ? "Client" : "Internal"} PDF downloaded!` });
    } catch (e) {
      console.error("PDF export error:", e);
      toast({ title: "PDF export failed", variant: "destructive" });
    }
    setDownloading(null);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6 animate-fade-in">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (notFound || !reportState) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/40" />
          <h2 className="text-xl font-display font-bold text-foreground">Report Not Found</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            This report could not be loaded. It may have been deleted or the link is invalid.
          </p>
          <Button variant="outline" onClick={() => navigate("/admin/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const { report, internalData } = reportState;
  const shareUrl = `${window.location.origin}/report/share/${report.shareableToken}`;

  return (
    <AdminLayout>
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground flex-1">
            Evaluation Report — {report.versionLabel}
          </h1>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-card rounded-xl shadow-card border border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast({ title: "Link copied!", description: "Shareable report link copied to clipboard." });
            }}
          >
            <Copy className="w-4 h-4" />
            Copy Shareable Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={downloading !== null}
            onClick={() => handleDownload("client")}
          >
            {downloading === "client" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Download Client PDF
          </Button>
          {tab === "internal" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={downloading !== null}
              onClick={() => handleDownload("internal")}
            >
              {downloading === "internal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Download Internal PDF
            </Button>
          )}
        </div>

        {/* Hidden off-screen containers for PDF capture */}
        <div ref={clientRef} className="fixed left-[-9999px] top-0 w-[1000px] bg-background" aria-hidden="true">
          <ClientReport report={report} />
        </div>
        <div ref={internalRef} className="fixed left-[-9999px] top-0 w-[1000px] bg-background" aria-hidden="true">
          <ClientReport report={report} />
          <div className="mt-12 space-y-10 border-t-2 border-dashed border-destructive/30 pt-10">
            <div className="text-center">
              <span className="inline-block px-4 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-bold font-display tracking-wider">
                INTERNAL — CONFIDENTIAL
              </span>
            </div>
            <RespondentBreakdownTable data={internalData} />
            <IndividualTrainingPlansSection data={internalData} />
            <EngagementCostingCard data={internalData} />
            <ProfitabilityCard data={internalData} />
            <ProposedSyllabusAccordion data={internalData} expanded />
          </div>
        </div>

        {/* AI Executive Summary */}
        <div className="mb-6">
          <AIExecutiveSummary report={report} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="internal">Internal Report</TabsTrigger>
            <TabsTrigger value="client">Client Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="client">
            <ClientReport report={report} />
          </TabsContent>

          <TabsContent value="internal">
            <ClientReport report={report} />
            <div className="mt-12 space-y-10 border-t-2 border-dashed border-destructive/30 pt-10">
              <div className="text-center">
                <span className="inline-block px-4 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-bold font-display tracking-wider">
                  INTERNAL — CONFIDENTIAL
                </span>
              </div>
              <RespondentBreakdownTable data={internalData} />
              <EngagementCostingCard data={internalData} />
              <ProfitabilityCard data={internalData} />
              <ProposedSyllabusAccordion data={internalData} expanded />
            </div>
          </TabsContent>
        </Tabs>

        {/* AI Chat Assistant */}
        <AIReportChat report={report} />
      </div>
    </AdminLayout>
  );
};

export default Report;
