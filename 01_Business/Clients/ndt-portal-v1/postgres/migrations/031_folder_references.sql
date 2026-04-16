-- Migration 031: Folder References
-- Stores named aliases for Nextcloud folders that can be resolved by inspection steps.
-- e.g. alias 'tech_spec' → /NDT/TechSpecs/

CREATE TABLE IF NOT EXISTS app.folder_references (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  alias          TEXT        NOT NULL,                        -- code identifier, e.g. 'tech_spec'
  display_name   TEXT        NOT NULL,                        -- human label, e.g. 'Technical Specifications'
  nextcloud_path TEXT        NOT NULL,                        -- Nextcloud path, e.g. '/NDT/TechSpecs/'
  description    TEXT,                                        -- optional notes
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique alias among active references (allow re-use of alias after soft-delete)
CREATE UNIQUE INDEX idx_folder_references_alias_active
  ON app.folder_references (alias)
  WHERE is_active = TRUE;
