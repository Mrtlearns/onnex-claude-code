-- 025_error_trail.sql
-- Adds error_message parity columns, error_events, and triage_reports tables.

ALTER TABLE policy_drafts         ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE control_gap_analyses  ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE audit_packages        ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE TABLE IF NOT EXISTS error_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    msp_id                  UUID REFERENCES msps(id)      ON DELETE SET NULL,
    org_id                  UUID REFERENCES orgs(id)      ON DELETE SET NULL,
    program_id              UUID REFERENCES programs(id)  ON DELETE SET NULL,
    correlation_id          UUID,
    source                  TEXT NOT NULL CHECK (source IN ('fastapi','n8n','nextjs','postgres','hasura')),
    severity                TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning','error','critical')),
    component               TEXT NOT NULL,
    message                 TEXT NOT NULL,
    stack_trace             TEXT,
    context                 JSONB NOT NULL DEFAULT '{}',
    triaged                 BOOLEAN NOT NULL DEFAULT FALSE,
    triaged_at              TIMESTAMPTZ,
    triaged_by_report_id    UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_events_untriaged
    ON error_events(triaged, created_at DESC)
    WHERE triaged = FALSE;

CREATE INDEX IF NOT EXISTS idx_error_events_correlation
    ON error_events(correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_error_events_org_recent
    ON error_events(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_events_component
    ON error_events(component);

CREATE TABLE IF NOT EXISTS triage_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by    UUID,
    msp_id          UUID REFERENCES msps(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','ready','failed')),
    event_count     INT  NOT NULL DEFAULT 0,
    report          JSONB,
    model           TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-6',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_triage_reports_msp_recent
    ON triage_reports(msp_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triage_reports_status
    ON triage_reports(status);

DO $$ BEGIN
  ALTER TABLE error_events
    ADD CONSTRAINT fk_error_events_triage_report
    FOREIGN KEY (triaged_by_report_id)
    REFERENCES triage_reports(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
