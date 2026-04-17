\set ON_ERROR_STOP on

-- =============================================================================
-- 010_assignments_state_machine.sql
-- Extends assignments for full state machine: adds in_progress + reassigned
-- states, audit event log, and enrichment columns for review tracking.
-- =============================================================================

-- ALTER TYPE ADD VALUE cannot run inside a transaction block
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'assigned';
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'reassigned' AFTER 'rejected';

BEGIN;

-- Enrich assignments table with review/submit tracking columns
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note   TEXT;

COMMENT ON COLUMN assignments.submitted_at IS 'Timestamp when the assignee submitted evidence for review.';
COMMENT ON COLUMN assignments.reviewed_at  IS 'Timestamp when the reviewer accepted or rejected the assignment.';
COMMENT ON COLUMN assignments.reviewer_id  IS 'User who performed the final accept/reject review.';
COMMENT ON COLUMN assignments.review_note  IS 'Reviewer feedback returned to the assignee on rejection.';

-- ---------------------------------------------------------------------------
-- TABLE: assignment_events
-- Immutable audit log for every assignment state transition.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assignment_events (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID         NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    actor_id      UUID         NOT NULL REFERENCES users(id),
    old_status    TEXT,
    new_status    TEXT         NOT NULL,
    note          TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assignment_events_assignment_created
    ON assignment_events (assignment_id, created_at DESC);

COMMENT ON TABLE assignment_events IS 'Immutable audit trail for assignment state transitions. One row per transition.';

COMMIT;
