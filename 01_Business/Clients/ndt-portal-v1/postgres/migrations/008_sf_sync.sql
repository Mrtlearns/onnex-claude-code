-- Migration 008: Salesforce → PostgreSQL historical data sync schema
-- Creates sf.* tables for accounts, jobs, quotes, quote_lines, products
-- and a BOM materialized view for part lookup intelligence.

CREATE SCHEMA IF NOT EXISTS sf;

-- ── Customer master (from Salesforce Account) ─────────────────────────────
CREATE TABLE IF NOT EXISTS sf.accounts (
  sf_id          TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  type           TEXT,
  market         TEXT,
  status         TEXT,
  oem_approvals  TEXT[],
  rate_sheet_ver TEXT,
  payment_terms  TEXT,
  ytd_total      NUMERIC(12,2),
  synced_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Job / work order history (from Salesforce Opportunity) ────────────────
CREATE TABLE IF NOT EXISTS sf.jobs (
  sf_id               TEXT PRIMARY KEY,
  account_sf_id       TEXT REFERENCES sf.accounts(sf_id),
  account_name        TEXT,
  work_order_number   TEXT,
  invoice_number      TEXT,
  invoice_amount      NUMERIC(12,2),
  part_number         TEXT,
  part_rev            TEXT,
  lot_serial          TEXT,
  services            TEXT[],
  specification       TEXT,
  ndt_procedure       TEXT,
  acceptance_criteria TEXT,
  scope               TEXT,
  po_number           TEXT,
  price_per_basis     TEXT,
  date_received       DATE,
  date_completed      DATE,
  record_type         TEXT,
  close_date          DATE,
  synced_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_jobs_account_idx ON sf.jobs(account_sf_id);
CREATE INDEX IF NOT EXISTS sf_jobs_part_idx    ON sf.jobs(part_number) WHERE part_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_jobs_invoice_idx ON sf.jobs(invoice_number) WHERE invoice_number IS NOT NULL;

-- ── Formal quotes (from Salesforce Quote) ────────────────────────────────
CREATE TABLE IF NOT EXISTS sf.quotes (
  sf_id             TEXT PRIMARY KEY,
  job_sf_id         TEXT REFERENCES sf.jobs(sf_id),
  account_sf_id     TEXT REFERENCES sf.accounts(sf_id),
  quote_number      TEXT,
  part_numbers      TEXT,
  services_included TEXT[],
  grand_total       NUMERIC(12,2),
  status            TEXT,
  expiration_date   DATE,
  pricing_basis     TEXT,
  notes             TEXT,
  description       TEXT,
  synced_at         TIMESTAMPTZ DEFAULT now()
);

-- ── Quote line items (from Salesforce QuoteLineItem) ──────────────────────
CREATE TABLE IF NOT EXISTS sf.quote_lines (
  sf_id          TEXT PRIMARY KEY,
  quote_sf_id    TEXT REFERENCES sf.quotes(sf_id),
  product_code   TEXT,
  product_name   TEXT,
  quantity       NUMERIC(10,2),
  unit_price     NUMERIC(12,2),
  total_price    NUMERIC(12,2),
  list_price     NUMERIC(12,2),
  description    TEXT,
  line_number    INTEGER,
  synced_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_quote_lines_quote_idx ON sf.quote_lines(quote_sf_id);

-- ── Service catalog (from Salesforce Product2 + PricebookEntry) ───────────
CREATE TABLE IF NOT EXISTS sf.products (
  sf_id        TEXT PRIMARY KEY,
  product_code TEXT UNIQUE,
  name         TEXT,
  family       TEXT,
  description  TEXT,
  std_price    NUMERIC(10,2),
  union_price  NUMERIC(10,2),
  faa_price    NUMERIC(10,2),
  is_active    BOOLEAN DEFAULT true,
  synced_at    TIMESTAMPTZ DEFAULT now()
);

-- ── BOM materialized view ─────────────────────────────────────────────────
-- Unique part × account combinations aggregated from job history.
-- Provides spec, procedure, acceptance criteria for quote pre-fill.
DROP MATERIALIZED VIEW IF EXISTS sf.bom_parts;

CREATE MATERIALIZED VIEW sf.bom_parts AS
SELECT
  j.account_sf_id,
  a.name                                                     AS account_name,
  j.part_number,
  array_agg(DISTINCT j.part_rev)
    FILTER (WHERE j.part_rev IS NOT NULL)                    AS revisions,
  array_agg(DISTINCT svc)
    FILTER (WHERE svc IS NOT NULL)                           AS services,
  array_agg(DISTINCT j.specification)
    FILTER (WHERE j.specification IS NOT NULL)               AS specifications,
  array_agg(DISTINCT j.ndt_procedure)
    FILTER (WHERE j.ndt_procedure IS NOT NULL)               AS procedures,
  array_agg(DISTINCT j.acceptance_criteria)
    FILTER (WHERE j.acceptance_criteria IS NOT NULL)         AS acceptance_criteria,
  count(*)                                                   AS job_count,
  max(COALESCE(j.date_completed, j.date_received))           AS last_processed,
  avg(j.invoice_amount) FILTER (WHERE j.invoice_amount > 0) AS avg_invoice,
  max(j.invoice_amount)                                      AS max_invoice
FROM sf.jobs j
JOIN sf.accounts a ON a.sf_id = j.account_sf_id
CROSS JOIN LATERAL unnest(j.services) AS svc
WHERE j.part_number IS NOT NULL AND j.part_number <> ''
GROUP BY j.account_sf_id, a.name, j.part_number
WITH DATA;

CREATE INDEX IF NOT EXISTS bom_parts_account_idx ON sf.bom_parts(account_sf_id);
CREATE INDEX IF NOT EXISTS bom_parts_part_idx    ON sf.bom_parts(part_number);
