import { Brain, CheckCircle2 } from "lucide-react";

const Waiting = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md animate-fade-in">
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-display font-bold text-foreground">AI Maturity</span>
        </div>

        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-3">
          Assessment Submitted
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Your results will be available once your organization's evaluation is complete.
          You will be contacted directly with your report.
        </p>
      </div>
    </div>
  );
};

export default Waiting;
