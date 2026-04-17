-- Migration 016: SOPs table
-- Replaces hardcoded TypeScript array with persistent DB-managed SOPs

CREATE TABLE IF NOT EXISTS sops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL DEFAULT 'default',
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'operations'
                CHECK (category IN ('sales','operations','maintenance','hr')),
  auto          BOOLEAN NOT NULL DEFAULT false,
  input_label   TEXT,
  system_prompt TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sops_tenant_slug_idx ON sops (tenant_id, slug);

-- Seed the 4 original hardcoded SOPs
INSERT INTO sops (tenant_id, slug, title, description, category, auto, input_label, system_prompt)
VALUES
  (
    'default',
    'proposal-generator',
    'Proposal Generator',
    'Generates a professional client proposal based on project details.',
    'sales',
    false,
    'Describe the client and project scope',
    'You are an expert proposal writer for an AI agency called Onnex.
Write a professional, concise client proposal in markdown format.
Include: Executive Summary, Proposed Solution, Timeline, Investment, and Next Steps.
Be specific, confident, and focused on ROI.'
  ),
  (
    'default',
    'weekly-maintenance',
    'Weekly Maintenance Check',
    'Reviews system health, logs, and surfaces any issues for the week.',
    'maintenance',
    true,
    NULL,
    'You are the Agency AI-OS system monitor.
Generate a weekly maintenance report in markdown.
Include sections: System Health Summary, Recommended Actions, Upcoming Tasks.
Keep it concise — 1 page max. Flag anything critical in bold.'
  ),
  (
    'default',
    'client-onboarding',
    'Client Onboarding Checklist',
    'Generates a tailored onboarding checklist for a new client.',
    'operations',
    false,
    'Client name and type of engagement',
    'You are an operations specialist at Onnex AI Agency.
Generate a detailed client onboarding checklist in markdown format.
Include: Welcome & access setup, Discovery call agenda, Technical requirements, Milestone schedule, and Communication cadence.
Tailor it based on the engagement type provided.'
  ),
  (
    'default',
    'sprint-summary',
    'Sprint Summary Report',
    'Summarizes completed work, blockers, and next priorities.',
    'operations',
    true,
    NULL,
    'You are a project delivery manager at Onnex AI Agency.
Generate a weekly sprint summary report in markdown format.
Include: Completed this week, In Progress, Blockers / Risks, Next week priorities.
Be concise and action-oriented. Use bullet points.'
  )
ON CONFLICT DO NOTHING;
