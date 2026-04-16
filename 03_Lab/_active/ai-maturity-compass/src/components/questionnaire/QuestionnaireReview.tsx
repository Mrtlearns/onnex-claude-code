import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, ArrowLeft, Check } from "lucide-react";
import type { Question } from "@/types";

interface QuestionnaireReviewProps {
  questions: Question[];
  answers: Record<number, number>;
  onBack: () => void;
  onEdit: (questionId: number) => void;
  onSubmit: () => void;
}

const QuestionnaireReview = ({ questions, answers, onBack, onEdit, onSubmit }: QuestionnaireReviewProps) => {
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center h-16 gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground">Review Answers</span>
        </div>
      </div>
      <div className="container max-w-3xl py-8 animate-fade-in">
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">
          Review Your Responses
        </h2>
        <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Your Answer</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q, idx) => {
                const selected = answers[q.id];
                const option = q.options.find((o) => o.score === selected);
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-display font-bold text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-sm">{q.questionText}</TableCell>
                    <TableCell className="text-sm">
                      {option ? (
                        <span className="font-medium">
                          <span className="text-accent font-bold mr-1">{option.label}.</span>
                          {option.text}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Not answered</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(q.id)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            className="flex-1 gap-2"
            disabled={!allAnswered}
            onClick={onSubmit}
          >
            <Check className="w-4 h-4" />
            Submit Assessment
          </Button>
        </div>
        {!allAnswered && (
          <p className="text-sm text-destructive mt-3">
            Please answer all {questions.length} questions before submitting.
          </p>
        )}
      </div>
    </div>
  );
};

export default QuestionnaireReview;
