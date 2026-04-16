import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronDown, ChevronUp, Copy, Download, Clock, BookOpen, Target } from "lucide-react";
import { COMPETENCY_COLORS, COMPETENCY_LABELS } from "@/types";
import type { IndividualTrainingPlan } from "@/types";
import { useToast } from "@/hooks/use-toast";

const PHASE_COLORS = {
  1: "bg-blue-50 text-blue-700 border-blue-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-emerald-50 text-emerald-700 border-emerald-200",
  4: "bg-purple-50 text-purple-700 border-purple-200",
};

const PHASE_LABELS = {
  1: "Foundation",
  2: "Skills",
  3: "Applied",
  4: "Excellence",
};

const PRIORITY_COLORS = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

interface Props {
  plan: IndividualTrainingPlan;
}

export default function IndividualTrainingPlanCard({ plan }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const competencyColor = COMPETENCY_COLORS[plan.competencyLevel] || "bg-slate-100 text-slate-700";
  const topModules = plan.trainingModules.slice(0, 3);
  const highPriority = plan.trainingModules.filter((m) => m.priority === "High").length;

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(plan.jsonPayload, null, 2));
    toast({ title: "JSON copied!", description: "LLM handoff payload copied to clipboard." });
  };

  const downloadMarkdown = () => {
    const blob = new Blob([plan.markdownNarrative], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-plan-${plan.respondentName.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="font-display font-bold text-foreground">{plan.respondentName}</p>
              <p className="text-sm text-muted-foreground">{plan.respondentTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={`${competencyColor} text-xs font-bold hover:opacity-90`}>
              L{plan.competencyLevel} — {plan.competencyLabel}
            </Badge>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{plan.trainingModules.length} modules</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{plan.estimatedHoursTotal}h total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            <span>{plan.estimatedWeeks} weeks</span>
          </div>
          {highPriority > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] hover:bg-red-100">
              {highPriority} High Priority
            </Badge>
          )}
        </div>

        {/* Top 3 modules preview */}
        <div className="space-y-2 mb-4">
          {topModules.map((mod) => (
            <div key={mod.moduleId} className="flex items-center gap-2.5 text-sm">
              <Badge className={`${PHASE_COLORS[mod.phase]} text-[10px] font-bold hover:opacity-90 flex-shrink-0`}>
                {PHASE_LABELS[mod.phase]}
              </Badge>
              <span className="text-foreground truncate">{mod.title}</span>
              <Badge className={`${PRIORITY_COLORS[mod.priority]} text-[10px] ml-auto flex-shrink-0 hover:opacity-90`}>
                {mod.priority}
              </Badge>
            </div>
          ))}
          {plan.trainingModules.length > 3 && (
            <p className="text-xs text-muted-foreground pl-1">
              +{plan.trainingModules.length - 3} more modules in full plan
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-3">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={downloadMarkdown}>
            <Download className="w-3.5 h-3.5" />
            Training Plan
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={copyJson}>
            <Copy className="w-3.5 h-3.5" />
            Copy JSON
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1.5 text-xs text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Collapse" : "Full Plan"}
          </Button>
        </div>

        {/* Expanded full plan */}
        {expanded && (
          <div className="border-t border-border pt-4 mt-2 space-y-4">
            <Accordion type="multiple" className="space-y-2">
              {plan.trainingModules.map((mod) => (
                <AccordionItem
                  key={mod.moduleId}
                  value={mod.moduleId}
                  className="border border-border/50 rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-left text-sm">
                      <Badge className={`${PHASE_COLORS[mod.phase]} text-[10px] font-bold hover:opacity-90`}>
                        Ph{mod.phase}
                      </Badge>
                      <span className="font-medium text-foreground">{mod.title}</span>
                      <span className="text-muted-foreground text-xs ml-1">Wk {mod.deliveryWeek}</span>
                      <Badge className={`${PRIORITY_COLORS[mod.priority]} text-[10px] ml-auto hover:opacity-90`}>
                        {mod.priority}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-1">
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Learning Objectives
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                          {mod.objectives.map((obj, i) => (
                            <li key={i}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span>Format: {mod.suggestedFormat}</span>
                        <span>Duration: {mod.estimatedHours}h</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
