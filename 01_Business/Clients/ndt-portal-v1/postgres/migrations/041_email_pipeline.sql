-- ============================================================================
-- Migration 041: Email Automation Pipeline
-- Created: 2026-04-14
--
-- Adds:
--   app.email_quotes        — email-sourced quote requests (EQ-YYYY-NNNN)
--   app.email_threads       — conversation thread messages (inbound + outbound)
--   app.email_checks        — configurable completeness/classification checks
--   app.diagram_analyses    — central LLM analysis store (all inspection types)
--
-- New permissions: INBOX_VIEW, QUOTE_ANALYSIS_VIEW
-- Granted to: super_admin (all), admin (all), rt_manager, ut_manager,
--             floor_manager (INBOX_VIEW only)
-- ============================================================================

-- ============================================================================
-- 1. EQ quote number sequence  (EQ-YYYY-NNNN)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS app.eq_quote_number_seq START 1;

-- ============================================================================
-- 2. app.email_quotes
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.email_quotes (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number            TEXT        NOT NULL UNIQUE
                            DEFAULT ('EQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('app.eq_quote_number_seq')::text, 4, '0')),

  -- Gmail identifiers
  gmail_message_id        TEXT        NOT NULL,          -- first message in thread
  gmail_thread_id         TEXT        NOT NULL,          -- thread ID for reply matching
  gmail_label_ids         TEXT[]      NOT NULL DEFAULT '{}',

  -- Sender info
  sender_email            TEXT        NOT NULL,
  sender_name             TEXT,

  -- Customer resolution
  customer_id             UUID,                          -- NULL = new prospect
  customer_name           TEXT,                         -- resolved name or sender_email

  -- Classification
  inspection_types        TEXT[]      NOT NULL DEFAULT '{}',   -- ['RT','UT'] etc.
  classification_confidence TEXT      CHECK (classification_confidence IN ('high','medium','low','none')),
  classification_source   TEXT        CHECK (classification_source IN ('llm','keyword','manual')),

  -- Subject / body snapshot
  subject                 TEXT        NOT NULL DEFAULT '',
  body_text               TEXT,

  -- Attachments (Nextcloud paths)
  nextcloud_paths         TEXT[]      NOT NULL DEFAULT '{}',

  -- Pipeline status
  status                  TEXT        NOT NULL DEFAULT 'received'
                            CHECK (status IN (
                              'received',       -- just landed, checks pending
                              'checking',       -- email checks running
                              'needs_info',     -- check failed, awaiting reply
                              'processing',     -- 00-PRE + type steps running
                              'quoted',         -- pipeline complete, quote ready
                              'failed'          -- pipeline error
                            )),

  -- ITAR routing (set by 00-PRE Compliance Classification step)
  llm_routing             TEXT        CHECK (llm_routing IN ('CLOUD_OK','LOCAL_ONLY','HOLD')),

  -- Timestamps
  received_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_quotes_thread_id
  ON app.email_quotes (gmail_thread_id);

CREATE INDEX IF NOT EXISTS idx_email_quotes_status
  ON app.email_quotes (status);

CREATE INDEX IF NOT EXISTS idx_email_quotes_customer_id
  ON app.email_quotes (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_quotes_received_at
  ON app.email_quotes (received_at DESC);

-- ============================================================================
-- 3. app.email_threads  — per-quote conversation messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.email_threads (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_quote_id    UUID        NOT NULL REFERENCES app.email_quotes(id) ON DELETE CASCADE,

  direction         TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
  gmail_message_id  TEXT,                           -- NULL for outbound until sent
  subject           TEXT        NOT NULL DEFAULT '',
  body_text         TEXT,
  sender_email      TEXT        NOT NULL,
  recipient_email   TEXT        NOT NULL,

  -- Which check triggered an outbound reply (NULL for inbound)
  triggered_by_check_code TEXT,

  -- Attachments on this specific message (Nextcloud paths)
  nextcloud_paths   TEXT[]      NOT NULL DEFAULT '{}',

  sent_at           TIMESTAMPTZ,                    -- NULL = queued / pending send
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_quote_id
  ON app.email_threads (email_quote_id, created_at);

-- ============================================================================
-- 4. app.email_checks  — configurable completeness / classification checks
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.email_checks (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  description      TEXT    NOT NULL DEFAULT '',
  enabled          BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,

  -- Message sent as auto-reply when this check fails
  response_message TEXT    NOT NULL DEFAULT '',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the four confirmed checks
INSERT INTO app.email_checks
  (code, name, description, enabled, sort_order, response_message)
VALUES
  (
    'DIAGRAM_ATTACHED',
    'Diagram / Drawing Attached',
    'Verifies that at least one attachment (PDF or image) is present in the email.',
    true, 0,
    'Thank you for your enquiry. To proceed with your quote, we require a diagram or drawing of the part to be inspected. Please reply to this email with the relevant attachment and we will continue processing your request.'
  ),
  (
    'CUSTOMER_IDENTIFIED',
    'Customer Identified',
    'Matches the sender email address or domain against known customers in the database. If no match is found the quote is flagged as a new prospect — this check does not block processing.',
    true, 1,
    ''   -- no failure reply — new prospect is flagged, not blocked
  ),
  (
    'INSPECTION_TYPE_CLASSIFIABLE',
    'Inspection Type Classifiable',
    'Uses LLM / keyword classification to detect at least one NDT inspection method (RT, UT, ET, MT, PT, VT) with medium or higher confidence.',
    true, 2,
    'Thank you for contacting us. We were unable to determine the type of NDT inspection required from your email. Could you please clarify whether you require Radiographic Testing (RT), Ultrasonic Testing (UT), or another inspection method? We will then process your quote promptly.'
  ),
  (
    'PART_MATERIAL_PRESENT',
    'Part Number / Material Specified',
    'Checks that the email body contains a part number and/or material specification needed to price the job.',
    true, 3,
    'Thank you for your enquiry. To provide an accurate quote we need the part number and material specification (e.g. carbon steel, stainless steel, aluminium) for the components to be inspected. Please reply with these details and we will process your request right away.'
  )
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 5. app.diagram_analyses  — central LLM analysis store (all inspection types)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.diagram_analyses (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source quote linkage (one of these will be set)
  email_quote_id   UUID    REFERENCES app.email_quotes(id) ON DELETE SET NULL,
  ut_quote_id      UUID,   -- references ut.incoming_quotes(id) — no FK across schemas
  rt_quote_id      TEXT,   -- RT uses TEXT IDs in some places

  quote_type       TEXT    NOT NULL CHECK (quote_type IN ('email','ut','rt')),
  quote_number     TEXT    NOT NULL,   -- denormalised for display

  -- Analysis content
  inspection_type  TEXT    NOT NULL,   -- 'RT', 'UT', 'ET', 'MT', 'PT', 'VT'
  step_name        TEXT    NOT NULL,   -- which inspection step produced this
  raw_response     JSONB   NOT NULL,   -- full LLM response

  -- Metadata
  model_used       TEXT,
  provider         TEXT    CHECK (provider IN ('anthropic','ollama','other')),
  tokens_used      INTEGER,
  duration_ms      INTEGER,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagram_analyses_email_quote
  ON app.diagram_analyses (email_quote_id)
  WHERE email_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diagram_analyses_quote_number
  ON app.diagram_analyses (quote_number);

CREATE INDEX IF NOT EXISTS idx_diagram_analyses_inspection_type
  ON app.diagram_analyses (inspection_type);

CREATE INDEX IF NOT EXISTS idx_diagram_analyses_created_at
  ON app.diagram_analyses (created_at DESC);

-- ============================================================================
-- 6. Grant table access
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE
  ON app.email_quotes, app.email_threads, app.email_checks, app.diagram_analyses
  TO anon, authenticated;

GRANT USAGE, SELECT ON SEQUENCE app.eq_quote_number_seq TO anon, authenticated;

-- ============================================================================
-- 7. New permissions
-- ============================================================================

INSERT INTO auth.permissions (code, description, module, label, category) VALUES
  ('INBOX_VIEW',          'View and manage email inbox quote requests',  'inbox',           'View Inbox',           'view'),
  ('INBOX_MANAGE',        'Manage email checks and reply templates',     'inbox',           'Manage Inbox',         'admin'),
  ('QUOTE_ANALYSIS_VIEW', 'View LLM diagram analyses across all quotes', 'quote-analyses',  'View Quote Analyses',  'view')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 8. Role grants for new permissions
-- ============================================================================

DO $$
DECLARE
  tid UUID;
BEGIN
  FOR tid IN SELECT id FROM auth.tenants LOOP

    -- super_admin: all permissions (auto-covered by existing DO NOTHING pattern)
    INSERT INTO auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM auth.roles r, auth.permissions p
    WHERE r.name = 'super_admin' AND r.tenant_id = tid
      AND p.code IN ('INBOX_VIEW','INBOX_MANAGE','QUOTE_ANALYSIS_VIEW')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- admin: all three
    INSERT INTO auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM auth.roles r, auth.permissions p
    WHERE r.name = 'admin' AND r.tenant_id = tid
      AND p.code IN ('INBOX_VIEW','INBOX_MANAGE','QUOTE_ANALYSIS_VIEW')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- rt_manager: inbox view + analysis view
    INSERT INTO auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM auth.roles r, auth.permissions p
    WHERE r.name = 'rt_manager' AND r.tenant_id = tid
      AND p.code IN ('INBOX_VIEW','QUOTE_ANALYSIS_VIEW')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- ut_manager: inbox view + analysis view
    INSERT INTO auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM auth.roles r, auth.permissions p
    WHERE r.name = 'ut_manager' AND r.tenant_id = tid
      AND p.code IN ('INBOX_VIEW','QUOTE_ANALYSIS_VIEW')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- floor_manager: inbox view only
    INSERT INTO auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM auth.roles r, auth.permissions p
    WHERE r.name = 'floor_manager' AND r.tenant_id = tid
      AND p.code IN ('INBOX_VIEW')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

  END LOOP;
END $$;
