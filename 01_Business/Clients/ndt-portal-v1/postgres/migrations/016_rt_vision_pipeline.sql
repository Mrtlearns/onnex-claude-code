-- Migration 016: RT Vision Pipeline
-- Adds rt_quote_id to pipeline.intake_sessions so the system can link
-- a completed RT vision analysis back to the RT quote it created.

ALTER TABLE pipeline.intake_sessions
    ADD COLUMN IF NOT EXISTS rt_quote_id TEXT;

-- Index for quick lookup by RT quote ID
CREATE INDEX IF NOT EXISTS idx_intake_sessions_rt_quote_id
    ON pipeline.intake_sessions (rt_quote_id)
    WHERE rt_quote_id IS NOT NULL;
