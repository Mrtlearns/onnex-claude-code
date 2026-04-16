import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getMaturityStage, getMaturityBadgeClasses, getNarrative } from "@/lib/mock-data";
import type { DimensionScore } from "@/types";

interface Props {
  scores: DimensionScore[];
}

const DimensionScoreCards = ({ scores }: Props) => {
  return (
    <div>
      <h3 className="text-xl font-display font-bold text-foreground mb-5">
        Dimension Scores
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scores.map((s) => {
          const stage = getMaturityStage(s.avg);
          return (
            <div
              key={s.dimension}
              className="bg-card rounded-xl p-5 shadow-card border border-border/50"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-semibold text-sm text-foreground">
                  {s.dimension}
                </h4>
                <Badge
                  className={`text-[10px] px-2 py-0.5 border font-semibold ${getMaturityBadgeClasses(stage)}`}
                >
                  {stage}
                </Badge>
              </div>
              <div className="text-4xl font-display font-bold text-accent mb-3">
                {s.avg.toFixed(1)}
              </div>
              <Progress
                value={(s.avg / 5) * 100}
                className="h-2 mb-3"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {getNarrative(s.dimension, s.avg)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DimensionScoreCards;
