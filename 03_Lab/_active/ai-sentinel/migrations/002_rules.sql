-- Phase 5 Wave 1 — Rules engine tables
-- A rule set is a YAML document under a module. One module can own multiple rule sets.
-- `compiled_ir_blob` is the bincode-serialized CompiledRuleSet; rebuilt on load if absent.

CREATE TABLE IF NOT EXISTS rule_sets (
    id                BIGSERIAL   PRIMARY KEY,
    module_id         BIGINT      NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    name              TEXT        NOT NULL,
    yaml_source       TEXT        NOT NULL,
    compiled_ir_blob  BYTEA,
    is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
    version           INTEGER     NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rule_sets_active ON rule_sets(is_active) WHERE is_active = TRUE;

-- Hot table: one row per rule evaluation. TTL enforced by maintenance cron (7 days).
CREATE TABLE IF NOT EXISTS rule_evaluations (
    id                  BIGSERIAL   PRIMARY KEY,
    rule_set_id         BIGINT      NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    trigger             TEXT        NOT NULL,
    request_id          TEXT        NOT NULL,
    decision            TEXT        NOT NULL,
    matched_rule_name   TEXT,
    evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_evals_ts      ON rule_evaluations(evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_evals_request ON rule_evaluations(request_id);
