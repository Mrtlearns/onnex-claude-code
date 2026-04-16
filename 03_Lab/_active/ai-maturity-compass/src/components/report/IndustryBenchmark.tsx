import { getIndustryBenchmark, getIndustryName, estimatePercentile } from "@/lib/benchmarks";
import type { DimensionScore } from "@/types";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  scores: DimensionScore[];
  industry: string;
}

const IndustryBenchmark = ({ scores, industry }: Props) => {
  const benchmark = getIndustryBenchmark(industry);
  if (!benchmark) return null;

  const industryName = getIndustryName(industry);
  const orgAvg = scores.reduce((s, d) => s + d.weighted, 0) / scores.length;
  const percentile = estimatePercentile(orgAvg, benchmark);

  return (
    <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-display font-bold text-foreground">
            Industry Benchmarking
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Performance vs. {industryName} industry average
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-display font-bold text-accent">
            {percentile}<span className="text-base text-muted-foreground">th</span>
          </div>
          <p className="text-xs text-muted-foreground">Est. Percentile</p>
        </div>
      </div>

      <div className="space-y-3">
        {scores.map((score) => {
          const industryAvg = benchmark[score.dimension] ?? 3.0;
          const diff = score.weighted - industryAvg;
          const orgPct = (score.weighted / 5) * 100;
          const indPct = (industryAvg / 5) * 100;
          const isAbove = diff > 0.1;
          const isBelow = diff < -0.1;

          return (
            <div key={score.dimension} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground truncate mr-2">
                  {score.dimension}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-muted-foreground text-xs">
                    {score.weighted.toFixed(1)} vs {industryAvg.toFixed(1)}
                  </span>
                  {isAbove ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-0.5 hover:bg-emerald-100">
                      <TrendingUp className="w-3 h-3" />+{diff.toFixed(1)}
                    </Badge>
                  ) : isBelow ? (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] gap-0.5 hover:bg-red-100">
                      <TrendingDown className="w-3 h-3" />{diff.toFixed(1)}
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground text-[10px] gap-0.5 hover:bg-muted">
                      <Minus className="w-3 h-3" />0.0
                    </Badge>
                  )}
                </div>
              </div>
              <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{
                    width: `${orgPct}%`,
                    background: isAbove
                      ? "hsl(var(--success))"
                      : isBelow
                      ? "hsl(var(--danger))"
                      : "hsl(var(--muted-foreground))",
                    opacity: 0.8,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/60"
                  style={{ left: `${indPct}%` }}
                  title={`Industry avg: ${industryAvg.toFixed(1)}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Vertical line = {industryName} industry average. Benchmarks sourced from aggregated AI maturity studies (2024–2026).
      </p>
    </div>
  );
};

export default IndustryBenchmark;
