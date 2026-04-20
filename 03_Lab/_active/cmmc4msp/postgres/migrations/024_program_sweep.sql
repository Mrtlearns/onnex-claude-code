CREATE TABLE program_sweeps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    requested_by    UUID NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','ready','failed')),
    control_count   INT,
    sweep_report    JSONB,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE sweep_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sweep_id            UUID NOT NULL REFERENCES program_sweeps(id) ON DELETE CASCADE,
    program_control_id  UUID NOT NULL,
    nist_id             TEXT NOT NULL,
    current_status      TEXT NOT NULL,
    priority_rank       INT NOT NULL,
    recommended_action  TEXT NOT NULL,
    gap_summary         TEXT,
    confidence          FLOAT,
    applied             BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at          TIMESTAMPTZ
);

CREATE INDEX ON program_sweeps(program_id);
CREATE INDEX ON sweep_actions(sweep_id);
CREATE INDEX ON sweep_actions(program_control_id);
