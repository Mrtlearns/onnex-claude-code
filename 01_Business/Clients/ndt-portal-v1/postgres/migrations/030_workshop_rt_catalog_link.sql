-- ============================================================
-- Migration 030: Link workshop.machines RT entries to rt.machine_catalog
-- Adds rt_catalog_id column so GET /workshop/machines can auto-sync
-- from rt.machine_catalog (the source of truth for RT machines).
-- ============================================================

-- Add the link column (nullable — only populated for RT type machines)
ALTER TABLE workshop.machines
  ADD COLUMN IF NOT EXISTS rt_catalog_id TEXT;

-- Create unique index (NULLs don't violate uniqueness, so non-RT rows are fine)
CREATE UNIQUE INDEX IF NOT EXISTS workshop_machines_rt_catalog_id_uniq
  ON workshop.machines (rt_catalog_id)
  WHERE rt_catalog_id IS NOT NULL;

-- Populate rt_catalog_id for existing RT machines seeded by migration 029
-- Match on nickname (which was used as the name when seeding)
UPDATE workshop.machines wm
SET rt_catalog_id = mc.machine_id
FROM rt.machine_catalog mc
WHERE wm.type = 'RT'
  AND wm.name = mc.nickname
  AND wm.rt_catalog_id IS NULL;
