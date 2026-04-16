-- Migration 005: Append-only pipeline audit event table
-- Each step-update call now inserts a permanent row here in addition to
-- updating the JSONB step_progress array. Supports the ExecutionLogViewer UI.

CREATE TABLE IF NOT EXISTS pipeline.step_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id    UUID NOT NULL,
    step_key     TEXT NOT NULL,
    event_type   TEXT NOT NULL CHECK (event_type IN (
                     'start','request_sent','response_received',
                     'complete','error','skip','stalled')),
    direction    TEXT CHECK (direction IN ('out','in','internal')),
    service_name TEXT,         -- 'comply' | 'sanitize' | 'gateway' | 'api'
    endpoint     TEXT,         -- e.g. 'http://gateway:8012/analyze'
    http_status  INTEGER,
    latency_ms   INTEGER,
    payload      JSONB,        -- request OR response body (tokenized, never plaintext)
    log_message  TEXT,
    detail       JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No FK to intake_sessions intentionally — avoids race conditions when n8n
-- posts step_events before pipeline/result marks the session complete.

CREATE INDEX IF NOT EXISTS idx_step_events_intake ON pipeline.step_events (intake_id, created_at);

GRANT ALL PRIVILEGES ON TABLE pipeline.step_events TO ndtapp;
