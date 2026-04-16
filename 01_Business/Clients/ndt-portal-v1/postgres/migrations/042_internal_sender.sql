-- ============================================================================
-- Migration 042 — Internal sender support
--
-- Adds columns to email_quotes to track:
--   • is_internal_sender   — true for mrt@on-nex.com, *@ndtesting.com,
--                            mrtmaharaj@gmail.com (forwarded test emails)
--   • msg_original_subject — subject extracted from a .msg attachment
--   • msg_original_from    — sender extracted from a .msg attachment
--
-- When is_internal_sender = true:
--   - The email is treated as a forwarded RFQ from the internal testing team
--   - customer_id / customer_name are NOT populated from the sender
--   - needs_info replies go back to the tester (sender_email as usual)
--   - If a .msg was attached, msg_original_* fields hold the extracted content
-- ============================================================================

ALTER TABLE app.email_quotes
  ADD COLUMN IF NOT EXISTS is_internal_sender  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS msg_original_subject TEXT,
  ADD COLUMN IF NOT EXISTS msg_original_from    TEXT;

COMMENT ON COLUMN app.email_quotes.is_internal_sender IS
  'Email came from an internal tester (mrt@on-nex.com, *@ndtesting.com, mrtmaharaj@gmail.com). Treated as a forwarded RFQ — sender is NOT a customer.';

COMMENT ON COLUMN app.email_quotes.msg_original_subject IS
  'Subject line extracted from a .msg attachment (Outlook message forwarded by tester).';

COMMENT ON COLUMN app.email_quotes.msg_original_from IS
  'Original sender email extracted from a .msg attachment.';
