export interface Organization {
  id: string;
  name: string;
  industry: string;
  status: "active" | "archived";
  createdAt: string;
  employeeCount: number;
  registeredCount: number;
  completedCount: number;
  lastEvaluationDate: string | null;
}

export type RoleLevel = "cxo" | "director" | "manager" | "individual";

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  phone: string;
  employeesAffected: number;
  roleLevel?: RoleLevel;
  status: "completed" | "in_progress" | "not_started";
  questionsCompleted: number;
}

export interface EvaluationCycle {
  id: string;
  versionNumber: number;
  versionLabel: string;
  triggeredAt: string;
  respondentCount: number;
  status: "draft" | "evaluated";
}

export interface DimensionScore {
  dimension: string;
  avg: number;
  weighted: number;
}

export interface GapAnalysisItem {
  dimension: string;
  current: number;
  target: number;
  gap: number;
  priority: "High" | "Medium" | "Low";
}

export type MaturityStage = "Nascent" | "Developing" | "Scaling" | "Optimized" | "Transforming";

export interface ReportData {
  orgName: string;
  industry: string;
  version: string;
  versionLabel: string;
  date: string;
  respondentCount: number;
  overallScore: number;
  overallWeighted: number;
  maturityStage: MaturityStage;
  dimensionScores: DimensionScore[];
  gapAnalysis: GapAnalysisItem[];
  shareableToken: string;
}

export interface Respondent {
  name: string;
  title: string;
  employeesAffected: number;
  scores: Record<string, number>;
  avgScore: number;
  archetype?: string;
  archetypeRationale?: string;
}

export interface PhaseCosting {
  phase: string;
  description: string;
  duration: string;
  fee: number;
}

export interface SyllabusModule {
  dimension: string;
  title: string;
  targetAudience: string[];
  objectives: string[];
  format: string;
  duration: string;
  score: number;
}

export interface InternalReportData {
  respondents: Respondent[];
  weightedAverages: Record<string, number>;
  costingPhases: PhaseCosting[];
  scaleMultiplier: number;
  totalFee: number;
  deliveryCost: number;
  netProfit: number;
  grossMargin: number;
  syllabus: SyllabusModule[];
  trainingPlans?: IndividualTrainingPlan[];
}

// ─── Competency & Training Plan Types ────────────────────────────────────────

export type AICompetencyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const COMPETENCY_LABELS: Record<AICompetencyLevel, string> = {
  1: "Awareness",
  2: "Beginner",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
  6: "Innovator",
};

export const COMPETENCY_COLORS: Record<AICompetencyLevel, string> = {
  1: "bg-slate-100 text-slate-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-amber-100 text-amber-700",
  4: "bg-emerald-100 text-emerald-700",
  5: "bg-violet-100 text-violet-700",
  6: "bg-orange-100 text-orange-700",
};

export interface IndividualTrainingModule {
  moduleId: string;
  dimension: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  phase: 1 | 2 | 3 | 4;
  objectives: string[];
  suggestedFormat: string;
  estimatedHours: number;
  deliveryWeek: number;
  prerequisiteModuleIds: string[];
}

export interface IndividualTrainingPlan {
  respondentId: string;
  respondentName: string;
  respondentTitle: string;
  roleLevel: RoleLevel;
  competencyLevel: AICompetencyLevel;
  competencyLabel: string;
  overallScore: number;
  dimensionGaps: GapAnalysisItem[];
  trainingModules: IndividualTrainingModule[];
  estimatedWeeks: number;
  estimatedHoursTotal: number;
  markdownNarrative: string;
  jsonPayload: LLMHandoffPayload;
}

export interface LLMHandoffPayload {
  schemaVersion: "1.0";
  individual: {
    name: string;
    role: string;
    roleLevel: string;
    competencyLevel: number;
    competencyLabel: string;
    industry: string;
  };
  context: {
    orgName: string;
    orgIndustry: string;
    orgMaturityStage: string;
    assessmentDate: string;
    assessmentVersion: string;
  };
  gaps: {
    dimension: string;
    currentScore: number;
    targetScore: number;
    gap: number;
    priority: string;
  }[];
  modules: {
    moduleId: string;
    dimension: string;
    title: string;
    phase: number;
    phaseLabel: string;
    priority: string;
    objectives: string[];
    suggestedFormat: string;
    estimatedHours: number;
    deliveryWeek: number;
  }[];
  summary: {
    totalModules: number;
    estimatedWeeks: number;
    estimatedHoursTotal: number;
    highPriorityCount: number;
    topGapDimension: string;
  };
}

export type QuestionAudience = "all" | "cxo" | "manager" | "individual";

export interface QuestionOption {
  score: number;
  label: string;
  text: string;
}

export interface Question {
  id: number;
  dimension: string;
  questionText: string;
  options: QuestionOption[];
  audience?: QuestionAudience;
}
