-- Migration 033: UT Rule Engine — versioned, DB-driven calculation rules
-- Replaces hardcoded formulas with editable, versioned rule sets
-- Created: 2026-04-09

-- ── Schema ───────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS ut_rules;
GRANT USAGE ON SCHEMA ut_rules TO anon, authenticated;

-- ── Rule Sets ────────────────────────────────────────────────────
-- A named collection of calculation rules (e.g. "default", "PREMCO-custom").
-- Each rule set has immutable versions (1, 2, 3, ...).
CREATE TABLE ut_rules.rule_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      TEXT NOT NULL DEFAULT 'system'
);

-- ── Rule Set Versions ────────────────────────────────────────────
-- Immutable snapshot. Any edit creates version N+1.
CREATE TABLE ut_rules.rule_set_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id     UUID NOT NULL REFERENCES ut_rules.rule_sets(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    is_latest       BOOLEAN NOT NULL DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      TEXT NOT NULL DEFAULT 'system',
    UNIQUE(rule_set_id, version)
);

CREATE INDEX idx_rsv_rule_set_id ON ut_rules.rule_set_versions(rule_set_id);
CREATE INDEX idx_rsv_latest ON ut_rules.rule_set_versions(rule_set_id, is_latest) WHERE is_latest = true;

-- ── Rules ────────────────────────────────────────────────────────
-- Each rule belongs to a version. Categories map to the formula groups.
-- The definition JSONB holds the actual formula/lookup data.
CREATE TABLE ut_rules.rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id      UUID NOT NULL REFERENCES ut_rules.rule_set_versions(id) ON DELETE CASCADE,
    category        TEXT NOT NULL CHECK (category IN (
                      'rate', 'load_time', 'scan_formula', 'price_modifier',
                      'weight_formula', 'lot_calculation', 'rounding'
                    )),
    geometry_type   TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    label           TEXT NOT NULL,
    description     TEXT,
    definition      JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_version_id ON ut_rules.rules(version_id);
CREATE INDEX idx_rules_category ON ut_rules.rules(version_id, category);

-- ── Calculation Trace Log ────────────────────────────────────────
-- Full trace of every calculation, persisted for audit/compliance.
CREATE TABLE ut_rules.calculation_traces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id            UUID,
    rule_set_name       TEXT NOT NULL,
    rule_set_version    INT NOT NULL,
    rule_set_version_id UUID NOT NULL REFERENCES ut_rules.rule_set_versions(id),
    geometry_type       TEXT NOT NULL,
    inputs              JSONB NOT NULL,
    steps               JSONB NOT NULL,
    scan_result         JSONB NOT NULL,
    weight_result       JSONB,
    lot_result          JSONB NOT NULL,
    final_result        JSONB NOT NULL,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculated_by       TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_ct_quote_id ON ut_rules.calculation_traces(quote_id);
CREATE INDEX idx_ct_calculated_at ON ut_rules.calculation_traces(calculated_at DESC);
CREATE INDEX idx_ct_rule_set ON ut_rules.calculation_traces(rule_set_name, rule_set_version);

-- ── Rule Change Audit Log ────────────────────────────────────────
CREATE TABLE ut_rules.change_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id     UUID NOT NULL REFERENCES ut_rules.rule_sets(id),
    version_from    INT,
    version_to      INT NOT NULL,
    change_type     TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'clone')),
    diff            JSONB,
    changed_by      TEXT NOT NULL DEFAULT 'system',
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cl_rule_set_id ON ut_rules.change_log(rule_set_id);

-- ── Customer → Rule Set Assignment ──────────────────────────────
ALTER TABLE ut.customers
    ADD COLUMN IF NOT EXISTS rule_set_id     UUID REFERENCES ut_rules.rule_sets(id),
    ADD COLUMN IF NOT EXISTS rule_version_pin INT;

-- ── Quote → Rule Set Version + Trace ─────────────────────────────
ALTER TABLE ut.incoming_quotes
    ADD COLUMN IF NOT EXISTS rule_set_version_id  UUID REFERENCES ut_rules.rule_set_versions(id),
    ADD COLUMN IF NOT EXISTS calculation_trace_id  UUID;

-- ── Grants ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ut_rules TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ut_rules GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
