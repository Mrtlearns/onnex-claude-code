import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DIMENSIONS } from "@/config/questions";
import type { InternalReportData } from "@/types";
import IndividualTrainingPlanCard from "./IndividualTrainingPlanCard";

interface Props {
  data: InternalReportData;
  expanded?: boolean;
}

const archetypeColors: Record<string, string> = {
  "AI Novice": "bg-red-100 text-red-700 border-red-200",
  "AI Explorer": "bg-amber-100 text-amber-700 border-amber-200",
  "AI Practitioner": "bg-blue-100 text-blue-700 border-blue-200",
  "AI Strategist": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "AI Transformer": "bg-purple-100 text-purple-700 border-purple-200",
};

export const RespondentBreakdownTable = ({ data }: Props) => (
  <div>
    <div className="flex items-center gap-3 mb-5">
      <h3 className="text-xl font-display font-bold text-foreground">Respondent Breakdown</h3>
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold hover:bg-red-100">
        INTERNAL
      </Badge>
    </div>
    <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Archetype</TableHead>
            <TableHead className="text-right">Emp. Affected</TableHead>
            {DIMENSIONS.map((d) => (
              <TableHead key={d} className="text-center text-xs">{d.split(" ")[0]}</TableHead>
            ))}
            <TableHead className="text-center">Avg</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TooltipProvider>
            {data.respondents.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{r.title}</TableCell>
                <TableCell>
                  {r.archetype ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className={`${archetypeColors[r.archetype] || "bg-muted text-muted-foreground"} text-[10px] font-bold hover:opacity-80 cursor-help`}>
                          {r.archetype}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-xs">
                        {r.archetypeRationale || "No rationale available."}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{r.employeesAffected}</TableCell>
                {DIMENSIONS.map((d) => (
                  <TableCell key={d} className="text-center text-sm">{r.scores[d]?.toFixed(1)}</TableCell>
                ))}
                <TableCell className="text-center font-bold text-accent">{r.avgScore.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TooltipProvider>
          <TableRow className="bg-gold/10 font-bold">
            <TableCell colSpan={4} className="text-gold font-display">Weighted Average</TableCell>
            {DIMENSIONS.map((d) => (
              <TableCell key={d} className="text-center text-gold">{data.weightedAverages[d]?.toFixed(1)}</TableCell>
            ))}
            <TableCell className="text-center text-gold">
              {(Object.values(data.weightedAverages).reduce((a, b) => a + b, 0) / DIMENSIONS.length).toFixed(1)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <p className="text-xs text-muted-foreground mt-2">
      Weighted averages are calculated using each respondent's "Employees Affected" count as the weight factor. Hover over archetypes for rationale.
    </p>
  </div>
);
export const EngagementCostingCard = ({ data }: Props) => (
  <div>
    <div className="flex items-center gap-3 mb-5">
      <h3 className="text-xl font-display font-bold text-foreground">Engagement Costing</h3>
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold hover:bg-red-100">INTERNAL</Badge>
    </div>
    <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phase</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Fee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.costingPhases.map((p) => (
            <TableRow key={p.phase}>
              <TableCell className="font-display font-semibold">{p.phase}</TableCell>
              <TableCell className="text-sm">{p.description}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.duration}</TableCell>
              <TableCell className="text-right font-medium">${p.fee.toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {data.scaleMultiplier > 1 && (
            <TableRow className="bg-amber-50">
              <TableCell colSpan={3} className="text-sm text-amber-700 font-medium">
                Scale Adjustment Applied (×{data.scaleMultiplier})
              </TableCell>
              <TableCell />
            </TableRow>
          )}
          <TableRow className="bg-primary hover:bg-primary">
            <TableCell colSpan={3} className="text-primary-foreground font-display font-bold">
              TOTAL ENGAGEMENT FEE
            </TableCell>
            <TableCell className="text-right text-gold font-display font-bold text-lg">
              ${data.totalFee.toLocaleString()}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <p className="text-xs text-muted-foreground mt-2">Monthly Retainer: $5,000–$8,000/month</p>
  </div>
);

export const ProfitabilityCard = ({ data }: Props) => (
  <div>
    <div className="flex items-center gap-3 mb-5">
      <h3 className="text-xl font-display font-bold text-foreground">Profitability Summary</h3>
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold hover:bg-red-100">INTERNAL</Badge>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 text-center">
        <p className="text-sm text-muted-foreground mb-1">Total Engagement Fee</p>
        <p className="text-3xl font-display font-bold text-gold">${data.totalFee.toLocaleString()}</p>
      </div>
      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 text-center">
        <p className="text-sm text-muted-foreground mb-1">Estimated Delivery Cost</p>
        <p className="text-3xl font-display font-bold text-destructive">${data.deliveryCost.toLocaleString()}</p>
      </div>
      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 text-center">
        <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
        <p className="text-3xl font-display font-bold text-success">${data.netProfit.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground mt-1">Gross Margin: {data.grossMargin.toFixed(1)}%</p>
      </div>
    </div>
  </div>
);

export const IndividualTrainingPlansSection = ({ data }: Props) => {
  if (!data.trainingPlans || data.trainingPlans.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-xl font-display font-bold text-foreground">Individual Training Plans</h3>
        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold hover:bg-red-100">INTERNAL</Badge>
        <Badge variant="secondary" className="text-xs">{data.trainingPlans.length} respondents</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Per-respondent AI training plans generated from assessment gaps. Each plan includes a markdown narrative for PDF export and a structured JSON payload for the LLM training system.
      </p>
      <div className="space-y-4">
        {data.trainingPlans.map((plan) => (
          <IndividualTrainingPlanCard key={plan.respondentId} plan={plan} />
        ))}
      </div>
    </div>
  );
};

export const ProposedSyllabusAccordion = ({ data, expanded }: Props) => (
  <div>
    <div className="flex items-center gap-3 mb-5">
      <h3 className="text-xl font-display font-bold text-foreground">Proposed Training Syllabus</h3>
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold hover:bg-red-100">INTERNAL</Badge>
    </div>
    <Accordion type="multiple" className="space-y-3" defaultValue={expanded ? data.syllabus.map((m) => m.dimension) : undefined}>
      {data.syllabus.map((mod) => (
        <AccordionItem key={mod.dimension} value={mod.dimension} className="bg-card rounded-xl shadow-card border border-border/50 px-5">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="font-display font-bold text-foreground">{mod.title}</span>
              <Badge variant="secondary" className="text-xs">{mod.score < 2 ? "Foundational" : mod.score < 3 ? "Intermediate" : "Advanced"}</Badge>
              <Badge variant="outline" className="text-xs">{mod.duration}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target Audience</p>
              <div className="flex flex-wrap gap-1.5">
                {mod.targetAudience.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Learning Objectives</p>
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                {mod.objectives.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Format</p>
              <div className="flex gap-2 text-sm">
                <span className="px-2 py-1 rounded-md bg-secondary">🎬 Video</span>
                <span className="px-2 py-1 rounded-md bg-secondary">📝 Quiz</span>
                <span className="px-2 py-1 rounded-md bg-secondary">🎭 Scenario</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </div>
);
