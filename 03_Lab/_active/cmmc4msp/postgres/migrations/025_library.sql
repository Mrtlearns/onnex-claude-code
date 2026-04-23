BEGIN;

CREATE TABLE library_folders (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  parent_id  UUID        REFERENCES library_folders(id) ON DELETE CASCADE,
  created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_folders_parent ON library_folders(parent_id);

CREATE TABLE library_files (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   UUID        REFERENCES library_folders(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  minio_key   TEXT        NOT NULL UNIQUE,
  size_bytes  BIGINT,
  mime_type   TEXT        NOT NULL DEFAULT 'application/pdf',
  uploaded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_files_folder ON library_files(folder_id);

COMMIT;
