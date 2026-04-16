-- Migration 010: Growth Channels (Phase 09)
-- Adds intake-form fields to leads, source attribution view

-- ── Leads: additional intake capture fields ───────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS date_of_loss DATE,
  ADD COLUMN IF NOT EXISTS fault        TEXT,        -- 'yes' | 'no' | 'unsure'
  ADD COLUMN IF NOT EXISTS has_medical  BOOLEAN DEFAULT false;

-- ── Source attribution analytics view ─────────────────────────────────────
CREATE OR REPLACE VIEW source_attribution_stats AS
SELECT
  COALESCE(source, 'unknown') AS source,
  COUNT(*)                                                            AS total_leads,
  COUNT(*) FILTER (WHERE status = 'signed')                          AS signed_leads,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'signed')::numeric
      / NULLIF(COUNT(*), 0) * 100,
    1
  )                                                                   AS conversion_pct
FROM leads
GROUP BY source
ORDER BY total_leads DESC;

GRANT SELECT ON source_attribution_stats TO web_user;
