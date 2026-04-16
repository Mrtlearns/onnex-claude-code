import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from "recharts";
import type { DimensionScore, GapAnalysisItem } from "@/types";
import { getIndustryBenchmark } from "@/lib/benchmarks";

interface CurrentRadarChartProps {
  scores: DimensionScore[];
  industry?: string;
}

export const CurrentRadarChart = ({ scores, industry }: CurrentRadarChartProps) => {
  const benchmark = industry ? getIndustryBenchmark(industry) : null;

  const data = scores.map((s) => ({
    dimension: `${s.dimension} (${s.avg.toFixed(1)})`,
    score: s.avg,
    ...(benchmark ? { industry: benchmark[s.dimension] ?? 3.0 } : {}),
    fullMark: 5,
  }));

  return (
    <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50">
      <h3 className="text-xl font-display font-bold text-foreground mb-4 text-center">
        Current AI Maturity Profile
      </h3>
      <ResponsiveContainer width="100%" height={420}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickCount={6}
          />
          <Radar
            name="Current Score"
            dataKey="score"
            stroke="hsl(var(--teal))"
            fill="hsl(var(--teal))"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          {benchmark && (
            <Radar
              name="Industry Average"
              dataKey="industry"
              stroke="hsl(var(--gold))"
              fill="hsl(var(--gold))"
              fillOpacity={0.08}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
          {benchmark && <Legend wrapperStyle={{ fontSize: 13, paddingTop: 16 }} />}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
interface ComparisonRadarChartProps {
  scores: DimensionScore[];
  gaps: GapAnalysisItem[];
}

export const ComparisonRadarChart = ({ scores, gaps }: ComparisonRadarChartProps) => {
  const data = scores.map((s) => {
    const gap = gaps.find((g) => g.dimension === s.dimension);
    return {
      dimension: s.dimension,
      current: s.avg,
      target: gap?.target || s.avg,
      fullMark: 5,
    };
  });

  return (
    <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50">
      <h3 className="text-xl font-display font-bold text-foreground mb-4 text-center">
        Current State vs 12-Month Target
      </h3>
      <ResponsiveContainer width="100%" height={420}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickCount={6}
          />
          <Radar
            name="Current State"
            dataKey="current"
            stroke="hsl(217, 72%, 45%)"
            fill="hsl(217, 72%, 45%)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name="12-Month Target"
            dataKey="target"
            stroke="hsl(142, 71%, 45%)"
            fill="hsl(142, 71%, 45%)"
            fillOpacity={0.08}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 16 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
