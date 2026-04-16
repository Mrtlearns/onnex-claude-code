-- 046: Link email_quotes to generated UT quotes + store LLM extraction

ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS ut_quote_id UUID;
ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS ut_quote_number TEXT;
ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS pipeline_error TEXT;
ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS llm_extraction JSONB;
