import { cn } from "@/lib/utils";
import type { Question } from "@/types";

interface QuestionCardProps {
  question: Question;
  selectedScore: number | undefined;
  onSelect: (score: number) => void;
}

const QuestionCard = ({ question, selectedScore, onSelect }: QuestionCardProps) => {
  return (
    <div className="flex-1 container max-w-2xl flex flex-col justify-center py-12">
      <div className="animate-fade-in">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold mb-3">
          {question.dimension}
        </p>
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-8 leading-tight">
          {question.questionText}
        </h2>

        <div className="space-y-3">
          {question.options.map((opt) => {
            const isSelected = selectedScore === opt.score;
            return (
              <button
                key={opt.score}
                onClick={() => onSelect(opt.score)}
                className={cn(
                  "w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150",
                  isSelected
                    ? "border-accent bg-accent/5 shadow-card"
                    : "border-border hover:border-accent/40 hover:bg-secondary/50"
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {opt.label}
                </span>
                <span className={cn("text-sm pt-1.5", isSelected ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;
