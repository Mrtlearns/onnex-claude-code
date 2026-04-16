import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMaturityStage, getMaturityBadgeClasses } from "@/lib/mock-data";
import { useTypewriter } from "@/lib/ai-mock";
import { getModel, withFallback } from "@/lib/claude";
import { ArrowRight, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import type { DimensionScore, GapAnalysisItem } from "@/types";

interface NarrativeProps {
  scores: DimensionScore[];
  orgName?: string;
  industry?: string;
}

async function fetchNarrative(dimension: string, score: number, orgName: string, industry: string): Promise<string> {
  const prompt = `You are an AI strategy consultant. Write a concise 2-3 sentence professional analysis (under 120 words) for the dimension "${dimension}" scored ${score.toFixed(1)}/5.0 for ${orgName} in the ${industry} industry. Be specific to the score level, actionable, and use no markdown formatting.`;
  return withFallback(async (modelId) => {
    const model = getModel(modelId);
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}

function NarrativeCard({ s, orgName, industry }: { s: DimensionScore; orgName: string; industry: string }) {
  const stage = getMaturityStage(s.avg);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(true);
  const { displayed, done } = useTypewriter(rawText, 6);

  const load = async () => {
    setRawText("");
    setLoading(true);
    try {
      const text = await fetchNarrative(s.dimension, s.avg, orgName, industry);
      setRawText(text);
    } catch {
      setRawText(`${s.dimension} scored ${s.avg.toFixed(1)}/5.0 — focus on closing gaps in this area to advance AI maturity.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-card rounded-xl p-5 shadow-card border-l-4 border-l-primary border border-border/50">
      <div className="flex items-center gap-3 mb-2">
        <h4 className="font-display font-bold text-foreground">
          {s.dimension}
        </h4>
        <Badge className={`text-[10px] border font-semibold ${getMaturityBadgeClasses(stage)}`}>
          {s.avg.toFixed(1)}
        </Badge>
        <Badge className="bg-accent/10 text-accent border-accent/20 text-[9px] gap-1">
          <Sparkles className="w-2.5 h-2.5" /> AI
        </Badge>
        {!loading && done && (
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="ml-auto h-6 px-2 text-muted-foreground hover:text-accent"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {loading ? (
          <span className="flex items-center gap-2 text-accent">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing with AI...
          </span>
        ) : (
          <>
            {displayed}
            {!done && <span className="inline-block w-1.5 h-3.5 bg-accent animate-pulse ml-0.5" />}
          </>
        )}
      </p>
    </div>
  );
}

export const TransformationNarrative = ({ scores, orgName = "Your Organization", industry = "your industry" }: NarrativeProps) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <h3 className="text-xl font-display font-bold text-foreground">
          Dimension Analysis
        </h3>
        <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px] gap-1">
          <Sparkles className="w-3 h-3" /> AI-Enhanced
        </Badge>
      </div>
      <div className="space-y-4">
        {scores.map((s) => (
          <NarrativeCard key={s.dimension} s={s} orgName={orgName} industry={industry} />
        ))}
      </div>
    </div>
  );
};

interface StepsProps {
  gaps: GapAnalysisItem[];
  orgName?: string;
  industry?: string;
}

const stepDescriptions: Record<string, string> = {
  "Skills & Talent": "Launch a structured AI literacy program with role-specific training paths and hands-on workshops to close the knowledge gap across all departments.",
  "Innovation & Scaling": "Establish cross-functional AI working groups, pilot-to-production playbooks, and regular knowledge-sharing sessions to accelerate organizational learning.",
  "Governance & Ethics": "Formalize AI governance policies, create an ethics review board, and implement risk assessment frameworks for all AI initiatives.",
  "Strategy & Vision": "Align AI strategy with business KPIs and embed AI goals into departmental planning cycles for measurable impact.",
  "Leadership & Culture": "Develop AI champions at every level and create accountability structures for AI adoption outcomes.",
  "Data & Infrastructure": "Invest in data infrastructure, establish clean data pipelines, and deploy integrated AI platforms across the enterprise.",
  "Current AI Usage": "Provide hands-on AI tool training, prompt engineering workshops, and structured adoption programs to increase daily AI utilization across roles.",
  "Process & Integration": "Map business processes for AI integration opportunities, develop implementation roadmaps, and automate high-impact workflows.",
  "Individual AI Proficiency": "Deploy a competency-based AI learning program targeting each employee's current level, with measurable progression milestones.",
  "Use Case Clarity": "Facilitate structured AI use case discovery workshops to identify, validate, and prioritize high-value automation and augmentation opportunities.",
  "Financial & Vendor Readiness": "Establish an AI investment framework with clear ROI metrics, vendor evaluation criteria, and a governed procurement process.",
};

export const RecommendedNextSteps = ({ gaps, orgName, industry }: StepsProps) => {
  const topGaps = [...gaps].sort((a, b) => b.gap - a.gap).slice(0, 3);

  return (
    <div>
      <h3 className="text-xl font-display font-bold text-foreground mb-5">
        Recommended Next Steps
      </h3>
      <div className="space-y-4">
        {topGaps.map((g, i) => (
          <div
            key={g.dimension}
            className="bg-card rounded-xl p-5 shadow-card border border-border/50 flex gap-4"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center">
              <span className="text-lg font-display font-bold text-gold">{i + 1}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-display font-bold text-foreground">
                  {g.dimension}
                </h4>
                <ArrowRight className="w-4 h-4 text-success" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {stepDescriptions[g.dimension] || `Focus on improving ${g.dimension} to close the ${g.gap.toFixed(1)} point gap.`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
