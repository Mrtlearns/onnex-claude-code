-- ============================================================
-- Migration 028: Workshop Machines
-- Adds per-machine tracking, working days, holidays, buffer time
-- and offline windows. Migrates machineCounts to machine rows.
-- ============================================================

-- ── workshop.machines ────────────────────────────────────────
CREATE TABLE workshop.machines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL
                    CHECK (type IN ('RT', 'UT', 'ET', 'MT', 'PT', 'VT')),
  inspector_name  TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── workshop.machine_offline_windows ─────────────────────────
CREATE TABLE workshop.machine_offline_windows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  UUID NOT NULL REFERENCES workshop.machines(id) ON DELETE CASCADE,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_offline_range CHECK (end_at > start_at)
);

-- ── Add machine columns to workshop.jobs ─────────────────────
ALTER TABLE workshop.jobs
  ADD COLUMN allowed_machines UUID[],
  ADD COLUMN assigned_machine UUID REFERENCES workshop.machines(id) ON DELETE SET NULL;

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_workshop_machines_type    ON workshop.machines (type) WHERE is_active = TRUE;
CREATE INDEX idx_workshop_jobs_assigned_machine ON workshop.jobs (assigned_machine, scheduled_start)
  WHERE assigned_machine IS NOT NULL;
CREATE INDEX idx_offline_windows_machine   ON workshop.machine_offline_windows (machine_id, start_at, end_at);

-- ── Seed new settings keys ────────────────────────────────────
INSERT INTO workshop.settings (key, value) VALUES
  ('working_days',    '["Mon","Tue","Wed","Thu","Fri"]'::jsonb),
  ('holidays',        '[]'::jsonb),
  ('buffer_minutes',  '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── Migrate machineCounts → workshop.machines rows ───────────
-- Reads the existing 'machine_counts' setting (or falls back to defaults)
-- and inserts one machine row per unit, named '{TYPE} Machine {N}'.
DO $$
DECLARE
  mc      JSONB;
  itype   TEXT;
  cnt     INTEGER;
  i       INTEGER;
  dorder  INTEGER;
BEGIN
  SELECT value INTO mc FROM workshop.settings WHERE key = 'machine_counts';
  IF mc IS NULL THEN
    mc := '{"RT": 2, "UT": 1, "ET": 1, "MT": 1, "PT": 1, "VT": 1}'::jsonb;
  END IF;

  FOR itype IN SELECT jsonb_object_keys(mc) LOOP
    cnt    := (mc ->> itype)::INTEGER;
    dorder := 0;
    FOR i IN 1..cnt LOOP
      INSERT INTO workshop.machines (name, type, display_order)
      VALUES (itype || ' Machine ' || i, itype, dorder);
      dorder := dorder + 1;
    END LOOP;
  END LOOP;
END $$;

-- ── PostgREST grants ──────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON workshop.machines TO authenticated;
GRANT SELECT ON workshop.machines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON workshop.machine_offline_windows TO authenticated;
GRANT SELECT ON workshop.machine_offline_windows TO anon;
