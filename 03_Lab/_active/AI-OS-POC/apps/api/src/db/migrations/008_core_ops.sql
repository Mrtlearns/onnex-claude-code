-- 008_core_ops.sql
-- Run: docker exec -i postgres-core psql -U aios_user -d aios < 008_core_ops.sql

BEGIN;

CREATE TABLE IF NOT EXISTS clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('Agency','Direct')),
  status        TEXT NOT NULL DEFAULT 'Prospect' CHECK (status IN ('Active','Prospect','Churned')),
  billing_address TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_status  ON clients(tenant_id, status);

CREATE TABLE IF NOT EXISTS contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL,
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  role       TEXT
);
CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id);

CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed','On Hold')),
  start_date  DATE,
  end_date    DATE,
  budget      NUMERIC(12,2),
  phases      JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id  TEXT,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'Backlog' CHECK (status IN ('Backlog','In Progress','Review','Done')),
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant   ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(tenant_id, assignee_id);

CREATE TABLE IF NOT EXISTS subtasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  completed  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
