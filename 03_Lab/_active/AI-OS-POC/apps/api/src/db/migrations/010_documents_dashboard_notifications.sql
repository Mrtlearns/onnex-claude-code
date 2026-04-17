-- Migration: 010_documents_dashboard_notifications.sql
-- Phase 10: document_links, notifications, activity_events
-- No FK dependencies to other tables — entity_id is untyped UUID by design

CREATE TABLE IF NOT EXISTS document_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  document_source VARCHAR(20) NOT NULL
    CHECK (document_source IN ('paperless', 'nextcloud')),
  document_id     VARCHAR(255) NOT NULL,
  entity_type     VARCHAR(20) NOT NULL
    CHECK (entity_type IN ('client', 'project', 'deal')),
  entity_id       UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_links_tenant_entity
  ON document_links (tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  user_id     UUID NOT NULL,
  type        VARCHAR(50),
  title       VARCHAR(255),
  body        TEXT,
  entity_type VARCHAR(50),
  entity_id   UUID,
  read_at     TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_read
  ON notifications (tenant_id, user_id, read_at);

CREATE TABLE IF NOT EXISTS activity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  user_id     UUID NOT NULL,
  event_type  VARCHAR(50) NOT NULL
    CHECK (event_type IN ('task_updated', 'deal_stage_changed', 'document_uploaded', 'invoice_sent')),
  entity_type VARCHAR(50),
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_events_tenant_created
  ON activity_events (tenant_id, created_at DESC);
