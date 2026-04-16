\set ON_ERROR_STOP on

BEGIN;

-- =============================================================================
-- 003_indexes.sql
-- CMMC Compliance OS — Performance Indexes
-- Database: cmmc_main
-- Run after: 001_core_schema.sql, 002_seed_controls.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FK INDEXES
-- PostgreSQL does not auto-index FK columns. These prevent seq scans on
-- every join traversal across the core relationship graph.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_org_id
    ON users(org_id);

CREATE INDEX IF NOT EXISTS idx_programs_org_id
    ON programs(org_id);

CREATE INDEX IF NOT EXISTS idx_program_controls_program_id
    ON program_controls(program_id);

CREATE INDEX IF NOT EXISTS idx_program_controls_control_def
    ON program_controls(control_definition_id);

CREATE INDEX IF NOT EXISTS idx_assignments_program_control
    ON assignments(program_control_id);

CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to
    ON assignments(assigned_to);

CREATE INDEX IF NOT EXISTS idx_assignments_program_id
    ON assignments(program_id);

CREATE INDEX IF NOT EXISTS idx_artifacts_program_control
    ON artifacts(program_control_id);

CREATE INDEX IF NOT EXISTS idx_artifacts_assignment
    ON artifacts(assignment_id);

CREATE INDEX IF NOT EXISTS idx_assessments_artifact
    ON assessments(artifact_id);

CREATE INDEX IF NOT EXISTS idx_assessments_program_control
    ON assessments(program_control_id);

CREATE INDEX IF NOT EXISTS idx_milestones_program_control
    ON milestones(program_control_id);

CREATE INDEX IF NOT EXISTS idx_milestones_program_id
    ON milestones(program_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_org
    ON activity_log(org_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_program
    ON activity_log(program_id);

-- ---------------------------------------------------------------------------
-- QUERY PATTERN INDEXES
-- Targeted at the most frequent application query shapes:
--   - Dashboard: controls by status within a program
--   - Phase gating: unlocked controls per program
--   - Org lookup by slug (URL routing)
--   - Control master lookups by NIST ID and phase
--   - Audit log: recent events per org (descending time)
--   - Worker queue: artifacts pending or stuck in processing
--   - POA&M view: incomplete milestones with upcoming dates
-- ---------------------------------------------------------------------------

-- Control status dashboard — filters by program + status in one index
CREATE INDEX IF NOT EXISTS idx_program_controls_status
    ON program_controls(program_id, status);

-- Phase gating query — which controls are unlocked for a program
CREATE INDEX IF NOT EXISTS idx_program_controls_phase_unlocked
    ON program_controls(program_id, is_phase_unlocked);

-- Org URL routing — slug is the external identifier in all routes
CREATE INDEX IF NOT EXISTS idx_orgs_slug
    ON orgs(slug);

-- Control master lookups by NIST ID (e.g. "3.1.1")
CREATE INDEX IF NOT EXISTS idx_control_defs_nist_id
    ON control_definitions(nist_id);

-- Phase-based control filtering for seeding and phase progression
CREATE INDEX IF NOT EXISTS idx_control_defs_phase
    ON control_definitions(far_above_phase);

-- Activity feed — most recent events per org, efficient with DESC ordering
CREATE INDEX IF NOT EXISTS idx_activity_log_recent
    ON activity_log(org_id, created_at DESC);

-- Worker dispatch — find all artifacts needing assessment
CREATE INDEX IF NOT EXISTS idx_artifacts_status
    ON artifacts(assessment_status);

-- Stuck job detection — processing artifacts that have not progressed
-- Partial index keeps this small; only rows in 'processing' are indexed.
CREATE INDEX IF NOT EXISTS idx_artifacts_hung
    ON artifacts(assessment_status, last_attempted_at)
    WHERE assessment_status = 'processing';

-- POA&M upcoming milestones — incomplete items sorted by date
-- Partial index excludes already-completed milestones.
CREATE INDEX IF NOT EXISTS idx_milestones_upcoming
    ON milestones(current_milestone_date, is_complete)
    WHERE is_complete = FALSE;

COMMIT;
