-- 044: Add email and domain columns to ut.customers for email quote matching
-- The inbox/process handler matches incoming sender email/domain to customers

ALTER TABLE ut.customers ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;
ALTER TABLE ut.customers ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON ut.customers (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_domain ON ut.customers (LOWER(domain));
