-- ============================================================
-- AI Maturity Compass — Question Seed Data
-- Run AFTER schema.sql
-- Run via: Supabase Studio SQL Editor
-- ============================================================

-- Clear existing (idempotent re-run)
TRUNCATE question_options, questions RESTART IDENTITY CASCADE;

-- ============================================================
-- DIMENSION 1: Strategy & Vision
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(1, 'Strategy & Vision', 'Does your organization have a clearly defined AI strategy or vision?', 'all', 1),
(2, 'Strategy & Vision', 'How well is AI integrated into your organization''s business planning?', 'all', 2),
(3, 'Strategy & Vision', 'What is your company''s formal AI strategy?', 'cxo', 3);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(1, 1, 'A', 'No AI vision or strategy exists'),
(1, 2, 'B', 'There is minimal awareness of AI, but no formal strategy'),
(1, 3, 'C', 'An AI strategy is emerging but loosely tied to business goals'),
(1, 4, 'D', 'AI strategy is clearly aligned with departmental goals'),
(1, 5, 'E', 'AI vision is fully embedded in long-term strategic planning and KPIs'),

(2, 1, 'A', 'AI has no connection to business goals or planning'),
(2, 2, 'B', 'Basic awareness exists but no structured AI goals are set'),
(2, 3, 'C', 'Emerging AI goals with some organizational alignment'),
(2, 4, 'D', 'AI clearly aligns with departmental objectives and planning cycles'),
(2, 5, 'E', 'AI fully drives enterprise-wide strategic decisions and priorities'),

(3, 1, 'A', 'No formal AI strategy exists at any level'),
(3, 2, 'B', 'AI is acknowledged but treated as an IT experiment'),
(3, 3, 'C', 'AI strategy is documented but not consistently funded or executed'),
(3, 4, 'D', 'AI strategy is board-approved with dedicated budget and milestones'),
(3, 5, 'E', 'AI-first transformation is a core strategic pillar with executive ownership');

-- ============================================================
-- DIMENSION 2: Leadership & Culture
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(4, 'Leadership & Culture', 'How engaged is leadership with AI initiatives?', 'all', 4),
(5, 'Leadership & Culture', 'How would you describe your organization''s cultural attitude toward AI experimentation?', 'all', 5),
(6, 'Leadership & Culture', 'What is your company''s philosophy regarding employees displaced by AI automation?', 'cxo', 6);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(4, 1, 'A', 'Leadership is uninterested or entirely unaware of AI'),
(4, 2, 'B', 'Leaders are aware of AI but not actively engaged'),
(4, 3, 'C', 'Leaders are supportive but reactive rather than proactive'),
(4, 4, 'D', 'Leaders actively champion AI adoption across the organization'),
(4, 5, 'E', 'Leaders invest resources and hold accountability for AI outcomes'),

(5, 1, 'A', 'AI is feared or actively resisted by most people'),
(5, 2, 'B', 'Cautious curiosity — people are aware but hesitant to try'),
(5, 3, 'C', 'Pockets of enthusiasm exist, but no organization-wide encouragement'),
(5, 4, 'D', 'Experimentation is encouraged with safe-to-fail environments'),
(5, 5, 'E', 'Innovation culture is embedded — AI experiments are celebrated and scaled'),

(6, 1, 'A', 'No consideration has been given to workforce impact'),
(6, 2, 'B', 'Displaced roles would be made redundant'),
(6, 3, 'C', 'Some redeployment efforts exist but are ad-hoc'),
(6, 4, 'D', 'Formal retraining programs are in place for affected employees'),
(6, 5, 'E', 'Full reskilling programs with career pathways ensure no one is left behind');

-- ============================================================
-- DIMENSION 3: Current AI Usage
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(7, 'Current AI Usage', 'What best describes your maximum use of AI currently?', 'all', 7),
(8, 'Current AI Usage', 'How frequently do you use AI tools in your daily work?', 'all', 8),
(9, 'Current AI Usage', 'What types of AI outputs do you personally produce or consume?', 'all', 9);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(7, 1, 'A', 'I don''t use any AI tools'),
(7, 2, 'B', 'Use ChatGPT or similar occasionally for questions or research'),
(7, 3, 'C', 'Use AI for strategy planning, market research, or content creation'),
(7, 4, 'D', 'Use AI to build reports, analyze data, or automate specific tasks'),
(7, 5, 'E', 'Use AI to build agentic flows and self-annealing systems'),

(8, 1, 'A', 'Never — I don''t use AI tools at all'),
(8, 2, 'B', 'Rarely — a few times per month at most'),
(8, 3, 'C', 'Weekly — I use AI tools a few times per week'),
(8, 4, 'D', 'Daily — AI tools are part of my regular workflow'),
(8, 5, 'E', 'Multiple times daily — AI is integral to nearly everything I do'),

(9, 1, 'A', 'None — I don''t generate or use AI-produced content'),
(9, 2, 'B', 'Simple text responses — quick answers, email drafts, or summaries'),
(9, 3, 'C', 'Structured outputs — reports, presentations, data analysis'),
(9, 4, 'D', 'Complex workflows — multi-step AI pipelines, code generation, or integrations'),
(9, 5, 'E', 'Automated systems — AI agents, continuous monitoring, or self-optimizing pipelines');

-- ============================================================
-- DIMENSION 4: Skills & Talent
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(10, 'Skills & Talent', 'What is the overall level of AI knowledge or literacy in your area?', 'all', 10),
(11, 'Skills & Talent', 'Does your organization have a formal AI training or upskilling program?', 'all', 11),
(12, 'Skills & Talent', 'How does your organization approach AI talent acquisition?', 'all', 12);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(10, 1, 'A', 'No AI knowledge, skills, or training exists anywhere'),
(10, 2, 'B', 'A few individuals are exploring AI tools independently'),
(10, 3, 'C', 'Some staff have been trained; knowledge is uneven across teams'),
(10, 4, 'D', 'Most staff are trained; skills development is ongoing and structured'),
(10, 5, 'E', 'AI literacy is high across the organization; continuous learning is embedded in culture'),

(11, 1, 'A', 'No AI training exists'),
(11, 2, 'B', 'Individuals self-learn with no organizational support'),
(11, 3, 'C', 'Ad-hoc workshops or courses are offered occasionally'),
(11, 4, 'D', 'Structured training programs exist with role-specific AI curricula'),
(11, 5, 'E', 'Comprehensive AI academy with certifications, mentoring, and continuous development'),

(12, 1, 'A', 'No AI-specific hiring or talent strategy exists'),
(12, 2, 'B', 'Occasional hiring of AI-skilled individuals, but not systematic'),
(12, 3, 'C', 'Some roles include AI skills as a requirement'),
(12, 4, 'D', 'Dedicated AI roles and career paths exist across departments'),
(12, 5, 'E', 'AI talent pipeline is a strategic priority with partnerships, internships, and internal mobility');

-- ============================================================
-- DIMENSION 5: Data & Infrastructure
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(13, 'Data & Infrastructure', 'How accessible and organized are your data sources for AI applications?', 'all', 13),
(14, 'Data & Infrastructure', 'What best describes your AI technology infrastructure?', 'all', 14),
(15, 'Data & Infrastructure', 'How does your organization handle data governance for AI workloads?', 'all', 15);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(13, 1, 'A', 'No access to relevant or structured data exists'),
(13, 2, 'B', 'Data is scattered across silos with no consistent format'),
(13, 3, 'C', 'Data is available for specific projects but not standardized'),
(13, 4, 'D', 'Data is accessible across functions with consistent quality standards'),
(13, 5, 'E', 'Fully integrated data pipelines with clean, governed, and easily accessible data'),

(14, 1, 'A', 'No AI tools or relevant technology infrastructure exists'),
(14, 2, 'B', 'Basic tools are used informally with no integration'),
(14, 3, 'C', 'Scalable tools and platforms exist for specific use cases'),
(14, 4, 'D', 'Integrated tools across functions; optimized for enterprise use'),
(14, 5, 'E', 'Fully integrated AI systems with robust, automated pipelines and MLOps'),

(15, 1, 'A', 'No data governance exists for any purpose'),
(15, 2, 'B', 'Basic data management exists but not AI-specific'),
(15, 3, 'C', 'Data governance policies are emerging with some AI considerations'),
(15, 4, 'D', 'Strong data governance with AI-specific quality, bias, and privacy controls'),
(15, 5, 'E', 'Enterprise-wide data governance with automated monitoring, lineage tracking, and compliance');

-- ============================================================
-- DIMENSION 6: Governance & Ethics
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(16, 'Governance & Ethics', 'Does your organization have formal AI governance guidelines?', 'all', 16),
(17, 'Governance & Ethics', 'How does your organization manage ethical risks related to AI?', 'all', 17),
(18, 'Governance & Ethics', 'How does your organization address AI bias and fairness?', 'all', 18);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(16, 1, 'A', 'No AI guidelines, policies, or oversight exist'),
(16, 2, 'B', 'Awareness of AI risks exists but no formal action has been taken'),
(16, 3, 'C', 'Draft AI policies are in place; enforcement is inconsistent'),
(16, 4, 'D', 'Clear policies and ethical review processes exist for most AI use'),
(16, 5, 'E', 'Robust, enforced governance and ethics framework across all AI projects'),

(17, 1, 'A', 'No ethical considerations are applied to AI use'),
(17, 2, 'B', 'Basic risk awareness exists but no formal processes'),
(17, 3, 'C', 'Cross-functional ethical reviews are beginning to take place'),
(17, 4, 'D', 'Proactive ethical policy enforcement is standard practice'),
(17, 5, 'E', 'Fully integrated ethical AI governance embedded in all decisions'),

(18, 1, 'A', 'AI bias is not considered or understood'),
(18, 2, 'B', 'There is awareness of bias but no active mitigation'),
(18, 3, 'C', 'Some bias testing is performed on key AI systems'),
(18, 4, 'D', 'Systematic bias auditing with corrective actions across AI projects'),
(18, 5, 'E', 'Continuous fairness monitoring with transparent reporting and external audits');

-- ============================================================
-- DIMENSION 7: Process & Integration
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(19, 'Process & Integration', 'How are AI tools integrated into your team''s daily workflows?', 'all', 19),
(20, 'Process & Integration', 'What percentage of your core business processes have an AI component?', 'all', 20),
(21, 'Process & Integration', 'How does your organization handle AI project prioritization and portfolio management?', 'all', 21);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(19, 1, 'A', 'AI is not used in any workflows'),
(19, 2, 'B', 'AI is used informally by individuals for isolated tasks'),
(19, 3, 'C', 'AI is embedded in some processes for specific teams or departments'),
(19, 4, 'D', 'AI is a standard component of most business processes'),
(19, 5, 'E', 'AI is deeply embedded and drives continuous process optimization organization-wide'),

(20, 1, 'A', '0% — No processes involve AI'),
(20, 2, 'B', '1–10% — AI is involved in a few minor processes'),
(20, 3, 'C', '11–25% — AI supports a growing number of key processes'),
(20, 4, 'D', '26–50% — AI is integrated into many critical processes'),
(20, 5, 'E', '50%+ — AI is integral to the majority of business operations'),

(21, 1, 'A', 'No AI projects exist'),
(21, 2, 'B', 'Ad-hoc AI experiments with no formal prioritization'),
(21, 3, 'C', 'Some AI projects are tracked but prioritization is inconsistent'),
(21, 4, 'D', 'Structured AI portfolio with clear criteria for prioritization and ROI tracking'),
(21, 5, 'E', 'Enterprise AI portfolio management with automated impact assessment and continuous reprioritization');

-- ============================================================
-- DIMENSION 8: Innovation & Scaling
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(22, 'Innovation & Scaling', 'How does your organization approach AI experimentation and pilots?', 'all', 22),
(23, 'Innovation & Scaling', 'How do teams collaborate and share knowledge on AI projects?', 'all', 23),
(24, 'Innovation & Scaling', 'How effectively does your organization scale successful AI pilots into production?', 'all', 24);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(22, 1, 'A', 'No AI experimentation occurs'),
(22, 2, 'B', 'Occasional unstructured experiments by curious individuals'),
(22, 3, 'C', 'Formal pilot programs exist but scaling from pilot to production is rare'),
(22, 4, 'D', 'Systematic experiment-to-production pipeline with clear success criteria'),
(22, 5, 'E', 'Rapid AI innovation cycles with automated scaling, A/B testing, and continuous improvement'),

(23, 1, 'A', 'Work is siloed; no AI knowledge sharing exists'),
(23, 2, 'B', 'Informal sharing between individuals only'),
(23, 3, 'C', 'Some cross-team collaboration on AI projects'),
(23, 4, 'D', 'Active sharing of results and learnings with communities of practice'),
(23, 5, 'E', 'Strong culture of collaboration with AI centers of excellence and cross-department learning'),

(24, 1, 'A', 'No AI projects have moved beyond concept stage'),
(24, 2, 'B', 'A few pilots exist but none have been scaled'),
(24, 3, 'C', 'Some pilots have been scaled but the process is slow and inconsistent'),
(24, 4, 'D', 'Most successful pilots are scaled with defined playbooks and timelines'),
(24, 5, 'E', 'Rapid, repeatable scaling with automated deployment, monitoring, and optimization');

-- ============================================================
-- DIMENSION 3 ADDITIONS: Current AI Usage (Q25, Q26)
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(25, 'Current AI Usage', 'Which AI tools does your organization have active licenses or approved access for?', 'all', 25),
(26, 'Current AI Usage', 'How does your organization capture and share successful AI use patterns?', 'all', 26);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(25, 1, 'A', 'None — no AI tools are formally licensed or approved'),
(25, 2, 'B', 'One or two general tools (e.g., ChatGPT Plus, Copilot) used informally'),
(25, 3, 'C', 'Several tools across departments with some IT approval'),
(25, 4, 'D', 'Enterprise AI licenses across multiple categories (productivity, dev, analytics)'),
(25, 5, 'E', 'Full enterprise AI stack — productivity, coding, data, and domain-specific models — all governed and integrated'),

(26, 1, 'A', 'No capture or sharing of AI patterns exists'),
(26, 2, 'B', 'Informal word-of-mouth between colleagues only'),
(26, 3, 'C', 'Occasional team meetings or email threads sharing AI tips'),
(26, 4, 'D', 'Internal wiki, prompt libraries, or playbooks are maintained and updated'),
(26, 5, 'E', 'Formal knowledge base with case studies, reusable prompt templates, and cross-team learning sessions');

-- ============================================================
-- DIMENSION 4 ADDITION: Skills & Talent (Q27)
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(27, 'Skills & Talent', 'Do individuals have role-specific AI skill targets and are they measured against them?', 'all', 27);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(27, 1, 'A', 'No targets — AI skills are not measured or expected for any role'),
(27, 2, 'B', 'Vague expectations exist but nothing is formally tracked'),
(27, 3, 'C', 'Some teams have informal AI skill expectations'),
(27, 4, 'D', 'Role-specific AI competency frameworks exist with semi-annual reviews'),
(27, 5, 'E', 'Every role has defined AI skill targets measured quarterly with certification requirements and clear progression paths');

-- ============================================================
-- DIMENSION 6 ADDITION: Governance & Ethics (Q28)
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(28, 'Governance & Ethics', 'Does your organization have an AI Acceptable Use Policy that employees have acknowledged?', 'all', 28);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(28, 1, 'A', 'No — we have no AI-specific acceptable use guidelines'),
(28, 2, 'B', 'We rely on general IT policies that don''t specifically address AI'),
(28, 3, 'C', 'A draft AI AUP exists but has not been formally communicated or signed off'),
(28, 4, 'D', 'A formal AI AUP exists and most employees have been made aware of it'),
(28, 5, 'E', 'A comprehensive AI AUP is in effect, all employees have acknowledged it, and compliance is tracked');

-- ============================================================
-- DIMENSION 9: Individual AI Proficiency (Q29-Q33)
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(29, 'Individual AI Proficiency', 'Which best describes how you currently use AI tools in your work?', 'all', 29),
(30, 'Individual AI Proficiency', 'How would you rate your prompt engineering ability?', 'all', 30),
(31, 'Individual AI Proficiency', 'Have you built or configured an AI-powered workflow or automation?', 'all', 31),
(32, 'Individual AI Proficiency', 'How do you validate AI outputs before acting on or sharing them?', 'all', 32),
(33, 'Individual AI Proficiency', 'How do you stay current with AI developments relevant to your role?', 'all', 33);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(29, 1, 'A', 'I have never used an AI tool'),
(29, 2, 'B', 'I use AI as a chat assistant for basic questions and drafts'),
(29, 3, 'C', 'I use AI to produce work artifacts: reports, analysis, presentations, code'),
(29, 4, 'D', 'I use AI in structured workflows — automations, integrations, or pipelines'),
(29, 5, 'E', 'I build and coordinate AI agentic systems that run autonomously for business tasks'),

(30, 1, 'A', 'I don''t know what prompt engineering is'),
(30, 2, 'B', 'I ask basic questions and accept whatever the AI gives me'),
(30, 3, 'C', 'I structure my prompts with context, role, and format instructions'),
(30, 4, 'D', 'I use multi-step prompting, few-shot examples, and chain-of-thought techniques'),
(30, 5, 'E', 'I design advanced prompt architectures including tool use, system prompts, and agentic chains'),

(31, 1, 'A', 'No — I have never built anything with AI'),
(31, 2, 'B', 'I''ve experimented with simple AI features in apps (e.g., Copilot in Word)'),
(31, 3, 'C', 'Yes — I''ve set up a workflow using AI tools (e.g., Zapier + AI, n8n, Make)'),
(31, 4, 'D', 'Yes — I''ve built multi-step pipelines that use AI for automated decision-making'),
(31, 5, 'E', 'Yes — production-grade agentic systems that operate autonomously with monitoring and error handling'),

(32, 1, 'A', 'I accept AI outputs as-is without checking'),
(32, 2, 'B', 'I do a quick read-through to check if it looks reasonable'),
(32, 3, 'C', 'I verify key facts and check for obvious errors before using'),
(32, 4, 'D', 'I apply a structured review: fact-check, bias scan, and relevance validation'),
(32, 5, 'E', 'I use systematic testing protocols including red-teaming, adversarial prompting, and factual verification pipelines'),

(33, 1, 'A', 'I don''t actively follow AI developments'),
(33, 2, 'B', 'I occasionally read news articles when they appear in my feed'),
(33, 3, 'C', 'I follow AI newsletters, podcasts, or LinkedIn communities relevant to my field'),
(33, 4, 'D', 'I take structured courses, attend webinars, and apply new techniques within weeks of learning'),
(33, 5, 'E', 'I contribute to the AI community — writing, speaking, or mentoring — while maintaining a personal R&D practice');

-- ============================================================
-- DIMENSION 10: Use Case Clarity (Q34-Q36)
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(34, 'Use Case Clarity', 'Has your organization identified specific, high-value AI use cases tied to business outcomes?', 'all', 34),
(35, 'Use Case Clarity', 'Have you validated feasibility, data availability, and ROI for your top AI use cases?', 'manager', 35),
(36, 'Use Case Clarity', 'Do you have a prioritized AI use case pipeline with assigned owners and timelines?', 'manager', 36);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(34, 1, 'A', 'No — we have not identified any specific AI use cases'),
(34, 2, 'B', 'We''ve had general discussions but nothing is documented or prioritized'),
(34, 3, 'C', 'A few use cases have been identified informally in specific teams'),
(34, 4, 'D', 'We have a documented list of prioritized AI use cases with business case justifications'),
(34, 5, 'E', 'A comprehensive, board-level AI use case portfolio exists with measurable outcomes, owners, and quarterly reviews'),

(35, 1, 'A', 'No validation has been done'),
(35, 2, 'B', 'We''ve discussed feasibility informally but not tested or quantified'),
(35, 3, 'C', 'Basic feasibility checks have been done for some use cases'),
(35, 4, 'D', 'Most top use cases have been validated for data availability, technical feasibility, and estimated ROI'),
(35, 5, 'E', 'All use cases go through a rigorous validation gate: data audit, build-vs-buy, risk assessment, and modeled ROI before approval'),

(36, 1, 'A', 'No — we don''t have a use case pipeline or ownership model'),
(36, 2, 'B', 'Some ideas exist but no formal ownership or timeline'),
(36, 3, 'C', 'A few use cases have informal owners and rough timelines'),
(36, 4, 'D', 'A prioritized pipeline exists with clear owners, milestones, and success metrics'),
(36, 5, 'E', 'A governed AI use case pipeline is actively managed — prioritized by ROI, assigned with accountable owners, and reviewed monthly');

-- ============================================================
-- DIMENSION 11: Financial & Vendor Readiness (Q37-Q39)
-- ============================================================
INSERT INTO questions (id, dimension, question_text, audience, sort_order) VALUES
(37, 'Financial & Vendor Readiness', 'Does your organization have a dedicated, approved budget for AI initiatives in the next 12 months?', 'cxo', 37),
(38, 'Financial & Vendor Readiness', 'Have you established clear success metrics and ROI expectations for AI investments?', 'cxo', 38),
(39, 'Financial & Vendor Readiness', 'Does your organization have the procurement capability, vendor evaluation framework, and governance to engage and manage AI vendors?', 'cxo', 39);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(37, 1, 'A', 'No — there is no budget allocated to AI'),
(37, 2, 'B', 'AI costs are absorbed informally from existing team budgets'),
(37, 3, 'C', 'A small discretionary AI budget exists but is not formally approved'),
(37, 4, 'D', 'A dedicated AI budget line is approved for the current fiscal year'),
(37, 5, 'E', 'Multi-year AI investment budget is board-approved with phased allocation tied to outcomes'),

(38, 1, 'A', 'No — AI investments have no defined success criteria'),
(38, 2, 'B', 'We expect AI to help but haven''t defined specific metrics'),
(38, 3, 'C', 'Rough success criteria exist for some AI initiatives'),
(38, 4, 'D', 'KPIs and ROI targets are defined for all major AI investments with regular tracking'),
(38, 5, 'E', 'Every AI initiative has quantified ROI expectations, monthly performance reviews, and a kill/scale decision framework'),

(39, 1, 'A', 'No — we have no AI vendor management capability'),
(39, 2, 'B', 'We buy tools ad-hoc without formal evaluation or governance'),
(39, 3, 'C', 'Basic procurement exists; some security and privacy checks are done'),
(39, 4, 'D', 'A vendor evaluation framework covers technical fit, data security, and contract terms'),
(39, 5, 'E', 'Enterprise AI vendor governance: tiered approval, data processing agreements, performance SLAs, exit clauses, and continuous risk review');

-- ============================================================
-- Verify
-- ============================================================
SELECT 'Questions seeded: ' || count(*)::text FROM questions;
SELECT 'Options seeded: ' || count(*)::text FROM question_options;
