import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useTypewriter } from "@/lib/ai-mock";
import { getModel, withFallback } from "@/lib/claude";
import type { ReportData } from "@/types";

interface Props {
  report: ReportData;
}

export default function AIExecutiveSummary({ report }: Props) {
  const [rawText, setRawText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const { displayed, done } = useTypewriter(rawText, 8);

  const generate = async () => {
    setRawText("");
    setError("");
    setGenerating(true);

    const topGaps = [...report.gapAnalysis]
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3);
    const strongest = [...report.dimensionScores].sort((a, b) => b.weighted - a.weighted)[0];
    const weakest = [...report.dimensionScores].sort((a, b) => a.weighted - b.weighted)[0];

    const prompt = `You are a senior AI strategy consultant writing a professional executive summary for a paid AI maturity assessment report. Write in a direct, authoritative, and actionable tone — this is a document clients pay for.

Organization: ${report.orgName}
Industry: ${report.industry}
Assessment Version: ${report.versionLabel}
Respondents: ${report.respondentCount}
Overall Score: ${report.overallScore.toFixed(1)}/5.0 (weighted: ${report.overallWeighted.toFixed(1)})
Maturity Stage: ${report.maturityStage}

Dimension Scores (weighted):
${report.dimensionScores.map((d) => `- ${d.dimension}: ${d.weighted.toFixed(1)}/5.0`).join("\n")}

Top Gaps:
${topGaps.map((g) => `- ${g.dimension}: current ${g.current.toFixed(1)}, target ${g.target.toFixed(1)}, gap ${g.gap.toFixed(1)} (${g.priority} priority)`).join("\n")}

Strongest dimension: ${strongest?.dimension} (${strongest?.weighted.toFixed(1)})
Weakest dimension: ${weakest?.dimension} (${weakest?.weighted.toFixed(1)})

Write a 4-6 paragraph executive summary covering:
1. Current AI maturity state — where the organization stands and what it means
2. Key strengths — what's working and why it matters
3. Critical gaps — the most urgent areas requiring intervention, with specificity
4. Strategic recommendation — a concrete, prioritized roadmap
5. Closing — a forward-looking statement about potential

Be specific to this organization's actual scores. Avoid generic platitudes. Reference actual dimension names and scores. Write at board presentation quality. Do not use markdown headers or bullet points — write in flowing professional prose only.`;

    try {
      const text = await withFallback(async (modelId) => {
        const model = getModel(modelId);
        const result = await model.generateContent(prompt);
        return result.response.text();
      });
      setRawText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  };

  if (!rawText && !generating && !error) {
    return (
      <Card className="shadow-card border-border/50 overflow-hidden">
        <div className="gradient-navy p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-display font-bold text-primary-foreground text-lg">
                AI Executive Summary
              </h3>
              <p className="text-primary-foreground/60 text-sm">
                Generate a comprehensive AI-powered analysis of this assessment
              </p>
            </div>
          </div>
          <Button onClick={generate} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Sparkles className="w-4 h-4" />
            Generate Summary
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-border/50 overflow-hidden">
      <div className="gradient-navy px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="font-display font-bold text-primary-foreground">
            AI Executive Summary
          </h3>
          <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">
            AI Generated
          </Badge>
        </div>
        {(done || error) && (
          <Button variant="ghost" size="sm" onClick={generate} className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </Button>
        )}
      </div>
      <CardContent className="p-6">
        {generating ? (
          <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            <span className="font-medium">Analyzing assessment data with Gemini...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-destructive text-sm mb-3">{error}</p>
            <Button size="sm" variant="outline" onClick={generate}>Try Again</Button>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            {displayed.split("\n\n").map((para, i) => (
              <p key={i} className="text-muted-foreground leading-relaxed mb-3 last:mb-0">
                {para}
              </p>
            ))}
            {!done && (
              <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
