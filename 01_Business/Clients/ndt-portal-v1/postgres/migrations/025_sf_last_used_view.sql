-- Migration 025: sf.part_last_used — last spec/technique/service per part × account
--
-- Answers: "For a given part number, what specification and technique did we last use
--           on the quote or actual job?"
--
-- This is a regular VIEW (not materialized) so it reflects the current sf.jobs data
-- immediately after each sync — no separate REFRESH step needed.
--
-- The DISTINCT ON pattern picks the single most-recent job per (account, part) pair
-- ordered by COALESCE(date_completed, date_received) DESC — completed jobs rank first.

CREATE OR REPLACE VIEW sf.part_last_used AS
SELECT DISTINCT ON (j.account_sf_id, j.part_number)
  j.account_sf_id,
  a.name                                                  AS account_name,
  j.part_number,
  j.part_rev                                              AS last_rev,
  j.services                                              AS last_services,
  j.specification                                         AS last_specification,
  j.ndt_procedure                                         AS last_technique,
  j.acceptance_criteria                                   AS last_acceptance_criteria,
  j.scope                                                 AS last_scope,
  j.work_order_number                                     AS last_work_order,
  j.invoice_number                                        AS last_invoice_number,
  j.invoice_amount                                        AS last_invoice_amount,
  j.stage_name                                            AS last_stage,
  j.is_won                                                AS last_job_was_won,
  COALESCE(j.date_completed, j.date_received)             AS last_job_date,
  j.date_completed                                        AS last_completed_date,
  j.date_received                                         AS last_received_date,
  j.record_type                                           AS last_record_type,
  j.sf_id                                                 AS last_job_sf_id
FROM sf.jobs j
JOIN sf.accounts a ON a.sf_id = j.account_sf_id
WHERE j.part_number IS NOT NULL
  AND j.part_number <> ''
ORDER BY
  j.account_sf_id,
  j.part_number,
  COALESCE(j.date_completed, j.date_received) DESC NULLS LAST;

COMMENT ON VIEW sf.part_last_used IS
  'Most recent job per part × account. Answers "what spec/technique did we last use for this part?"';


-- ── Supporting index on sf.jobs for fast view resolution ─────────────────────
-- Covers the ORDER BY in the view's DISTINCT ON query.
CREATE INDEX IF NOT EXISTS sf_jobs_part_last_used_idx
  ON sf.jobs (account_sf_id, part_number, (COALESCE(date_completed, date_received)) DESC NULLS LAST)
  WHERE part_number IS NOT NULL AND part_number <> '';


-- ── Update sf.bom_parts to include last-used columns ─────────────────────────
-- Drop and recreate the materialized view to join in last-used data.
-- This gives the BOM view both the aggregate history AND the most recent usage
-- in a single record per part × account.

DROP MATERIALIZED VIEW IF EXISTS sf.bom_parts;

CREATE MATERIALIZED VIEW sf.bom_parts AS
SELECT
  j.account_sf_id,
  a.name                                                        AS account_name,
  j.part_number,

  -- Aggregate history (all distinct values ever used)
  array_agg(DISTINCT j.part_rev)
    FILTER (WHERE j.part_rev IS NOT NULL)                       AS revisions,
  array_agg(DISTINCT svc)
    FILTER (WHERE svc IS NOT NULL)                              AS services,
  array_agg(DISTINCT j.specification)
    FILTER (WHERE j.specification IS NOT NULL)                  AS specifications,
  array_agg(DISTINCT j.ndt_procedure)
    FILTER (WHERE j.ndt_procedure IS NOT NULL)                  AS procedures,
  array_agg(DISTINCT j.acceptance_criteria)
    FILTER (WHERE j.acceptance_criteria IS NOT NULL)            AS acceptance_criteria,

  -- Job counts and dates
  count(*)                                                      AS job_count,
  max(COALESCE(j.date_completed, j.date_received))              AS last_processed,

  -- Invoice stats
  avg(j.invoice_amount) FILTER (WHERE j.invoice_amount > 0)    AS avg_invoice,
  max(j.invoice_amount)                                         AS max_invoice,

  -- Last-used snapshot (most recent values — what to pre-fill on next quote)
  (
    SELECT j2.specification
    FROM sf.jobs j2
    WHERE j2.account_sf_id = j.account_sf_id
      AND j2.part_number   = j.part_number
      AND j2.specification IS NOT NULL
    ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
    LIMIT 1
  )                                                             AS last_specification,
  (
    SELECT j2.ndt_procedure
    FROM sf.jobs j2
    WHERE j2.account_sf_id = j.account_sf_id
      AND j2.part_number   = j.part_number
      AND j2.ndt_procedure IS NOT NULL
    ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
    LIMIT 1
  )                                                             AS last_technique,
  (
    SELECT j2.acceptance_criteria
    FROM sf.jobs j2
    WHERE j2.account_sf_id = j.account_sf_id
      AND j2.part_number   = j.part_number
      AND j2.acceptance_criteria IS NOT NULL
    ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
    LIMIT 1
  )                                                             AS last_acceptance_criteria,
  (
    SELECT j2.services
    FROM sf.jobs j2
    WHERE j2.account_sf_id = j.account_sf_id
      AND j2.part_number   = j.part_number
      AND j2.services IS NOT NULL
    ORDER BY COALESCE(j2.date_completed, j2.date_received) DESC NULLS LAST
    LIMIT 1
  )                                                             AS last_services

FROM sf.jobs j
JOIN sf.accounts a ON a.sf_id = j.account_sf_id
CROSS JOIN LATERAL unnest(j.services) AS svc
WHERE j.part_number IS NOT NULL AND j.part_number <> ''
GROUP BY j.account_sf_id, a.name, j.part_number
WITH DATA;

CREATE INDEX IF NOT EXISTS bom_parts_account_idx ON sf.bom_parts(account_sf_id);
CREATE INDEX IF NOT EXISTS bom_parts_part_idx    ON sf.bom_parts(part_number);
