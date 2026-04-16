-- ============================================================
-- Migration 029: Seed workshop.machines from rt.machine_catalog
-- Replaces generic "RT Machine 1/2" with real RT cabinet specs
-- ============================================================

-- Remove generic RT machines created by migration 028
DELETE FROM workshop.machines
WHERE type = 'RT'
  AND name LIKE 'RT Machine %';

-- Insert real RT machines from rt.machine_catalog, preserving their IDs
-- so that any existing job references can be traced back to source catalog
INSERT INTO workshop.machines (name, type, display_order, is_active)
SELECT
  mc.nickname                                              AS name,
  'RT'                                                     AS type,
  ROW_NUMBER() OVER (ORDER BY mc.machine_id) - 1          AS display_order,
  mc.is_active
FROM rt.machine_catalog mc
ORDER BY mc.machine_id
ON CONFLICT DO NOTHING;
