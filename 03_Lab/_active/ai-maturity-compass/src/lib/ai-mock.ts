import { useState, useEffect, useCallback } from "react";
import type { ReportData, DimensionScore, GapAnalysisItem, Question } from "@/types";
import { getIndustryBenchmark, getIndustryName, estimatePercentile } from "@/lib/benchmarks";

// --- Typewriter Hook ---
export function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

// --- Helpers ---
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function weakest(scores: DimensionScore[]): DimensionScore {
  return [...scores].sort((a, b) => a.avg - b.avg)[0];
}
function strongest(scores: DimensionScore[]): DimensionScore {
  return [...scores].sort((a, b) => b.avg - a.avg)[0];
}

// --- Executive Summary Generator ---
export function generateExecutiveSummary(report: ReportData): string {
  const weak = weakest(report.dimensionScores);
  const strong = strongest(report.dimensionScores);
  const topGap = [...report.gapAnalysis].sort((a, b) => b.gap - a.gap)[0];

  return `Executive Summary — ${report.orgName} AI Maturity Assessment (${report.versionLabel})

${report.orgName}, operating in the ${report.industry} sector, underwent a comprehensive AI maturity evaluation involving ${report.respondentCount} respondents across eight strategic dimensions. The organization achieved an overall maturity score of ${report.overallScore.toFixed(1)} out of 5.0, placing it at the "${report.maturityStage}" stage of AI readiness.

The strongest area of performance is ${strong.dimension} (${strong.avg.toFixed(1)}), indicating ${strong.avg >= 3.5 ? "a solid foundation of strategic alignment and active implementation" : "emerging capabilities that can be leveraged as a growth catalyst"}. Conversely, ${weak.dimension} remains the most critical gap at ${weak.avg.toFixed(1)}, representing ${weak.avg <= 2.5 ? "a significant organizational blind spot requiring urgent attention" : "an area with room for structured improvement"}.

Gap analysis reveals that ${topGap.dimension} carries the largest delta of ${topGap.gap.toFixed(1)} points between current state and target maturity. ${pick(["Addressing this gap should be the top priority for Q2 planning.", "A focused intervention program is recommended to close this gap within 90 days.", "Cross-functional task forces should be mobilized to tackle this dimension first."])}

${pick([
  `Given the ${report.industry} industry's accelerating AI adoption curve, ${report.orgName} is well-positioned to leapfrog competitors by investing in structured training and governance frameworks.`,
  `Benchmarked against ${report.industry} peers, the organization shows above-average Vision scores but needs to translate strategic intent into operational capability across all departments.`,
  `The data suggests a classic "strategy-execution gap" — leadership vision is strong, but frontline skills and collaboration mechanisms need reinforcement to deliver on AI ambitions.`,
])}

Recommended immediate actions: (1) Launch a targeted ${weak.dimension} upskilling program, (2) Establish an AI governance committee with cross-departmental representation, and (3) Implement quarterly maturity re-assessments to track progress against the ${report.overallScore >= 3.5 ? "Optimized" : "Scaling"} target stage.`;
}

// --- Chat Intent Matcher ---
interface ChatContext {
  report: ReportData;
}

const intents: Array<{
  patterns: RegExp[];
  respond: (ctx: ChatContext) => string;
}> = [
  {
    patterns: [/weak/i, /worst/i, /lowest/i, /behind/i, /struggle/i],
    respond: ({ report }) => {
      const w = weakest(report.dimensionScores);
      return `The weakest dimension is **${w.dimension}** with a score of **${w.avg.toFixed(1)}/5.0**. This is classified as "${w.avg <= 2.5 ? "Developing" : "Scaling"}" maturity. I'd recommend prioritizing a focused training program in this area — it represents the highest-impact opportunity for improvement.`;
    },
  },
  {
    patterns: [/strong/i, /best/i, /highest/i, /top/i, /excel/i],
    respond: ({ report }) => {
      const s = strongest(report.dimensionScores);
      return `Your strongest dimension is **${s.dimension}** at **${s.avg.toFixed(1)}/5.0**. This is a competitive advantage — consider using champions from this area to mentor other departments and share best practices.`;
    },
  },
  {
    patterns: [/overall/i, /total/i, /summary/i, /general/i, /maturity/i],
    respond: ({ report }) =>
      `${report.orgName} achieved an overall AI maturity score of **${report.overallScore.toFixed(1)}/5.0** (weighted: ${report.overallWeighted.toFixed(1)}), placing the organization at the **"${report.maturityStage}"** stage. This assessment was based on responses from ${report.respondentCount} participants across ${report.dimensionScores.length} dimensions.`,
  },
  {
    patterns: [/recommend/i, /suggest/i, /should/i, /next step/i, /action/i, /improve/i],
    respond: ({ report }) => {
      const gaps = [...report.gapAnalysis].sort((a, b) => b.gap - a.gap).slice(0, 3);
      return `Based on the gap analysis, here are the top 3 recommendations:\n\n${gaps.map((g, i) => `${i + 1}. **${g.dimension}** — Close the ${g.gap.toFixed(1)}-point gap (current: ${g.current.toFixed(1)}, target: ${g.target.toFixed(1)}). Priority: ${g.priority}.`).join("\n")}\n\nI'd suggest starting with ${gaps[0].dimension} as it has the largest impact potential.`;
    },
  },
  {
    patterns: [/gap/i, /delta/i, /difference/i, /target/i],
    respond: ({ report }) => {
      const sorted = [...report.gapAnalysis].sort((a, b) => b.gap - a.gap);
      return `Here's the gap analysis ranked by severity:\n\n${sorted.map((g) => `• **${g.dimension}**: ${g.current.toFixed(1)} → ${g.target.toFixed(1)} (gap: ${g.gap.toFixed(1)}, ${g.priority} priority)`).join("\n")}`;
    },
  },
  {
    patterns: [/budget/i, /cost/i, /price/i, /investment/i, /fee/i],
    respond: () =>
      `Budget details are available in the **Internal Report** tab under "Engagement Costing." The costing model includes 5 phases from initial assessment through ongoing optimization. Total engagement fees are scaled based on organization size and complexity.`,
  },
  {
    patterns: [/timeline/i, /when/i, /how long/i, /duration/i, /schedule/i],
    respond: () =>
      `A typical AI maturity transformation program runs **22-26 weeks** across 5 phases: Assessment (2 weeks), Training Design (6 weeks), Implementation (8 weeks), Change Management (6 weeks), and Optimization (4 weeks). Timeline can be accelerated with dedicated resources.`,
  },
  {
    patterns: [/industry/i, /benchmark/i, /compar/i, /peer/i, /sector/i],
    respond: ({ report }) => {
      const benchmark = getIndustryBenchmark(report.industry);
      if (benchmark) {
        const industryName = getIndustryName(report.industry);
        const orgAvg = report.dimensionScores.reduce((s, d) => s + d.weighted, 0) / report.dimensionScores.length;
        const percentile = estimatePercentile(orgAvg, benchmark);
        const aboveDims = report.dimensionScores.filter((d) => d.weighted > (benchmark[d.dimension] || 3.0));
        const belowDims = report.dimensionScores.filter((d) => d.weighted < (benchmark[d.dimension] || 3.0));
        return `**${report.orgName} vs. ${industryName} Industry Benchmarks**\n\nOverall estimated percentile: **${percentile}th**\n\n${aboveDims.length > 0 ? `✅ **Above average** in: ${aboveDims.map((d) => d.dimension).join(", ")}` : ""}\n${belowDims.length > 0 ? `⚠️ **Below average** in: ${belowDims.map((d) => d.dimension).join(", ")}` : ""}\n\nThe biggest opportunity for competitive differentiation lies in closing gaps where you're below the ${industryName} median.`;
      }
      return `In the ${report.industry} sector, the average AI maturity score is approximately 2.8-3.2. ${report.orgName}'s score of ${report.overallScore.toFixed(1)} places it ${report.overallScore > 3.0 ? "slightly above" : "near"} the industry median.`;
    },
  },
  {
    patterns: [/respondent/i, /participant/i, /employee/i, /people/i, /who/i],
    respond: ({ report }) =>
      `This assessment included **${report.respondentCount} respondents** across the organization. For detailed individual breakdowns, scores by respondent, and weighted contributions, check the **Internal Report** tab under "Respondent Breakdown."`,
  },
  {
    patterns: [/train/i, /syllabus/i, /course/i, /learn/i, /skill/i],
    respond: ({ report }) => {
      const w = weakest(report.dimensionScores);
      return `A proposed training syllabus is available in the Internal Report. It includes targeted modules for the weakest dimensions, starting with **${w.dimension}**. Each module includes video lessons, knowledge quizzes, and scenario simulations tailored to ${report.industry} use cases.`;
    },
  },
];

export function getAIChatResponse(message: string, report: ReportData): string {
  const ctx: ChatContext = { report };
  for (const intent of intents) {
    if (intent.patterns.some((p) => p.test(message))) {
      return intent.respond(ctx);
    }
  }
  return `Great question! Based on ${report.orgName}'s assessment data, I can help with:\n\n• **Strengths & weaknesses** — Ask "What's our weakest area?"\n• **Recommendations** — Ask "What should we focus on?"\n• **Gap analysis** — Ask "Show me the gaps"\n• **Industry benchmarks** — Ask "How do we compare?"\n• **Timeline & budget** — Ask about costs or schedule\n\nTry one of these, or ask me anything about the report!`;
}

// --- AI Question Generator ---
const aiQuestionTemplates: Record<string, Array<{ q: string; opts: string[] }>> = {
  Vision: [
    { q: "How effectively does your organization communicate its AI vision to all stakeholders?", opts: ["No communication of AI vision exists", "AI vision is mentioned informally but not documented", "AI vision is documented but inconsistently communicated", "AI vision is regularly communicated through formal channels", "AI vision is deeply embedded in all organizational communications and culture"] },
    { q: "To what extent does your AI strategy account for emerging technologies and market disruption?", opts: ["No consideration of future AI trends", "Minimal awareness of AI trends without action", "Some monitoring of AI trends with occasional strategy updates", "Systematic tracking of AI trends with regular strategy refinement", "Proactive AI trend analysis drives strategic pivots and innovation investments"] },
  ],
  Leadership: [
    { q: "How actively do senior leaders champion AI initiatives within the organization?", opts: ["Leaders show no interest in AI", "Leaders acknowledge AI but take no active role", "Some leaders occasionally sponsor AI projects", "Multiple leaders actively champion and fund AI initiatives", "C-suite treats AI as a core strategic pillar with personal accountability"] },
  ],
  "Skills & Literacy": [
    { q: "How would you rate the organization's investment in AI skills development programs?", opts: ["No AI training budget or programs exist", "Ad-hoc training with minimal investment", "Structured training exists but is optional and limited", "Comprehensive AI training with dedicated budget and role-specific tracks", "Industry-leading AI academy with continuous learning, certifications, and career paths"] },
  ],
  "Governance & Ethics": [
    { q: "How mature is your organization's framework for managing AI-related risks?", opts: ["No AI risk framework exists", "Basic awareness of AI risks without formal processes", "Informal risk assessment for major AI projects", "Formal AI risk framework with regular reviews and documentation", "Enterprise-grade AI risk management integrated into overall governance with automated monitoring"] },
  ],
  "Collaboration & Sharing": [
    { q: "How effectively do teams share AI learnings and best practices across departments?", opts: ["No cross-team AI knowledge sharing occurs", "Occasional informal sharing between individuals", "Some teams share learnings but no formal structure exists", "Regular cross-functional AI forums with documented best practices", "Organization-wide AI knowledge platform with active community and innovation challenges"] },
  ],
  "Technology & Data": [
    { q: "How well-integrated are your data systems to support AI-driven decision making?", opts: ["Data exists in isolated silos with no integration", "Basic data exports between some systems", "Partial data integration with manual processes", "Well-integrated data pipelines with automated ETL processes", "Unified real-time data platform with AI-ready infrastructure and self-service analytics"] },
  ],
};

export function generateAIQuestion(dimension: string): Question {
  const templates = aiQuestionTemplates[dimension] || aiQuestionTemplates["Vision"];
  const template = pick(templates);
  const labels = ["A", "B", "C", "D", "E"];
  return {
    id: 0,
    dimension,
    questionText: template.q,
    options: template.opts.map((text, i) => ({ score: i + 1, label: labels[i], text })),
  };
}

// --- AI Question Improver ---
const improvementPrefixes: Record<string, string[]> = {
  Vision: ["In your assessment,", "From a strategic perspective,", "Considering your organization's future direction,"],
  Leadership: ["Regarding executive engagement,", "In terms of leadership commitment,"],
  "Skills & Literacy": ["With respect to workforce capabilities,", "Regarding employee AI competencies,"],
  "Governance & Ethics": ["From a governance standpoint,", "Considering ethical and regulatory aspects,"],
  "Collaboration & Sharing": ["In terms of organizational collaboration,", "Regarding cross-functional knowledge exchange,"],
  "Technology & Data": ["From a technical infrastructure perspective,", "Regarding your data and technology stack,"],
};

export function improveQuestion(question: Question): Question {
  const prefixes = improvementPrefixes[question.dimension] || ["In your assessment,"];
  const prefix = pick(prefixes);
  const cleanedText = question.questionText.replace(/^(How|What|To what|Does|Is|Are)\s/i, (m) => m.toLowerCase());
  const improvedText = `${prefix} ${cleanedText}`;

  const improvedOptions = question.options.map((opt) => ({
    ...opt,
    text: opt.text
      .replace(/^No /i, "No formal ")
      .replace(/exists$/i, "has been established")
      .replace(/^Basic /i, "Elementary ")
      .replace(/^Some /i, "Limited "),
  }));

  return { ...question, questionText: improvedText, options: improvedOptions };
}

// --- Dashboard Insights Generator ---
export function generateDashboardInsights(orgs: Array<{ name: string; completedCount: number; registeredCount: number; status: string }>): string[] {
  const active = orgs.filter((o) => o.status === "active");
  const ready = active.filter((o) => o.completedCount > 0 && o.completedCount === o.registeredCount);
  const inProgress = active.filter((o) => o.completedCount > 0 && o.completedCount < o.registeredCount);

  return [
    `${ready.length} organization${ready.length !== 1 ? "s" : ""} ${ready.length !== 1 ? "have" : "has"} completed all assessments and ${ready.length !== 1 ? "are" : "is"} ready for evaluation`,
    `${inProgress.length} active assessment${inProgress.length !== 1 ? "s" : ""} in progress — ${inProgress.map((o) => `${o.name} (${Math.round((o.completedCount / o.registeredCount) * 100)}%)`).join(", ") || "none currently"}`,
    pick([
      "AI maturity benchmarks suggest focusing Q2 training budgets on Skills & Literacy for maximum ROI",
      "Organizations in Financial Services typically see 2.3x faster AI adoption after structured governance programs",
      "Cross-industry data shows Collaboration & Sharing as the #1 predictor of successful AI transformation",
      "Recommended: Schedule re-assessments for organizations evaluated more than 90 days ago",
    ]),
  ];
}

// --- Enhanced Narratives ---
export function generateEnhancedNarrative(dimension: string, score: number, orgName: string, industry: string): string {
  const stage = score <= 1.8 ? "nascent" : score <= 2.8 ? "developing" : score <= 3.8 ? "scaling" : score <= 4.5 ? "optimized" : "transforming";

  const narratives: Record<string, Record<string, string>> = {
    Vision: {
      nascent: `${orgName}'s AI vision remains undefined, which is common in early-stage ${industry} organizations. Without a clear strategic direction, AI investments risk being fragmented and reactive. The immediate priority should be convening senior leadership for a facilitated AI strategy workshop to establish a 3-year roadmap aligned with core business objectives.`,
      developing: `${orgName} has begun articulating an AI vision, but it remains loosely connected to business outcomes. In the ${industry} sector, competitors are rapidly formalizing their AI strategies. To move forward, the organization should map AI opportunities to specific revenue drivers and operational KPIs, ensuring every AI initiative has a measurable business case.`,
      scaling: `${orgName}'s AI vision is well-defined and gaining organizational traction. At a score of ${score.toFixed(1)}, the organization is ahead of many ${industry} peers. The next step is ensuring the vision cascades into departmental planning cycles with clear ownership, milestones, and accountability structures.`,
      optimized: `${orgName} demonstrates a mature and well-integrated AI vision that drives strategic decision-making. This ${score.toFixed(1)} score positions the organization as an AI leader in ${industry}. Focus should shift to innovation exploration, emerging technology evaluation, and thought leadership in the industry.`,
      transforming: `${orgName} has achieved a transformative level of AI vision integration. The organization serves as a benchmark for ${industry} peers and should consider publishing thought leadership, participating in industry standards bodies, and exploring AI-driven business model innovation.`,
    },
    Leadership: {
      nascent: `Leadership engagement with AI at ${orgName} is minimal. In ${industry}, organizations with disengaged leadership consistently underperform in AI adoption by 40-60%. The critical first step is executive education — leaders need to understand AI's strategic implications before they can champion transformation.`,
      developing: `Some leaders at ${orgName} are showing interest in AI, but sponsorship remains inconsistent. The ${industry} sector demands active C-suite involvement for successful AI programs. Establishing an AI steering committee with executive representation would provide the governance structure needed to accelerate progress.`,
      scaling: `Leadership at ${orgName} is actively engaged in AI initiatives, with a score of ${score.toFixed(1)} indicating solid executive buy-in. To reach the next level, leaders should take personal ownership of AI outcomes, include AI metrics in performance reviews, and allocate dedicated innovation budgets.`,
      optimized: `${orgName}'s leadership demonstrates exemplary AI championship. This level of executive engagement is a significant competitive advantage in ${industry} and should be leveraged to drive organization-wide culture change and attract AI talent.`,
      transforming: `Leadership at ${orgName} has fully embedded AI into their strategic DNA. This transformative approach sets the standard for ${industry} and positions the organization to shape industry-wide AI adoption patterns.`,
    },
  };

  const dimensionNarratives = narratives[dimension];
  if (dimensionNarratives && dimensionNarratives[stage]) {
    return dimensionNarratives[stage];
  }

  // Generic fallback with rich detail
  const fallbacks: Record<string, string> = {
    nascent: `${orgName}'s ${dimension} capability is at its earliest stage (${score.toFixed(1)}/5.0). This represents a significant gap that, if left unaddressed, could impede the organization's broader AI transformation goals. In ${industry}, foundational work in ${dimension} typically takes 3-6 months of focused effort. Immediate action is recommended: establish baseline processes, assign ownership, and set 90-day improvement targets.`,
    developing: `${dimension} at ${orgName} shows early signs of development (${score.toFixed(1)}/5.0) but lacks the structure needed for sustained progress. Compared to ${industry} benchmarks, there is clear room for improvement. The organization should formalize its approach to ${dimension}, create documented processes, and establish regular review cadences to ensure consistent advancement.`,
    scaling: `${orgName} is making solid progress in ${dimension} (${score.toFixed(1)}/5.0), with practices moving from ad-hoc to structured. This puts the organization in line with leading ${industry} players. The focus now should be on consistency across departments, measuring outcomes rather than activities, and building internal centers of excellence.`,
    optimized: `${dimension} is a relative strength for ${orgName} at ${score.toFixed(1)}/5.0. The organization has established mature processes that deliver consistent results. In the ${industry} context, this level of capability should be leveraged to drive competitive differentiation and influence industry standards.`,
    transforming: `${orgName} has achieved excellence in ${dimension} (${score.toFixed(1)}/5.0), operating at the highest maturity level. This capability should be shared as best practice across the organization and potentially with ${industry} partners and industry bodies.`,
  };

  return fallbacks[stage] || fallbacks.developing;
}
