import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ClientReport from "@/components/report/ClientReport";
import { supabase } from "@/lib/supabase";
import { Brain, Download, Loader2, Building2, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureAndDownloadPdf } from "@/lib/pdf-export";
import type { ReportData } from "@/types";

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["shared-report", token],
    enabled: !!token,
    queryFn: async (): Promise<ReportData> => {
      const { data, error } = await supabase
        .from("reports")
        .select(`
          *,
          evaluation_cycles!inner(version_number, version_label, triggered_at, organizations!inner(name, industry)),
          dimension_scores(*),
          gap_analysis(*)
        `)
        .eq("shareable_token", token!)
        .single();

      if (error || !data) throw new Error("Report not found");

      const cycle = data.evaluation_cycles as {
        version_number: number;
        version_label: string;
        triggered_at: string;
        organizations: { name: string; industry: string };
      };
      const org = cycle.organizations;

      return {
        orgName: org.name,
        industry: org.industry,
        version: `v${cycle.version_number}`,
        versionLabel: cycle.version_label,
        date: data.generated_at?.slice(0, 10) ?? cycle.triggered_at.slice(0, 10),
        respondentCount: data.respondent_count ?? 0,
        overallScore: data.overall_score ?? 0,
        overallWeighted: data.overall_weighted ?? data.overall_score ?? 0,
        maturityStage: data.maturity_stage ?? "Developing",
        dimensionScores: (data.dimension_scores ?? []).map((ds: { dimension: string; avg_score: number; weighted_score: number }) => ({
          dimension: ds.dimension,
          avg: ds.avg_score,
          weighted: ds.weighted_score,
        })),
        gapAnalysis: (data.gap_analysis ?? []).map((g: { dimension: string; current_score: number; target_score: number; gap: number; priority: string }) => ({
          dimension: g.dimension,
          current: g.current_score,
          target: g.target_score,
          gap: g.gap,
          priority: g.priority as "High" | "Medium" | "Low",
        })),
        shareableToken: token!,
      };
    },
  });

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      await captureAndDownloadPdf(reportRef.current, {
        filename: `${report.orgName.replace(/\s+/g, "_")}_AI_Maturity_${report.version}_${report.date}.pdf`,
      });
    } catch { /* silently fail */ }
    setDownloading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-foreground mb-2">Report Not Found</h2>
          <p className="text-muted-foreground text-sm">
            This shareable link is invalid or has expired. Please request a new link from the assessment administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-sm font-display font-bold text-foreground">
                {report.orgName}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                AI Maturity Assessment • {report.versionLabel}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
        </div>
      </header>
      <main className="container max-w-5xl py-8 animate-fade-in">
        <div ref={reportRef}>
          <ClientReport report={report} />
        </div>
      </main>
      <footer className="border-t border-border bg-secondary/30 py-6">
        <div className="container max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Brain className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">
              Assessment powered by <span className="font-semibold text-foreground">AI Maturity Platform</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            Report generated {new Date(report.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </footer>
    </div>
  );
}
