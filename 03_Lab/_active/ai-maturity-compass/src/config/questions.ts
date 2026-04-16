import { Question } from "@/types";

export const QUESTIONS: Question[] = [
  // ═══════════════════════════════════════════
  // DIMENSION 1: Strategy & Vision
  // ═══════════════════════════════════════════
  {
    id: 1,
    dimension: "Strategy & Vision",
    questionText: "Does your organization have a clearly defined AI strategy or vision?",
    options: [
      { score: 1, label: "A", text: "No AI vision or strategy exists" },
      { score: 2, label: "B", text: "There is minimal awareness of AI, but no formal strategy" },
      { score: 3, label: "C", text: "An AI strategy is emerging but loosely tied to business goals" },
      { score: 4, label: "D", text: "AI strategy is clearly aligned with departmental goals" },
      { score: 5, label: "E", text: "AI vision is fully embedded in long-term strategic planning and KPIs" },
    ],
  },
  {
    id: 2,
    dimension: "Strategy & Vision",
    questionText: "How well is AI integrated into your organization's business planning?",
    options: [
      { score: 1, label: "A", text: "AI has no connection to business goals or planning" },
      { score: 2, label: "B", text: "Basic awareness exists but no structured AI goals are set" },
      { score: 3, label: "C", text: "Emerging AI goals with some organizational alignment" },
      { score: 4, label: "D", text: "AI clearly aligns with departmental objectives and planning cycles" },
      { score: 5, label: "E", text: "AI fully drives enterprise-wide strategic decisions and priorities" },
    ],
  },
  {
    id: 3,
    dimension: "Strategy & Vision",
    audience: "cxo",
    questionText: "What is your company's formal AI strategy?",
    options: [
      { score: 1, label: "A", text: "No formal AI strategy exists at any level" },
      { score: 2, label: "B", text: "AI is acknowledged but treated as an IT experiment" },
      { score: 3, label: "C", text: "AI strategy is documented but not consistently funded or executed" },
      { score: 4, label: "D", text: "AI strategy is board-approved with dedicated budget and milestones" },
      { score: 5, label: "E", text: "AI-first transformation is a core strategic pillar with executive ownership" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 2: Leadership & Culture
  // ═══════════════════════════════════════════
  {
    id: 4,
    dimension: "Leadership & Culture",
    questionText: "How engaged is leadership with AI initiatives?",
    options: [
      { score: 1, label: "A", text: "Leadership is uninterested or entirely unaware of AI" },
      { score: 2, label: "B", text: "Leaders are aware of AI but not actively engaged" },
      { score: 3, label: "C", text: "Leaders are supportive but reactive rather than proactive" },
      { score: 4, label: "D", text: "Leaders actively champion AI adoption across the organization" },
      { score: 5, label: "E", text: "Leaders invest resources and hold accountability for AI outcomes" },
    ],
  },
  {
    id: 5,
    dimension: "Leadership & Culture",
    questionText: "How would you describe your organization's cultural attitude toward AI experimentation?",
    options: [
      { score: 1, label: "A", text: "AI is feared or actively resisted by most people" },
      { score: 2, label: "B", text: "Cautious curiosity — people are aware but hesitant to try" },
      { score: 3, label: "C", text: "Pockets of enthusiasm exist, but no organization-wide encouragement" },
      { score: 4, label: "D", text: "Experimentation is encouraged with safe-to-fail environments" },
      { score: 5, label: "E", text: "Innovation culture is embedded — AI experiments are celebrated and scaled" },
    ],
  },
  {
    id: 6,
    dimension: "Leadership & Culture",
    audience: "cxo",
    questionText: "What is your company's philosophy regarding employees displaced by AI automation?",
    options: [
      { score: 1, label: "A", text: "No consideration has been given to workforce impact" },
      { score: 2, label: "B", text: "Displaced roles would be made redundant" },
      { score: 3, label: "C", text: "Some redeployment efforts exist but are ad-hoc" },
      { score: 4, label: "D", text: "Formal retraining programs are in place for affected employees" },
      { score: 5, label: "E", text: "Full reskilling programs with career pathways ensure no one is left behind" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 3: Current AI Usage (Deductive)
  // ═══════════════════════════════════════════
  {
    id: 7,
    dimension: "Current AI Usage",
    questionText: "What best describes your maximum use of AI currently?",
    options: [
      { score: 1, label: "A", text: "I don't use any AI tools" },
      { score: 2, label: "B", text: "Use ChatGPT or similar occasionally for questions or research" },
      { score: 3, label: "C", text: "Use AI for strategy planning, market research, or content creation" },
      { score: 4, label: "D", text: "Use AI to build reports, analyze data, or automate specific tasks" },
      { score: 5, label: "E", text: "Use AI to build agentic flows and self-annealing systems" },
    ],
  },
  {
    id: 8,
    dimension: "Current AI Usage",
    questionText: "How frequently do you use AI tools in your daily work?",
    options: [
      { score: 1, label: "A", text: "Never — I don't use AI tools at all" },
      { score: 2, label: "B", text: "Rarely — a few times per month at most" },
      { score: 3, label: "C", text: "Weekly — I use AI tools a few times per week" },
      { score: 4, label: "D", text: "Daily — AI tools are part of my regular workflow" },
      { score: 5, label: "E", text: "Multiple times daily — AI is integral to nearly everything I do" },
    ],
  },
  {
    id: 9,
    dimension: "Current AI Usage",
    questionText: "What types of AI outputs do you personally produce or consume?",
    options: [
      { score: 1, label: "A", text: "None — I don't generate or use AI-produced content" },
      { score: 2, label: "B", text: "Simple text responses — quick answers, email drafts, or summaries" },
      { score: 3, label: "C", text: "Structured outputs — reports, presentations, data analysis" },
      { score: 4, label: "D", text: "Complex workflows — multi-step AI pipelines, code generation, or integrations" },
      { score: 5, label: "E", text: "Automated systems — AI agents, continuous monitoring, or self-optimizing pipelines" },
    ],
  },
  {
    id: 25,
    dimension: "Current AI Usage",
    questionText: "Which AI tools does your organization have active licenses or approved access for?",
    options: [
      { score: 1, label: "A", text: "None — no AI tools are formally licensed or approved" },
      { score: 2, label: "B", text: "One or two general tools (e.g., ChatGPT Plus, Copilot) used informally" },
      { score: 3, label: "C", text: "Several tools across departments with some IT approval" },
      { score: 4, label: "D", text: "Enterprise AI licenses across multiple categories (productivity, dev, analytics)" },
      { score: 5, label: "E", text: "Full enterprise AI stack — productivity, coding, data, and domain-specific models — all governed and integrated" },
    ],
  },
  {
    id: 26,
    dimension: "Current AI Usage",
    questionText: "How does your organization capture and share successful AI use patterns?",
    options: [
      { score: 1, label: "A", text: "No capture or sharing of AI patterns exists" },
      { score: 2, label: "B", text: "Informal word-of-mouth between colleagues only" },
      { score: 3, label: "C", text: "Occasional team meetings or email threads sharing AI tips" },
      { score: 4, label: "D", text: "Internal wiki, prompt libraries, or playbooks are maintained and updated" },
      { score: 5, label: "E", text: "Formal knowledge base with case studies, reusable prompt templates, and cross-team learning sessions" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 4: Skills & Talent (4 questions)
  // ═══════════════════════════════════════════
  {
    id: 10,
    dimension: "Skills & Talent",
    questionText: "What is the overall level of AI knowledge or literacy in your area?",
    options: [
      { score: 1, label: "A", text: "No AI knowledge, skills, or training exists anywhere" },
      { score: 2, label: "B", text: "A few individuals are exploring AI tools independently" },
      { score: 3, label: "C", text: "Some staff have been trained; knowledge is uneven across teams" },
      { score: 4, label: "D", text: "Most staff are trained; skills development is ongoing and structured" },
      { score: 5, label: "E", text: "AI literacy is high across the organization; continuous learning is embedded in culture" },
    ],
  },
  {
    id: 11,
    dimension: "Skills & Talent",
    questionText: "Does your organization have a formal AI training or upskilling program?",
    options: [
      { score: 1, label: "A", text: "No AI training exists" },
      { score: 2, label: "B", text: "Individuals self-learn with no organizational support" },
      { score: 3, label: "C", text: "Ad-hoc workshops or courses are offered occasionally" },
      { score: 4, label: "D", text: "Structured training programs exist with role-specific AI curricula" },
      { score: 5, label: "E", text: "Comprehensive AI academy with certifications, mentoring, and continuous development" },
    ],
  },
  {
    id: 12,
    dimension: "Skills & Talent",
    questionText: "How does your organization approach AI talent acquisition?",
    options: [
      { score: 1, label: "A", text: "No AI-specific hiring or talent strategy exists" },
      { score: 2, label: "B", text: "Occasional hiring of AI-skilled individuals, but not systematic" },
      { score: 3, label: "C", text: "Some roles include AI skills as a requirement" },
      { score: 4, label: "D", text: "Dedicated AI roles and career paths exist across departments" },
      { score: 5, label: "E", text: "AI talent pipeline is a strategic priority with partnerships, internships, and internal mobility" },
    ],
  },
  {
    id: 27,
    dimension: "Skills & Talent",
    questionText: "Do individuals have role-specific AI skill targets and are they measured against them?",
    options: [
      { score: 1, label: "A", text: "No targets — AI skills are not measured or expected for any role" },
      { score: 2, label: "B", text: "Vague expectations exist but nothing is formally tracked" },
      { score: 3, label: "C", text: "Some teams have informal AI skill expectations" },
      { score: 4, label: "D", text: "Role-specific AI competency frameworks exist with semi-annual reviews" },
      { score: 5, label: "E", text: "Every role has defined AI skill targets measured quarterly with certification requirements and clear progression paths" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 5: Data & Infrastructure
  // ═══════════════════════════════════════════
  {
    id: 13,
    dimension: "Data & Infrastructure",
    questionText: "How accessible and organized are your data sources for AI applications?",
    options: [
      { score: 1, label: "A", text: "No access to relevant or structured data exists" },
      { score: 2, label: "B", text: "Data is scattered across silos with no consistent format" },
      { score: 3, label: "C", text: "Data is available for specific projects but not standardized" },
      { score: 4, label: "D", text: "Data is accessible across functions with consistent quality standards" },
      { score: 5, label: "E", text: "Fully integrated data pipelines with clean, governed, and easily accessible data" },
    ],
  },
  {
    id: 14,
    dimension: "Data & Infrastructure",
    questionText: "What best describes your AI technology infrastructure?",
    options: [
      { score: 1, label: "A", text: "No AI tools or relevant technology infrastructure exists" },
      { score: 2, label: "B", text: "Basic tools are used informally with no integration" },
      { score: 3, label: "C", text: "Scalable tools and platforms exist for specific use cases" },
      { score: 4, label: "D", text: "Integrated tools across functions; optimized for enterprise use" },
      { score: 5, label: "E", text: "Fully integrated AI systems with robust, automated pipelines and MLOps" },
    ],
  },
  {
    id: 15,
    dimension: "Data & Infrastructure",
    questionText: "How does your organization handle data governance for AI workloads?",
    options: [
      { score: 1, label: "A", text: "No data governance exists for any purpose" },
      { score: 2, label: "B", text: "Basic data management exists but not AI-specific" },
      { score: 3, label: "C", text: "Data governance policies are emerging with some AI considerations" },
      { score: 4, label: "D", text: "Strong data governance with AI-specific quality, bias, and privacy controls" },
      { score: 5, label: "E", text: "Enterprise-wide data governance with automated monitoring, lineage tracking, and compliance" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 6: Governance & Ethics
  // ═══════════════════════════════════════════
  {
    id: 16,
    dimension: "Governance & Ethics",
    questionText: "Does your organization have formal AI governance guidelines?",
    options: [
      { score: 1, label: "A", text: "No AI guidelines, policies, or oversight exist" },
      { score: 2, label: "B", text: "Awareness of AI risks exists but no formal action has been taken" },
      { score: 3, label: "C", text: "Draft AI policies are in place; enforcement is inconsistent" },
      { score: 4, label: "D", text: "Clear policies and ethical review processes exist for most AI use" },
      { score: 5, label: "E", text: "Robust, enforced governance and ethics framework across all AI projects" },
    ],
  },
  {
    id: 17,
    dimension: "Governance & Ethics",
    questionText: "How does your organization manage ethical risks related to AI?",
    options: [
      { score: 1, label: "A", text: "No ethical considerations are applied to AI use" },
      { score: 2, label: "B", text: "Basic risk awareness exists but no formal processes" },
      { score: 3, label: "C", text: "Cross-functional ethical reviews are beginning to take place" },
      { score: 4, label: "D", text: "Proactive ethical policy enforcement is standard practice" },
      { score: 5, label: "E", text: "Fully integrated ethical AI governance embedded in all decisions" },
    ],
  },
  {
    id: 18,
    dimension: "Governance & Ethics",
    questionText: "How does your organization address AI bias and fairness?",
    options: [
      { score: 1, label: "A", text: "AI bias is not considered or understood" },
      { score: 2, label: "B", text: "There is awareness of bias but no active mitigation" },
      { score: 3, label: "C", text: "Some bias testing is performed on key AI systems" },
      { score: 4, label: "D", text: "Systematic bias auditing with corrective actions across AI projects" },
      { score: 5, label: "E", text: "Continuous fairness monitoring with transparent reporting and external audits" },
    ],
  },
  {
    id: 28,
    dimension: "Governance & Ethics",
    questionText: "Does your organization have an AI Acceptable Use Policy that employees have acknowledged?",
    options: [
      { score: 1, label: "A", text: "No — we have no AI-specific acceptable use guidelines" },
      { score: 2, label: "B", text: "We rely on general IT policies that don't specifically address AI" },
      { score: 3, label: "C", text: "A draft AI AUP exists but has not been formally communicated or signed off" },
      { score: 4, label: "D", text: "A formal AI AUP exists and most employees have been made aware of it" },
      { score: 5, label: "E", text: "A comprehensive AI AUP is in effect, all employees have acknowledged it, and compliance is tracked" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 7: Process & Integration
  // ═══════════════════════════════════════════
  {
    id: 19,
    dimension: "Process & Integration",
    questionText: "How are AI tools integrated into your team's daily workflows?",
    options: [
      { score: 1, label: "A", text: "AI is not used in any workflows" },
      { score: 2, label: "B", text: "AI is used informally by individuals for isolated tasks" },
      { score: 3, label: "C", text: "AI is embedded in some processes for specific teams or departments" },
      { score: 4, label: "D", text: "AI is a standard component of most business processes" },
      { score: 5, label: "E", text: "AI is deeply embedded and drives continuous process optimization organization-wide" },
    ],
  },
  {
    id: 20,
    dimension: "Process & Integration",
    questionText: "What percentage of your core business processes have an AI component?",
    options: [
      { score: 1, label: "A", text: "0% — No processes involve AI" },
      { score: 2, label: "B", text: "1–10% — AI is involved in a few minor processes" },
      { score: 3, label: "C", text: "11–25% — AI supports a growing number of key processes" },
      { score: 4, label: "D", text: "26–50% — AI is integrated into many critical processes" },
      { score: 5, label: "E", text: "50%+ — AI is integral to the majority of business operations" },
    ],
  },
  {
    id: 21,
    dimension: "Process & Integration",
    questionText: "How does your organization handle AI project prioritization and portfolio management?",
    options: [
      { score: 1, label: "A", text: "No AI projects exist" },
      { score: 2, label: "B", text: "Ad-hoc AI experiments with no formal prioritization" },
      { score: 3, label: "C", text: "Some AI projects are tracked but prioritization is inconsistent" },
      { score: 4, label: "D", text: "Structured AI portfolio with clear criteria for prioritization and ROI tracking" },
      { score: 5, label: "E", text: "Enterprise AI portfolio management with automated impact assessment and continuous reprioritization" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 8: Innovation & Scaling
  // ═══════════════════════════════════════════
  {
    id: 22,
    dimension: "Innovation & Scaling",
    questionText: "How does your organization approach AI experimentation and pilots?",
    options: [
      { score: 1, label: "A", text: "No AI experimentation occurs" },
      { score: 2, label: "B", text: "Occasional unstructured experiments by curious individuals" },
      { score: 3, label: "C", text: "Formal pilot programs exist but scaling from pilot to production is rare" },
      { score: 4, label: "D", text: "Systematic experiment-to-production pipeline with clear success criteria" },
      { score: 5, label: "E", text: "Rapid AI innovation cycles with automated scaling, A/B testing, and continuous improvement" },
    ],
  },
  {
    id: 23,
    dimension: "Innovation & Scaling",
    questionText: "How do teams collaborate and share knowledge on AI projects?",
    options: [
      { score: 1, label: "A", text: "Work is siloed; no AI knowledge sharing exists" },
      { score: 2, label: "B", text: "Informal sharing between individuals only" },
      { score: 3, label: "C", text: "Some cross-team collaboration on AI projects" },
      { score: 4, label: "D", text: "Active sharing of results and learnings with communities of practice" },
      { score: 5, label: "E", text: "Strong culture of collaboration with AI centers of excellence and cross-department learning" },
    ],
  },
  {
    id: 24,
    dimension: "Innovation & Scaling",
    questionText: "How effectively does your organization scale successful AI pilots into production?",
    options: [
      { score: 1, label: "A", text: "No AI projects have moved beyond concept stage" },
      { score: 2, label: "B", text: "A few pilots exist but none have been scaled" },
      { score: 3, label: "C", text: "Some pilots have been scaled but the process is slow and inconsistent" },
      { score: 4, label: "D", text: "Most successful pilots are scaled with defined playbooks and timelines" },
      { score: 5, label: "E", text: "Rapid, repeatable scaling with automated deployment, monitoring, and optimization" },
    ],
  },


  // ═══════════════════════════════════════════
  // DIMENSION 9: Individual AI Proficiency
  // ═══════════════════════════════════════════
  {
    id: 29,
    dimension: "Individual AI Proficiency",
    questionText: "Which best describes how you currently use AI tools in your work?",
    options: [
      { score: 1, label: "A", text: "I have never used an AI tool" },
      { score: 2, label: "B", text: "I use AI as a chat assistant for basic questions and drafts" },
      { score: 3, label: "C", text: "I use AI to produce work artifacts: reports, analysis, presentations, code" },
      { score: 4, label: "D", text: "I use AI in structured workflows — automations, integrations, or pipelines" },
      { score: 5, label: "E", text: "I build and coordinate AI agentic systems that run autonomously for business tasks" },
    ],
  },
  {
    id: 30,
    dimension: "Individual AI Proficiency",
    questionText: "How would you rate your prompt engineering ability?",
    options: [
      { score: 1, label: "A", text: "I don't know what prompt engineering is" },
      { score: 2, label: "B", text: "I ask basic questions and accept whatever the AI gives me" },
      { score: 3, label: "C", text: "I structure my prompts with context, role, and format instructions" },
      { score: 4, label: "D", text: "I use multi-step prompting, few-shot examples, and chain-of-thought techniques" },
      { score: 5, label: "E", text: "I design advanced prompt architectures including tool use, system prompts, and agentic chains" },
    ],
  },
  {
    id: 31,
    dimension: "Individual AI Proficiency",
    questionText: "Have you built or configured an AI-powered workflow or automation?",
    options: [
      { score: 1, label: "A", text: "No — I have never built anything with AI" },
      { score: 2, label: "B", text: "I've experimented with simple AI features in apps (e.g., Copilot in Word)" },
      { score: 3, label: "C", text: "Yes — I've set up a workflow using AI tools (e.g., Zapier + AI, n8n, Make)" },
      { score: 4, label: "D", text: "Yes — I've built multi-step pipelines that use AI for automated decision-making" },
      { score: 5, label: "E", text: "Yes — production-grade agentic systems that operate autonomously with monitoring and error handling" },
    ],
  },
  {
    id: 32,
    dimension: "Individual AI Proficiency",
    questionText: "How do you validate AI outputs before acting on or sharing them?",
    options: [
      { score: 1, label: "A", text: "I accept AI outputs as-is without checking" },
      { score: 2, label: "B", text: "I do a quick read-through to check if it looks reasonable" },
      { score: 3, label: "C", text: "I verify key facts and check for obvious errors before using" },
      { score: 4, label: "D", text: "I apply a structured review: fact-check, bias scan, and relevance validation" },
      { score: 5, label: "E", text: "I use systematic testing protocols including red-teaming, adversarial prompting, and factual verification pipelines" },
    ],
  },
  {
    id: 33,
    dimension: "Individual AI Proficiency",
    questionText: "How do you stay current with AI developments relevant to your role?",
    options: [
      { score: 1, label: "A", text: "I don't actively follow AI developments" },
      { score: 2, label: "B", text: "I occasionally read news articles when they appear in my feed" },
      { score: 3, label: "C", text: "I follow AI newsletters, podcasts, or LinkedIn communities relevant to my field" },
      { score: 4, label: "D", text: "I take structured courses, attend webinars, and apply new techniques within weeks of learning" },
      { score: 5, label: "E", text: "I contribute to the AI community — writing, speaking, or mentoring — while maintaining a personal R&D practice" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 10: Use Case Clarity
  // ═══════════════════════════════════════════
  {
    id: 34,
    dimension: "Use Case Clarity",
    questionText: "Has your organization identified specific, high-value AI use cases tied to business outcomes?",
    options: [
      { score: 1, label: "A", text: "No — we have not identified any specific AI use cases" },
      { score: 2, label: "B", text: "We've had general discussions but nothing is documented or prioritized" },
      { score: 3, label: "C", text: "A few use cases have been identified informally in specific teams" },
      { score: 4, label: "D", text: "We have a documented list of prioritized AI use cases with business case justifications" },
      { score: 5, label: "E", text: "A comprehensive, board-level AI use case portfolio exists with measurable outcomes, owners, and quarterly reviews" },
    ],
  },
  {
    id: 35,
    dimension: "Use Case Clarity",
    audience: "manager",
    questionText: "Have you validated feasibility, data availability, and ROI for your top AI use cases?",
    options: [
      { score: 1, label: "A", text: "No validation has been done" },
      { score: 2, label: "B", text: "We've discussed feasibility informally but not tested or quantified" },
      { score: 3, label: "C", text: "Basic feasibility checks have been done for some use cases" },
      { score: 4, label: "D", text: "Most top use cases have been validated for data availability, technical feasibility, and estimated ROI" },
      { score: 5, label: "E", text: "All use cases go through a rigorous validation gate: data audit, build-vs-buy, risk assessment, and modeled ROI before approval" },
    ],
  },
  {
    id: 36,
    dimension: "Use Case Clarity",
    audience: "manager",
    questionText: "Do you have a prioritized AI use case pipeline with assigned owners and timelines?",
    options: [
      { score: 1, label: "A", text: "No — we don't have a use case pipeline or ownership model" },
      { score: 2, label: "B", text: "Some ideas exist but no formal ownership or timeline" },
      { score: 3, label: "C", text: "A few use cases have informal owners and rough timelines" },
      { score: 4, label: "D", text: "A prioritized pipeline exists with clear owners, milestones, and success metrics" },
      { score: 5, label: "E", text: "A governed AI use case pipeline is actively managed — prioritized by ROI, assigned with accountable owners, and reviewed monthly" },
    ],
  },

  // ═══════════════════════════════════════════
  // DIMENSION 11: Financial & Vendor Readiness
  // ═══════════════════════════════════════════
  {
    id: 37,
    dimension: "Financial & Vendor Readiness",
    audience: "cxo",
    questionText: "Does your organization have a dedicated, approved budget for AI initiatives in the next 12 months?",
    options: [
      { score: 1, label: "A", text: "No — there is no budget allocated to AI" },
      { score: 2, label: "B", text: "AI costs are absorbed informally from existing team budgets" },
      { score: 3, label: "C", text: "A small discretionary AI budget exists but is not formally approved" },
      { score: 4, label: "D", text: "A dedicated AI budget line is approved for the current fiscal year" },
      { score: 5, label: "E", text: "Multi-year AI investment budget is board-approved with phased allocation tied to outcomes" },
    ],
  },
  {
    id: 38,
    dimension: "Financial & Vendor Readiness",
    audience: "cxo",
    questionText: "Have you established clear success metrics and ROI expectations for AI investments?",
    options: [
      { score: 1, label: "A", text: "No — AI investments have no defined success criteria" },
      { score: 2, label: "B", text: "We expect AI to help but haven't defined specific metrics" },
      { score: 3, label: "C", text: "Rough success criteria exist for some AI initiatives" },
      { score: 4, label: "D", text: "KPIs and ROI targets are defined for all major AI investments with regular tracking" },
      { score: 5, label: "E", text: "Every AI initiative has quantified ROI expectations, monthly performance reviews, and a kill/scale decision framework" },
    ],
  },
  {
    id: 39,
    dimension: "Financial & Vendor Readiness",
    audience: "cxo",
    questionText: "Does your organization have the procurement capability, vendor evaluation framework, and governance to engage and manage AI vendors?",
    options: [
      { score: 1, label: "A", text: "No — we have no AI vendor management capability" },
      { score: 2, label: "B", text: "We buy tools ad-hoc without formal evaluation or governance" },
      { score: 3, label: "C", text: "Basic procurement exists; some security and privacy checks are done" },
      { score: 4, label: "D", text: "A vendor evaluation framework covers technical fit, data security, and contract terms" },
      { score: 5, label: "E", text: "Enterprise AI vendor governance: tiered approval, data processing agreements, performance SLAs, exit clauses, and continuous risk review" },
    ],
  },
];

export const DIMENSIONS = [
  "Strategy & Vision",
  "Leadership & Culture",
  "Current AI Usage",
  "Skills & Talent",
  "Data & Infrastructure",
  "Governance & Ethics",
  "Process & Integration",
  "Innovation & Scaling",
  "Individual AI Proficiency",
  "Use Case Clarity",
  "Financial & Vendor Readiness",
] as const;
