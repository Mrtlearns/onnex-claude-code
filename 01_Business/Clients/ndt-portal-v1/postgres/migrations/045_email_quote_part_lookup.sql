-- 045: Add part lookup fields to email_quotes + sf_account_id to ut.customers

-- Part fields on email_quotes
ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS detected_part_numbers TEXT[] DEFAULT '{}';
ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS matched_part_number TEXT DEFAULT NULL;
ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS matched_part_account TEXT DEFAULT NULL;
ALTER TABLE app.email_quotes ADD COLUMN IF NOT EXISTS matched_part_services TEXT[] DEFAULT '{}';

-- Link ut.customers to sf.accounts for contact-based customer resolution
ALTER TABLE ut.customers ADD COLUMN IF NOT EXISTS sf_account_id TEXT DEFAULT NULL;

-- Populate sf_account_id from sf.accounts by name match
UPDATE ut.customers u
SET sf_account_id = a.sf_id
FROM sf.accounts a
WHERE UPPER(u.name) = UPPER(a.name)
  AND u.sf_account_id IS NULL;

-- Populate domain from sf.contacts (most common email domain per account)
WITH account_domains AS (
  SELECT
    c.account_sf_id,
    LOWER(SPLIT_PART(c.email, '@', 2)) AS domain,
    COUNT(*) AS cnt,
    ROW_NUMBER() OVER (PARTITION BY c.account_sf_id ORDER BY COUNT(*) DESC) AS rn
  FROM sf.contacts c
  WHERE c.email IS NOT NULL AND c.email LIKE '%@%'
  GROUP BY c.account_sf_id, LOWER(SPLIT_PART(c.email, '@', 2))
)
UPDATE ut.customers u
SET domain = ad.domain
FROM account_domains ad
WHERE ad.account_sf_id = u.sf_account_id
  AND ad.rn = 1
  AND u.domain IS NULL
  AND ad.domain NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com');
