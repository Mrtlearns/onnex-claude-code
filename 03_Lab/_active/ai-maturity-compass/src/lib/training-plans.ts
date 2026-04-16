import type {
  RoleLevel,
  GapAnalysisItem,
  IndividualTrainingModule,
  IndividualTrainingPlan,
  LLMHandoffPayload,
  AICompetencyLevel,
} from "@/types";
import { COMPETENCY_LABELS } from "@/types";
import { deriveCompetencyLevel } from "@/lib/scoring-service";

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Foundation Essentials",
  2: "Skills Development",
  3: "Applied Practice",
  4: "Continuing Excellence",
};

const PHASE_HOURS: Record<1 | 2 | 3 | 4, number> = {
  1: 4,
  2: 6,
  3: 8,
  4: 10,
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function getSuggestedFormat(roleLevel: RoleLevel): string {
  switch (roleLevel) {
    case "cxo":
    case "director":
      return "Executive briefing + case study + peer roundtable";
    case "manager":
      return "Workshop + team project + coaching session";
    default:
      return "Video course + guided exercises + weekly check-in";
  }
}

function derivePhase(current: number, competencyLevel: AICompetencyLevel): 1 | 2 | 3 | 4 {
  if (competencyLevel >= 5) return 4;
  if (current < 2.0) return 1;
  if (current < 3.5) return 2;
  if (current < 4.3) return 3;
  return 4;
}

function buildObjectives(dimension: string, phase: 1 | 2 | 3 | 4): string[] {
  switch (phase) {
    case 1:
      return [
        `Understand foundational concepts and vocabulary in ${dimension}`,
        `Identify key risks and opportunities within ${dimension} for your organization`,
        `Map current state gaps in ${dimension} against industry baseline`,
      ];
    case 2:
      return [
        `Apply AI tools and techniques relevant to ${dimension} workflows`,
        `Practice prompt engineering and tool use in ${dimension} scenarios`,
        `Build hands-on proficiency through structured exercises in ${dimension}`,
      ];
    case 3:
      return [
        `Integrate AI capabilities into live ${dimension} processes and workflows`,
        `Lead or participate in real use-case projects within ${dimension}`,
        `Collaborate cross-functionally to embed AI into ${dimension} operations`,
      ];
    case 4:
      return [
        `Drive thought leadership and AI innovation initiatives in ${dimension}`,
        `Mentor peers on advanced AI integration within ${dimension}`,
        `Contribute to organizational AI governance and standards for ${dimension}`,
      ];
  }
}

function buildModuleId(respondentId: string, dimension: string, phase: number): string {
  const dimSlug = dimension.replace(/\s+/g, "_").toLowerCase();
  return `m-${respondentId.slice(0, 6)}-${dimSlug}-p${phase}`;
}

function sortGapsByPriority(gaps: GapAnalysisItem[]): GapAnalysisItem[] {
  const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  return [...gaps].sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.gap - a.gap;
  });
}

function assignDeliveryWeeks(modules: Omit<IndividualTrainingModule, "deliveryWeek">[]): IndividualTrainingModule[] {
  const phaseOrder: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
  let currentWeek = 1;
  const result: IndividualTrainingModule[] = [];

  for (const phase of phaseOrder) {
    const phaseModules = modules.filter((m) => m.phase === phase);
    for (const mod of phaseModules) {
      result.push({ ...mod, deliveryWeek: currentWeek });
      currentWeek += 1;
    }
  }

  return result;
}

function buildPrerequisites(
  moduleId: string,
  phase: 1 | 2 | 3 | 4,
  allModules: Omit<IndividualTrainingModule, "deliveryWeek">[],
): string[] {
  if (phase === 1) return [];
  const previousPhase = (phase - 1) as 1 | 2 | 3 | 4;
  return allModules
    .filter((m) => m.phase === previousPhase)
    .map((m) => m.moduleId)
    .filter((id) => id !== moduleId);
}

// ─── Narrative Builder ────────────────────────────────────────────────────────

function buildMarkdownNarrative(
  respondentName: string,
  respondentTitle: string,
  competencyLevel: AICompetencyLevel,
  competencyLabel: string,
  overallScore: number,
  orgName: string,
  assessmentDate: string,
  dimensionGaps: GapAnalysisItem[],
  modules: IndividualTrainingModule[],
): string {
  const highGaps = dimensionGaps.filter((g) => g.priority === "High");
  const topGap = dimensionGaps.reduce((max, g) => (g.gap > max.gap ? g : max), dimensionGaps[0]);
  const highScoreDims = dimensionGaps.filter((g) => g.current >= 4.0).map((g) => g.dimension);
  const topGrowthDims = dimensionGaps
    .filter((g) => g.priority !== "Low")
    .slice(0, 3)
    .map((g) => g.dimension);

  const estimatedWeeks = modules.length > 0 ? modules[modules.length - 1].deliveryWeek : 0;
  const estimatedHours = modules.reduce((s, m) => s + m.estimatedHours, 0);

  const executiveSummary = [
    `${respondentName} currently operates at **Level ${competencyLevel} — ${competencyLabel}** AI competency`,
    `with an overall assessment score of **${overallScore.toFixed(1)} / 5.0**.`,
    highGaps.length > 0
      ? `The most critical development area is **${topGap.dimension}** (gap: ${topGap.gap.toFixed(1)}), requiring focused foundational investment.`
      : `Competency is broadly strong, with targeted excellence modules recommended to sustain momentum.`,
    `This plan spans **${estimatedWeeks} week${estimatedWeeks !== 1 ? "s" : ""}** across ${modules.length} module${modules.length !== 1 ? "s" : ""} totalling **${estimatedHours} hours**.`,
  ].join(" ");

  const strengthsText =
    highScoreDims.length > 0
      ? `Demonstrated strengths include **${highScoreDims.join(", ")}**, where existing competency can be leveraged to accelerate peers.`
      : `There are meaningful growth opportunities across all dimensions at this stage.`;

  const growthText =
    topGrowthDims.length > 0
      ? `Priority development areas are **${topGrowthDims.join(", ")}**, each offering high-impact outcomes when addressed.`
      : `All dimensions are performing well; excellence-track modules will sustain and extend this position.`;

  const competencyProfile = [
    `${respondentName} holds a **${competencyLabel}** AI competency profile (Level ${competencyLevel}/6)`,
    `reflecting their current depth of AI awareness, tool use, and integration capability.`,
    strengthsText,
    growthText,
  ].join(" ");

  const tableRows = modules
    .map(
      (m) =>
        `| ${PHASE_LABELS[m.phase as 1 | 2 | 3 | 4]} | ${m.title} | ${m.priority} | ${m.estimatedHours}h | ${m.deliveryWeek} |`,
    )
    .join("\n");

  const immediateAction =
    modules.find((m) => m.phase === 1)?.title ??
    modules[0]?.title ??
    "Review your assessment results with your manager";

  const thirtyDayMilestone =
    topGrowthDims[0] != null
      ? `Complete Phase 1–2 modules for **${topGrowthDims[0]}** and apply at least one new practice in your role`
      : "Complete all Phase 1 modules and establish a weekly AI learning habit";

  const ninetyDayOutcome =
    competencyLevel >= 4
      ? `Reach **Level ${Math.min(6, competencyLevel + 1) as AICompetencyLevel} — ${COMPETENCY_LABELS[Math.min(6, competencyLevel + 1) as AICompetencyLevel]}** competency and lead at least one AI-enabled initiative`
      : `Progress to **Level ${Math.min(6, competencyLevel + 1) as AICompetencyLevel} — ${COMPETENCY_LABELS[Math.min(6, competencyLevel + 1) as AICompetencyLevel]}** and demonstrate measurable AI integration in day-to-day workflows`;

  return `# Individual AI Training Plan: ${respondentName}
**Role:** ${respondentTitle} | **Competency Level:** ${competencyLevel} — ${competencyLabel}
**Generated:** ${assessmentDate} | **Organization:** ${orgName}

## Executive Summary
${executiveSummary}

## Competency Profile
${competencyProfile}

## Training Roadmap

| Phase | Module | Priority | Hours | Week |
|-------|--------|----------|-------|------|
${tableRows}

## Next Steps
- **This week:** Begin "${immediateAction}" — block 2 hours in your calendar to get started.
- **30-day milestone:** ${thirtyDayMilestone}.
- **90-day outcome:** ${ninetyDayOutcome}.
`;
}

// ─── Excellence Fallback ──────────────────────────────────────────────────────

function buildExcellenceModules(
  respondentId: string,
  dimensionGaps: GapAnalysisItem[],
  suggestedFormat: string,
): Omit<IndividualTrainingModule, "deliveryWeek">[] {
  const topTwo = [...dimensionGaps]
    .sort((a, b) => b.current - a.current)
    .slice(0, 2);

  return topTwo.map((gap) => ({
    moduleId: buildModuleId(respondentId, gap.dimension, 4),
    dimension: gap.dimension,
    title: `AI Excellence: ${gap.dimension} — Thought Leadership & Innovation`,
    priority: "Low" as const,
    phase: 4 as const,
    objectives: [
      `Lead AI innovation initiatives in ${gap.dimension}`,
      `Mentor peers on AI integration in ${gap.dimension}`,
      `Contribute to organizational AI governance for ${gap.dimension}`,
    ],
    suggestedFormat,
    estimatedHours: 12,
    prerequisiteModuleIds: [],
  }));
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function generateIndividualTrainingPlan(
  respondentId: string,
  respondentName: string,
  respondentTitle: string,
  roleLevel: RoleLevel,
  proficiencyScore: number,
  dimensionGaps: GapAnalysisItem[],
  orgContext: {
    orgName: string;
    industry: string;
    maturityStage: string;
    assessmentVersion: string;
    assessmentDate: string;
  },
): IndividualTrainingPlan {
  const competencyLevel = deriveCompetencyLevel(proficiencyScore) as AICompetencyLevel;
  const competencyLabel = COMPETENCY_LABELS[competencyLevel];
  const suggestedFormat = getSuggestedFormat(roleLevel);
  const overallScore = parseFloat(
    (dimensionGaps.reduce((s, g) => s + g.current, 0) / Math.max(dimensionGaps.length, 1)).toFixed(1),
  );

  // ── Build raw modules (no deliveryWeek yet) ────────────────────────────────

  const allHighScore = dimensionGaps.every((g) => g.current >= 4.5);

  let rawModules: Omit<IndividualTrainingModule, "deliveryWeek">[];

  if (allHighScore) {
    rawModules = buildExcellenceModules(respondentId, dimensionGaps, suggestedFormat);
  } else {
    const sorted = sortGapsByPriority(dimensionGaps);

    rawModules = sorted.flatMap((gap): Omit<IndividualTrainingModule, "deliveryWeek">[] => {
      const skipLowScore = gap.current >= 4.5 && competencyLevel < 5;
      if (skipLowScore) return [];

      const phase = derivePhase(gap.current, competencyLevel);
      const phaseLabel = PHASE_LABELS[phase];
      const moduleId = buildModuleId(respondentId, gap.dimension, phase);

      const mod: Omit<IndividualTrainingModule, "deliveryWeek"> = {
        moduleId,
        dimension: gap.dimension,
        title: `AI ${gap.dimension}: ${phaseLabel}`,
        priority: gap.priority,
        phase,
        objectives: buildObjectives(gap.dimension, phase),
        suggestedFormat,
        estimatedHours: PHASE_HOURS[phase],
        prerequisiteModuleIds: [],
      };

      return [mod];
    });

    // Backfill prerequisiteModuleIds now that all modules are known
    rawModules = rawModules.map((mod) => ({
      ...mod,
      prerequisiteModuleIds: buildPrerequisites(mod.moduleId, mod.phase, rawModules),
    }));
  }

  // ── Assign delivery weeks in phase order ──────────────────────────────────

  const trainingModules = assignDeliveryWeeks(rawModules);

  const estimatedWeeks = trainingModules.length > 0
    ? trainingModules[trainingModules.length - 1].deliveryWeek
    : 0;
  const estimatedHoursTotal = trainingModules.reduce((s, m) => s + m.estimatedHours, 0);

  // ── Build narrative ───────────────────────────────────────────────────────

  const markdownNarrative = buildMarkdownNarrative(
    respondentName,
    respondentTitle,
    competencyLevel,
    competencyLabel,
    overallScore,
    orgContext.orgName,
    orgContext.assessmentDate,
    dimensionGaps,
    trainingModules,
  );

  // ── Build LLM handoff payload ─────────────────────────────────────────────

  const topGapDimension = dimensionGaps.length > 0
    ? dimensionGaps.reduce((max, g) => (g.gap > max.gap ? g : max), dimensionGaps[0]).dimension
    : "";

  const jsonPayload: LLMHandoffPayload = {
    schemaVersion: "1.0",
    individual: {
      name: respondentName,
      role: respondentTitle,
      roleLevel,
      competencyLevel,
      competencyLabel,
      industry: orgContext.industry,
    },
    context: {
      orgName: orgContext.orgName,
      orgIndustry: orgContext.industry,
      orgMaturityStage: orgContext.maturityStage,
      assessmentDate: orgContext.assessmentDate,
      assessmentVersion: orgContext.assessmentVersion,
    },
    gaps: dimensionGaps.map((g) => ({
      dimension: g.dimension,
      currentScore: g.current,
      targetScore: g.target,
      gap: g.gap,
      priority: g.priority,
    })),
    modules: trainingModules.map((m) => ({
      moduleId: m.moduleId,
      dimension: m.dimension,
      title: m.title,
      phase: m.phase,
      phaseLabel: PHASE_LABELS[m.phase],
      priority: m.priority,
      objectives: m.objectives,
      suggestedFormat: m.suggestedFormat,
      estimatedHours: m.estimatedHours,
      deliveryWeek: m.deliveryWeek,
    })),
    summary: {
      totalModules: trainingModules.length,
      estimatedWeeks,
      estimatedHoursTotal,
      highPriorityCount: trainingModules.filter((m) => m.priority === "High").length,
      topGapDimension,
    },
  };

  return {
    respondentId,
    respondentName,
    respondentTitle,
    roleLevel,
    competencyLevel,
    competencyLabel,
    overallScore,
    dimensionGaps,
    trainingModules,
    estimatedWeeks,
    estimatedHoursTotal,
    markdownNarrative,
    jsonPayload,
  };
}
