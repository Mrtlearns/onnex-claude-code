import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QUESTIONS } from "@/config/questions";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import type { Question, RoleLevel } from "@/types";
import QuestionnaireReview from "@/components/questionnaire/QuestionnaireReview";
import QuestionCard from "@/components/questionnaire/QuestionCard";

const STORAGE_PREFIX = "ai-maturity-answers";

function getStorageKey(email: string) {
  return `${STORAGE_PREFIX}-${email}`;
}

function getFilteredQuestions(role: RoleLevel): Question[] {
  return QUESTIONS.filter((q) => {
    if (!q.audience || q.audience === "all") return true;
    if (q.audience === "cxo") return role === "cxo" || role === "director";
    if (q.audience === "manager") return role !== "individual";
    return true;
  });
}

const Questionnaire = () => {
  const navigate = useNavigate();
  const role = (sessionStorage.getItem("employee-role") || "individual") as RoleLevel;
  const email = sessionStorage.getItem("employee-email") || "anonymous";

  const filteredQuestions = useMemo(() => getFilteredQuestions(role), [role]);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showReview, setShowReview] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Restore saved progress
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(email));
      if (saved) {
        const { answers: savedAnswers, currentIndex } = JSON.parse(saved);
        if (savedAnswers && Object.keys(savedAnswers).length > 0) {
          setAnswers(savedAnswers);
          setCurrent(Math.min(currentIndex || 0, filteredQuestions.length - 1));
        }
      }
    } catch {
      // ignore corrupt data
    }
  }, [email, filteredQuestions.length]);

  // Auto-save on changes
  const saveProgress = useCallback(() => {
    try {
      localStorage.setItem(
        getStorageKey(email),
        JSON.stringify({ answers, currentIndex: current, role })
      );
    } catch {
      // storage full
    }
  }, [answers, current, email, role]);

  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      saveProgress();
    }
  }, [answers, current, saveProgress]);

  const question = filteredQuestions[current];
  const answeredCount = filteredQuestions.filter((q) => answers[q.id] !== undefined).length;
  const progress = (answeredCount / filteredQuestions.length) * 100;

  const selectAnswer = (score: number) => {
    setAnswers((prev) => ({ ...prev, [question.id]: score }));
  };

  const next = () => {
    if (current < filteredQuestions.length - 1) {
      setCurrent(current + 1);
    } else {
      setShowReview(true);
    }
  };

  const prev = () => {
    if (showReview) {
      setShowReview(false);
    } else if (current > 0) {
      setCurrent(current - 1);
    }
  };

  const handleSubmit = async () => {
    // Attempt to persist to Supabase (best-effort — continue even if it fails)
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("email", email)
        .single();

      if (emp?.id) {
        const answerRows = filteredQuestions
          .filter((q) => answers[q.id] !== undefined)
          .map((q) => ({
            employee_id: emp.id,
            question_id: q.id,
            score: answers[q.id],
          }));

        await supabase.from("employee_answers").upsert(answerRows, {
          onConflict: "employee_id,question_id",
        });

        await supabase
          .from("employees")
          .update({
            status: "completed",
            questions_completed: filteredQuestions.length,
          })
          .eq("id", emp.id);
      }
    } catch {
      // silently continue — don't block UX if DB fails
    }

    localStorage.removeItem(getStorageKey(email));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-3">
            Thank You! 🎉
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your assessment has been submitted successfully. Your organization will be notified
            once the evaluation is complete.
          </p>
          <Button className="mt-8" onClick={() => navigate("/employee/waiting")}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (showReview) {
    return (
      <QuestionnaireReview
        questions={filteredQuestions}
        answers={answers}
        onBack={prev}
        onEdit={(qId) => {
          const idx = filteredQuestions.findIndex((q) => q.id === qId);
          if (idx >= 0) { setCurrent(idx); setShowReview(false); }
        }}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center h-16 gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium text-foreground">
                Question {current + 1} of {filteredQuestions.length}
              </span>
              <Badge variant="secondary" className="text-xs">
                {question.dimension}
              </Badge>
              {question.audience === "cxo" && (
                <Badge className="text-xs bg-accent/10 text-accent border-accent/20">
                  Executive
                </Badge>
              )}
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Save className="w-3.5 h-3.5" />
            <span>Auto-saved</span>
          </div>
        </div>
      </div>

      {/* Question */}
      <QuestionCard
        question={question}
        selectedScore={answers[question.id]}
        onSelect={selectAnswer}
        key={current}
      />

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-card/80 backdrop-blur-md border-t border-border">
        <div className="container max-w-2xl flex items-center justify-between py-4">
          <Button variant="outline" onClick={prev} disabled={current === 0} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {answeredCount} of {filteredQuestions.length} answered
          </span>
          <Button
            onClick={next}
            disabled={!answers[question.id]}
            className="gap-2"
          >
            {current === filteredQuestions.length - 1 ? "Review Answers" : "Save & Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
