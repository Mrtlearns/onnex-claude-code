import { QUESTIONS, DIMENSIONS } from "@/config/questions";
import type {
  ReportData, InternalReportData, DimensionScore, GapAnalysisItem,
  Respondent, SyllabusModule, PhaseCosting, IndividualTrainingPlan,
} from "@/types";
import { getMaturityStage, getNarrative } from "./mock-data";
import { generateIndividualTrainingPlan } from "./training-plans";

interface EmployeeAnswers {
  name: string;
  title: string;
  employeesAffected: number;
  answers: Record<number, number>; // questionId -> score
}

function computeDimensionScores(employees: EmployeeAnswers[]): {
  dimensionScores: DimensionScore[];
  weightedAverages: Record<string, number>;
  respondents: Respondent[];
} {
  const respondents: Respondent[] = employees.map((emp) => {
    const dimScores: Record<string, number> = {};
    for (const dim of DIMENSIONS) {
      const qs = QUESTIONS.filter((q) => q.dimension === dim);
      const scores = qs.map((q) => emp.answers[q.id] ?? 3).filter(Boolean);
      dimScores[dim] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 3;
    }
    const dimKeys = Object.keys(dimScores);
    const avgScore = Object.values(dimScores).reduce((a, b) => a + b, 0) / Math.max(dimKeys.length, 1);
    const sortedDims = Object.entries(dimScores).sort((a, b) => b[1] - a[1]);
    const strongest = sortedDims[0];
    const weakest = sortedDims[sortedDims.length - 1];

    let archetype: string;
    if (avgScore < 2.0) archetype = "AI Novice";
    else if (avgScore < 3.0) archetype = "AI Explorer";
    else if (avgScore < 3.8) archetype = "AI Practitioner";
    else if (avgScore < 4.5) archetype = "AI Strategist";
    else archetype = "AI Transformer";

    const archetypeRationale = `Strongest in ${strongest[0]} (${strongest[1].toFixed(1)}), weakest in ${weakest[0]} (${weakest[1].toFixed(1)}). ${
      avgScore >= 3.5
        ? "Demonstrates broad capability with room for targeted improvement."
        : avgScore >= 2.5
        ? "Shows developing awareness with significant growth opportunities."
        : "At early stages — foundational training is the priority."
    }`;

    return { name: emp.name, title: emp.title, employeesAffected: emp.employeesAffected, scores: dimScores, avgScore, archetype, archetypeRationale };
  });

  const totalWeight = respondents.reduce((s, r) => s + r.employeesAffected, 0);
  const weightedAverages: Record<string, number> = {};
  const dimensionScores: DimensionScore[] = [];

  for (const dim of DIMENSIONS) {
    const avg = respondents.reduce((s, r) => s + r.scores[dim], 0) / respondents.length;
    const weighted = totalWeight > 0
      ? respondents.reduce((s, r) => s + r.scores[dim] * r.employeesAffected, 0) / totalWeight
      : avg;
    weightedAverages[dim] = parseFloat(weighted.toFixed(1));
    dimensionScores.push({ dimension: dim, avg: parseFloat(avg.toFixed(1)), weighted: parseFloat(weighted.toFixed(1)) });
  }

  return { dimensionScores, weightedAverages, respondents };
}

function computeDeterministicTarget(score: number): number {
  let jump: number;
  if (score < 2.0) jump = 1.8;
  else if (score < 3.0) jump = 1.4;
  else if (score < 3.8) jump = 1.2;
  else if (score < 4.5) jump = 0.8;
  else jump = 5.0 - score; // push to 5.0
  return parseFloat(Math.min(5.0, score + jump).toFixed(1));
}

function computeGapAnalysis(dimensionScores: DimensionScore[]): GapAnalysisItem[] {
  return dimensionScores.map((ds) => {
    const target = computeDeterministicTarget(ds.weighted);
    const gap = parseFloat((target - ds.weighted).toFixed(1));
    const priority = gap >= 1.4 ? "High" : gap >= 1.0 ? "Medium" : "Low";
    return { dimension: ds.dimension, current: ds.weighted, target, gap, priority };
  });
}

export function deriveCompetencyLevel(proficiencyScore: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (proficiencyScore < 1.5) return 1;
  if (proficiencyScore < 2.5) return 2;
  if (proficiencyScore < 3.5) return 3;
  if (proficiencyScore < 4.3) return 4;
  if (proficiencyScore < 4.9) return 5;
  return 6;
}

function computeSyllabus(dimensionScores: DimensionScore[], respondents: Respondent[]): SyllabusModule[] {
  return dimensionScores
    .filter((ds) => ds.weighted < 3.5)
    .sort((a, b) => a.weighted - b.weighted)
    .map((ds) => {
      const level = ds.weighted < 2 ? "Foundational" : ds.weighted < 3 ? "Intermediate" : "Advanced";
      return {
        dimension: ds.dimension,
        title: `AI ${ds.dimension} ${level} Program`,
        targetAudience: respondents.map((r) => r.title),
        objectives: [
          `Build ${level.toLowerCase()} understanding of ${ds.dimension} concepts`,
          `Identify practical improvements in ${ds.dimension} workflows`,
          `Develop an action plan for advancing ${ds.dimension} maturity`,
        ],
        format: "Video lessons + Knowledge quiz + Scenario simulation",
        duration: `${Math.max(2, Math.round((4 - ds.weighted) * 2))} hours`,
        score: ds.weighted,
      };
    });
}

function computeCosting(respondentCount: number): { phases: PhaseCosting[]; scaleMultiplier: number; totalFee: number; deliveryCost: number; netProfit: number; grossMargin: number } {
  const scale = respondentCount > 20 ? 1.2 : respondentCount > 10 ? 1.0 : 0.8;
  const basePrices = [8500, 22000, 35000, 25000, 18000];
  const phases: PhaseCosting[] = [
    { phase: "Phase 1", description: "AI Readiness Assessment & Strategy Workshop", duration: "2 weeks", fee: Math.round(basePrices[0] * scale) },
    { phase: "Phase 2", description: "Custom AI Training Program Design & Delivery", duration: "6 weeks", fee: Math.round(basePrices[1] * scale) },
    { phase: "Phase 3", description: "AI Implementation & Integration Support", duration: "8 weeks", fee: Math.round(basePrices[2] * scale) },
    { phase: "Phase 4", description: "Change Management & Adoption Program", duration: "6 weeks", fee: Math.round(basePrices[3] * scale) },
    { phase: "Phase 5", description: "Ongoing Support & Optimization", duration: "4 weeks", fee: Math.round(basePrices[4] * scale) },
  ];
  const totalFee = phases.reduce((s, p) => s + p.fee, 0);
  const deliveryCost = Math.round(totalFee * 0.32);
  const netProfit = totalFee - deliveryCost;
  const grossMargin = parseFloat(((netProfit / totalFee) * 100).toFixed(1));
  return { phases, scaleMultiplier: scale, totalFee, deliveryCost, netProfit, grossMargin };
}

export function generateReport(
  orgName: string,
  industry: string,
  employees: EmployeeAnswers[],
  versionNumber: number,
): { report: ReportData; internal: InternalReportData } {
  const { dimensionScores, weightedAverages, respondents } = computeDimensionScores(employees);
  const overallWeighted = parseFloat((Object.values(weightedAverages).reduce((a, b) => a + b, 0) / DIMENSIONS.length).toFixed(1));
  const overallScore = parseFloat((dimensionScores.reduce((s, d) => s + d.avg, 0) / DIMENSIONS.length).toFixed(1));
  const gapAnalysis = computeGapAnalysis(dimensionScores);
  const syllabus = computeSyllabus(dimensionScores, respondents);
  const costing = computeCosting(employees.length);

  const version = `v${versionNumber}`;
  const date = new Date().toISOString().slice(0, 10);
  const versionLabel = `v${versionNumber} — ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  const maturityStage = getMaturityStage(overallWeighted);

  // Generate individual training plans per respondent
  const trainingPlans: IndividualTrainingPlan[] = employees.map((emp, idx) => {
    const respondent = respondents[idx];
    const proficiencyScore = respondent.scores["Individual AI Proficiency"] ?? respondent.avgScore;
    // Compute per-respondent gaps using their individual scores
    const respondentGaps = dimensionScores.map((ds) => {
      const current = parseFloat((respondent.scores[ds.dimension] ?? ds.weighted).toFixed(1));
      const target = computeDeterministicTarget(current);
      const gap = parseFloat((target - current).toFixed(1));
      return { dimension: ds.dimension, current, target, gap, priority: (gap >= 1.4 ? "High" : gap >= 1.0 ? "Medium" : "Low") as "High" | "Medium" | "Low" };
    });

    return generateIndividualTrainingPlan(
      `r-${idx}`,
      emp.name,
      emp.title,
      "individual", // default roleLevel; real DB flow passes actual role
      proficiencyScore,
      respondentGaps,
      { orgName, industry, maturityStage, assessmentVersion: version, assessmentDate: date }
    );
  });

  const report: ReportData = {
    orgName,
    industry,
    version,
    versionLabel,
    date,
    respondentCount: employees.length,
    overallScore,
    overallWeighted,
    maturityStage,
    dimensionScores,
    gapAnalysis,
    shareableToken: `share-${Date.now()}`,
  };

  const internal: InternalReportData = {
    respondents,
    weightedAverages,
    costingPhases: costing.phases,
    scaleMultiplier: costing.scaleMultiplier,
    totalFee: costing.totalFee,
    deliveryCost: costing.deliveryCost,
    netProfit: costing.netProfit,
    grossMargin: costing.grossMargin,
    syllabus,
    trainingPlans,
  };

  return { report, internal };
}

/** Generate mock employee answers for demo purposes */
export function generateMockEmployeeAnswers(employees: { fullName: string; jobTitle: string; employeesAffected: number }[]): EmployeeAnswers[] {
  return employees.map((emp) => {
    const answers: Record<number, number> = {};
    QUESTIONS.forEach((q) => {
      answers[q.id] = Math.floor(Math.random() * 4) + 1 + (Math.random() > 0.5 ? 1 : 0);
      if (answers[q.id] > 5) answers[q.id] = 5;
    });
    return { name: emp.fullName, title: emp.jobTitle, employeesAffected: emp.employeesAffected, answers };
  });
}
