import type {
  Organization, Employee, EvaluationCycle, ReportData,
  InternalReportData, Respondent, MaturityStage,
} from "@/types";

export const mockOrganizations: Organization[] = [
  {
    id: "1", name: "GlobalBank Ltd", industry: "Financial Services",
    status: "active", createdAt: "2025-11-10",
    employeeCount: 32, registeredCount: 28, completedCount: 28,
    lastEvaluationDate: "2026-02-15",
  },
  {
    id: "2", name: "Acme Technologies", industry: "Technology",
    status: "active", createdAt: "2025-12-01",
    employeeCount: 18, registeredCount: 15, completedCount: 12,
    lastEvaluationDate: "2026-01-20",
  },
  {
    id: "3", name: "MedTech Solutions", industry: "Healthcare",
    status: "active", createdAt: "2026-01-15",
    employeeCount: 10, registeredCount: 8, completedCount: 0,
    lastEvaluationDate: null,
  },
  {
    id: "4", name: "GreenEnergy Corp", industry: "Energy",
    status: "active", createdAt: "2026-02-01",
    employeeCount: 22, registeredCount: 5, completedCount: 3,
    lastEvaluationDate: null,
  },
  {
    id: "5", name: "RetailMax", industry: "Retail",
    status: "archived", createdAt: "2025-08-20",
    employeeCount: 45, registeredCount: 45, completedCount: 40,
    lastEvaluationDate: "2025-12-01",
  },
];

export const mockEmployees: Record<string, Employee[]> = {
  "1": [
    { id: "e1", fullName: "Sarah Chen", email: "sarah@globalbank.com", jobTitle: "VP of Operations", phone: "+1 555-0101", employeesAffected: 120, status: "completed", questionsCompleted: 24 },
    { id: "e2", fullName: "James Wright", email: "james@globalbank.com", jobTitle: "Head of IT", phone: "+1 555-0102", employeesAffected: 85, status: "completed", questionsCompleted: 24 },
    { id: "e3", fullName: "Maria Garcia", email: "maria@globalbank.com", jobTitle: "Chief Data Officer", phone: "+1 555-0103", employeesAffected: 200, status: "completed", questionsCompleted: 24 },
    { id: "e4", fullName: "David Kim", email: "david@globalbank.com", jobTitle: "Risk Manager", phone: "+1 555-0104", employeesAffected: 45, status: "in_progress", questionsCompleted: 16 },
    { id: "e5", fullName: "Emily Thompson", email: "emily@globalbank.com", jobTitle: "HR Director", phone: "+1 555-0105", employeesAffected: 300, status: "not_started", questionsCompleted: 0 },
  ],
};

export const mockCycles: Record<string, EvaluationCycle[]> = {
  "1": [
    { id: "c1", versionNumber: 1, versionLabel: "v1 — Nov 2025", triggeredAt: "2025-11-28", respondentCount: 20, status: "evaluated" },
    { id: "c2", versionNumber: 2, versionLabel: "v2 — Feb 2026", triggeredAt: "2026-02-15", respondentCount: 28, status: "evaluated" },
  ],
};

export function getMaturityStage(score: number): MaturityStage {
  if (score <= 1.8) return "Nascent";
  if (score <= 2.8) return "Developing";
  if (score <= 3.8) return "Scaling";
  if (score <= 4.5) return "Optimized";
  return "Transforming";
}

export function getMaturityColor(stage: MaturityStage): string {
  switch (stage) {
    case "Nascent": return "bg-danger text-danger";
    case "Developing": return "bg-warning text-warning";
    case "Scaling": return "bg-gold text-gold";
    case "Optimized": return "bg-teal text-teal";
    case "Transforming": return "bg-success text-success";
  }
}

export function getMaturityBadgeClasses(stage: MaturityStage): string {
  switch (stage) {
    case "Nascent": return "bg-red-100 text-red-700 border-red-200";
    case "Developing": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Scaling": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "Optimized": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Transforming": return "bg-green-100 text-green-700 border-green-200";
  }
}

export function getNarrative(dimension: string, score: number): string {
  if (score <= 1.8) return `${dimension} is at its earliest stage. Immediate foundational work is required to establish basic awareness and direction.`;
  if (score <= 2.8) return `${dimension} shows early awareness but lacks structured implementation. Formalizing processes is the next step.`;
  if (score <= 3.8) return `${dimension} is actively developing. Consistency and cross-team alignment will accelerate progress.`;
  if (score <= 4.5) return `${dimension} is well-optimized. Focus shifts to sustaining gains and scaling successes organization-wide.`;
  return `${dimension} is at a transforming level. External benchmarking and innovation leadership are the next frontier.`;
}

export const mockReport: ReportData = {
  orgName: "GlobalBank Ltd",
  industry: "Financial Services",
  version: "v2",
  versionLabel: "v2 — Feb 2026",
  date: "2026-02-15",
  respondentCount: 28,
  overallScore: 3.2,
  overallWeighted: 3.1,
  maturityStage: "Scaling",
  shareableToken: "abc123-share-token",
  dimensionScores: [
    { dimension: "Strategy & Vision", avg: 3.8, weighted: 3.6 },
    { dimension: "Leadership & Culture", avg: 3.5, weighted: 3.4 },
    { dimension: "Current AI Usage", avg: 2.6, weighted: 2.5 },
    { dimension: "Skills & Talent", avg: 2.4, weighted: 2.3 },
    { dimension: "Data & Infrastructure", avg: 3.7, weighted: 3.5 },
    { dimension: "Governance & Ethics", avg: 3.0, weighted: 2.9 },
    { dimension: "Process & Integration", avg: 2.8, weighted: 2.7 },
    { dimension: "Innovation & Scaling", avg: 2.2, weighted: 2.1 },
  ],
  gapAnalysis: [
    { dimension: "Strategy & Vision", current: 3.6, target: 4.5, gap: 0.9, priority: "Low" },
    { dimension: "Leadership & Culture", current: 3.4, target: 4.4, gap: 1.0, priority: "Medium" },
    { dimension: "Current AI Usage", current: 2.5, target: 4.0, gap: 1.5, priority: "High" },
    { dimension: "Skills & Talent", current: 2.3, target: 4.0, gap: 1.7, priority: "High" },
    { dimension: "Data & Infrastructure", current: 3.5, target: 4.5, gap: 1.0, priority: "Medium" },
    { dimension: "Governance & Ethics", current: 2.9, target: 4.2, gap: 1.3, priority: "Medium" },
    { dimension: "Process & Integration", current: 2.7, target: 4.1, gap: 1.4, priority: "High" },
    { dimension: "Innovation & Scaling", current: 2.1, target: 3.8, gap: 1.7, priority: "High" },
  ],
};

export const mockInternalData: InternalReportData = {
  respondents: [
    { name: "Sarah Chen", title: "VP of Operations", employeesAffected: 120, scores: { "Strategy & Vision": 4.0, "Leadership & Culture": 3.5, "Current AI Usage": 2.5, "Skills & Talent": 2.5, "Data & Infrastructure": 4.0, "Governance & Ethics": 3.0, "Process & Integration": 3.0, "Innovation & Scaling": 2.0 }, avgScore: 3.1, archetype: "AI Practitioner", archetypeRationale: "Strongest in Strategy & Vision (4.0), weakest in Innovation & Scaling (2.0). Shows developing awareness with significant growth opportunities." },
    { name: "James Wright", title: "Head of IT", employeesAffected: 85, scores: { "Strategy & Vision": 4.5, "Leadership & Culture": 4.0, "Current AI Usage": 3.0, "Skills & Talent": 3.0, "Data & Infrastructure": 4.5, "Governance & Ethics": 3.5, "Process & Integration": 2.5, "Innovation & Scaling": 2.5 }, avgScore: 3.4, archetype: "AI Practitioner", archetypeRationale: "Strongest in Data & Infrastructure (4.5), weakest in Process & Integration (2.5). Shows developing awareness with significant growth opportunities." },
    { name: "Maria Garcia", title: "Chief Data Officer", employeesAffected: 200, scores: { "Strategy & Vision": 3.5, "Leadership & Culture": 3.5, "Current AI Usage": 2.5, "Skills & Talent": 2.0, "Data & Infrastructure": 3.5, "Governance & Ethics": 2.5, "Process & Integration": 3.0, "Innovation & Scaling": 2.0 }, avgScore: 2.8, archetype: "AI Explorer", archetypeRationale: "Strongest in Strategy & Vision (3.5), weakest in Skills & Talent (2.0). Shows developing awareness with significant growth opportunities." },
  ],
  weightedAverages: { "Strategy & Vision": 3.6, "Leadership & Culture": 3.4, "Current AI Usage": 2.5, "Skills & Talent": 2.3, "Data & Infrastructure": 3.5, "Governance & Ethics": 2.9, "Process & Integration": 2.7, "Innovation & Scaling": 2.1 },
  costingPhases: [
    { phase: "Phase 1", description: "AI Readiness Assessment & Strategy Workshop", duration: "2 weeks", fee: 8500 },
    { phase: "Phase 2", description: "Custom AI Training Program Design & Delivery", duration: "6 weeks", fee: 22000 },
    { phase: "Phase 3", description: "AI Implementation & Integration Support", duration: "8 weeks", fee: 35000 },
    { phase: "Phase 4", description: "Change Management & Adoption Program", duration: "6 weeks", fee: 25000 },
    { phase: "Phase 5", description: "Ongoing Support & Optimization", duration: "4 weeks", fee: 18000 },
  ],
  scaleMultiplier: 1.0,
  totalFee: 108500,
  deliveryCost: 34700,
  netProfit: 73800,
  grossMargin: 68.0,
  syllabus: [
    {
      dimension: "Skills & Talent", title: "AI Skills & Talent Foundations",
      targetAudience: ["VP of Operations", "Head of IT", "Chief Data Officer"],
      objectives: ["Build foundational understanding of AI concepts and terminology", "Identify practical AI applications relevant to daily workflows", "Develop a personal AI learning and experimentation plan"],
      format: "Video lessons + Knowledge quiz + Scenario simulation",
      duration: "4 hours", score: 2.3,
    },
    {
      dimension: "Innovation & Scaling", title: "AI Innovation & Scaling Foundations",
      targetAudience: ["VP of Operations", "Head of IT", "Chief Data Officer"],
      objectives: ["Establish frameworks for AI experimentation", "Create pilot-to-production playbooks", "Build a culture of iterative AI learning across teams"],
      format: "Video lessons + Knowledge quiz + Scenario simulation",
      duration: "4 hours", score: 2.1,
    },
    {
      dimension: "Current AI Usage", title: "Practical AI Usage Workshop",
      targetAudience: ["VP of Operations", "Head of IT", "Chief Data Officer"],
      objectives: ["Hands-on experience with AI tools for daily tasks", "Build prompt engineering skills", "Develop AI-augmented workflow patterns"],
      format: "Video lessons + Knowledge quiz + Scenario simulation",
      duration: "3 hours", score: 2.5,
    },
    {
      dimension: "Process & Integration", title: "AI Process Integration Program",
      targetAudience: ["VP of Operations", "Chief Data Officer", "Risk Manager"],
      objectives: ["Map business processes for AI integration opportunities", "Develop AI implementation roadmaps", "Implement basic AI-powered process automation"],
      format: "Video lessons + Knowledge quiz + Scenario simulation",
      duration: "3 hours", score: 2.7,
    },
    {
      dimension: "Governance & Ethics", title: "AI Governance & Ethics Foundations",
      targetAudience: ["VP of Operations", "Chief Data Officer", "Risk Manager"],
      objectives: ["Understand key AI ethical principles and regulatory landscape", "Develop initial AI governance policy drafts", "Implement basic AI risk assessment processes"],
      format: "Video lessons + Knowledge quiz + Scenario simulation",
      duration: "3 hours", score: 2.9,
    },
  ],
};

export const mockHistoricalScores = [
  {
    version: "v1 — Nov 2025",
    scores: {
      "Strategy & Vision": 2.9,
      "Leadership & Culture": 2.6,
      "Current AI Usage": 1.8,
      "Skills & Talent": 1.7,
      "Data & Infrastructure": 3.0,
      "Governance & Ethics": 2.2,
      "Process & Integration": 2.0,
      "Innovation & Scaling": 1.5,
    },
  },
  {
    version: "v2 — Feb 2026",
    scores: {
      "Strategy & Vision": 3.6,
      "Leadership & Culture": 3.4,
      "Current AI Usage": 2.5,
      "Skills & Talent": 2.3,
      "Data & Infrastructure": 3.5,
      "Governance & Ethics": 2.9,
      "Process & Integration": 2.7,
      "Innovation & Scaling": 2.1,
    },
  },
];
