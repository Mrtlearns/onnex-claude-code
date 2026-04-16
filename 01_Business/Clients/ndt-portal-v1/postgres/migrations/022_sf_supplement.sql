-- Migration 022: Supplement existing sf.* tables with missing fields
-- Adds stage/owner/amount/created_date to sf.jobs and geography/owner to sf.accounts.
-- These fields power win-rate analysis, pipeline funnels, rep performance, and lead-time trends.
-- All columns are nullable (ADD COLUMN IF NOT EXISTS) — safe to run on populated tables.

-- ── sf.accounts — add geography, owner, created date, contact info ────────────
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS billing_state   TEXT;
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS billing_country TEXT;
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS billing_city    TEXT;
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS owner_name      TEXT;
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS created_date    DATE;
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS industry        TEXT;

-- ── sf.jobs — add opportunity stage, value, owner, dates, description ────────
-- stage_name  : StageName — enables win/loss/pipeline analysis
-- amount      : Opportunity.Amount — value at quote time (vs invoice_amount = actual)
-- owner_name  : Owner.Name — rep/engineer who owns the opportunity
-- created_date: CreatedDate — lead time from creation to completion
-- description : Description — general notes on the opportunity
-- is_won      : IsWon — boolean shortcut for closed-won opportunities
-- is_closed   : IsClosed — true for both won and lost (closed stage)
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS stage_name   TEXT;
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS amount       NUMERIC(12,2);
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS owner_name   TEXT;
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS created_date DATE;
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS is_won       BOOLEAN;
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS is_closed    BOOLEAN;

-- ── Indexes for new analytical columns ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS sf_jobs_stage_idx    ON sf.jobs(stage_name) WHERE stage_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_jobs_owner_idx    ON sf.jobs(owner_name) WHERE owner_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_jobs_won_idx      ON sf.jobs(is_won)     WHERE is_won = true;
CREATE INDEX IF NOT EXISTS sf_accounts_mkt_idx  ON sf.accounts(market) WHERE market IS NOT NULL;
