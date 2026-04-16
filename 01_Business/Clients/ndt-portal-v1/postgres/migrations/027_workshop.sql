-- ============================================================
-- Migration 027: Workshop Dashboard
-- Creates workshop schema with orders, jobs, and settings tables
-- ============================================================

CREATE SCHEMA IF NOT EXISTS workshop;

-- ── workshop.orders ──────────────────────────────────────────
CREATE TABLE workshop.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT NOT NULL UNIQUE,
  customer_id     UUID REFERENCES ut.customers(id),
  part_number     TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('high', 'medium', 'low')),
  due_date        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'incoming'
                    CHECK (status IN ('incoming', 'in_progress', 'completed', 'on_hold')),
  is_simulated    BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── workshop.jobs ────────────────────────────────────────────
CREATE TABLE workshop.jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES workshop.orders(id) ON DELETE CASCADE,
  inspection_type   TEXT NOT NULL
                      CHECK (inspection_type IN ('RT', 'UT', 'ET', 'MT', 'PT', 'VT')),
  sequence_index    INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'unscheduled'
                      CHECK (status IN ('unscheduled', 'scheduled', 'in_progress', 'completed')),
  scheduled_start   TIMESTAMPTZ,
  scheduled_end     TIMESTAMPTZ,
  actual_start      TIMESTAMPTZ,
  actual_end        TIMESTAMPTZ,
  duration_minutes  INTEGER NOT NULL DEFAULT 60,
  inspector_name    TEXT,
  scheduling_mode   TEXT NOT NULL DEFAULT 'auto'
                      CHECK (scheduling_mode IN ('auto', 'manual')),
  position_override INTEGER,
  is_simulated      BOOLEAN NOT NULL DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── workshop.settings ────────────────────────────────────────
CREATE TABLE workshop.settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workshop_orders_status      ON workshop.orders (status);
CREATE INDEX IF NOT EXISTS idx_workshop_orders_is_simulated ON workshop.orders (is_simulated);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_order_id      ON workshop.jobs (order_id);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_type_scheduled ON workshop.jobs (inspection_type, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_status        ON workshop.jobs (status);

-- ── Seed settings ─────────────────────────────────────────────
INSERT INTO workshop.settings (key, value) VALUES
  ('business_hours',
   '{"start": "08:00", "end": "17:00", "timezone": "America/Los_Angeles"}'::jsonb),
  ('inspection_types',
   '["RT", "UT", "ET", "MT", "PT", "VT"]'::jsonb),
  ('inspection_durations_default',
   '{"RT": 60, "UT": 60, "ET": 60, "MT": 60, "PT": 60, "VT": 60}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── PostgREST grants ──────────────────────────────────────────
GRANT USAGE ON SCHEMA workshop TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA workshop TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA workshop TO authenticated;
