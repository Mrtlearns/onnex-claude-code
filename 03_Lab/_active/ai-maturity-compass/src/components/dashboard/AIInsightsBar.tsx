import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, AlertCircle, Lightbulb, Loader2 } from "lucide-react";
import { getModel, withFallback } from "@/lib/claude";
import type { Organization } from "@/types";

const icons = [TrendingUp, AlertCircle, Lightbulb];

interface Props {
  organizations: Organization[];
}

export default function AIInsightsBar({ organizations }: Props) {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (organizations.length === 0) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const orgSummary = organizations
          .map((o) => `${o.name} (${o.industry}): ${o.completedCount ?? 0}/${o.employeeCount ?? 0} assessments complete`)
          .join("; ");
        const prompt = `You are an AI portfolio analyst. Based on this client portfolio data: ${orgSummary}. Generate exactly 3 distinct strategic insights as a JSON array of strings (no markdown, no headers). Each insight is 1 sentence, specific, actionable, under 25 words. Focus on: portfolio patterns, risks, and opportunities. Respond with only valid JSON array, e.g. ["insight1","insight2","insight3"]`;
        const text = await withFallback(async (modelId) => {
          const model = getModel(modelId);
          const result = await model.generateContent(prompt);
          return result.response.text();
        });
        const match = text.match(/\[[\s\S]*\]/);
        const parsed: string[] = match ? JSON.parse(match[0]) : [];
        setInsights(parsed.slice(0, 3));
      } catch {
        setInsights([
          "Assess organizations with incomplete responses to ensure representative data.",
          "Organizations at lower maturity stages are strong candidates for foundational AI training programs.",
          "Track completion rates across assessments to identify engagement patterns.",
        ]);
      } finally {
        setLoading(false);
        setVisible(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [organizations]);

  if (!visible && !loading) return null;

  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-display font-bold text-foreground">AI Insights</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
          Auto-generated
        </span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          Generating portfolio insights...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((insight, i) => {
            const Icon = icons[i % icons.length];
            return (
              <div
                key={i}
                className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex gap-3 items-start"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
