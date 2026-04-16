-- Migration 023: New sf.* tables for standard Salesforce objects not currently synced
-- Objects: Contact, Contract, PricebookEntry, Order, OrderItem
-- All tables follow the same pattern as existing sf.* tables:
--   - sf_id TEXT PRIMARY KEY (Salesforce record Id)
--   - FK references to sf.accounts / sf.jobs / sf.products
--   - synced_at TIMESTAMPTZ for incremental sync tracking

-- ── sf.contacts — Contact object ─────────────────────────────────────────────
-- Who submits jobs per account, quote recipients, contact de-duplication.
CREATE TABLE IF NOT EXISTS sf.contacts (
  sf_id         TEXT PRIMARY KEY,
  account_sf_id TEXT REFERENCES sf.accounts(sf_id),
  account_name  TEXT,
  first_name    TEXT,
  last_name     TEXT NOT NULL,
  full_name     TEXT GENERATED ALWAYS AS (
    CASE
      WHEN first_name IS NOT NULL THEN first_name || ' ' || last_name
      ELSE last_name
    END
  ) STORED,
  email         TEXT,
  phone         TEXT,
  title         TEXT,
  department    TEXT,
  is_active     BOOLEAN DEFAULT true,
  synced_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_contacts_account_idx ON sf.contacts(account_sf_id);
CREATE INDEX IF NOT EXISTS sf_contacts_email_idx   ON sf.contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_contacts_name_idx    ON sf.contacts(last_name, first_name);


-- ── sf.contracts — Contract object ───────────────────────────────────────────
-- Active contracts, pricing agreements, renewal tracking.
-- Contracted vs spot revenue analysis.
CREATE TABLE IF NOT EXISTS sf.contracts (
  sf_id              TEXT PRIMARY KEY,
  account_sf_id      TEXT REFERENCES sf.accounts(sf_id),
  contract_number    TEXT,
  status             TEXT,          -- Draft, Activated, Expired, etc.
  start_date         DATE,
  end_date           DATE,
  billing_frequency  TEXT,          -- Monthly, Annual, etc.
  total_value        NUMERIC(12,2),
  description        TEXT,
  owner_name         TEXT,
  synced_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_contracts_account_idx ON sf.contracts(account_sf_id);
CREATE INDEX IF NOT EXISTS sf_contracts_status_idx  ON sf.contracts(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_contracts_dates_idx   ON sf.contracts(start_date, end_date);


-- ── sf.pricebook_entries — PricebookEntry object ──────────────────────────────
-- Fills the pricing gap: Product2 + PricebookEntry gives us standard/union/FAA
-- pricing tiers properly linked to products rather than hardcoded in the app.
CREATE TABLE IF NOT EXISTS sf.pricebook_entries (
  sf_id          TEXT PRIMARY KEY,
  product_sf_id  TEXT REFERENCES sf.products(sf_id),
  product_code   TEXT,              -- denormalized for query convenience
  product_name   TEXT,
  pricebook_name TEXT,              -- e.g. "Standard Price Book", "Union Rate Book"
  currency       TEXT DEFAULT 'USD',
  unit_price     NUMERIC(10,2),
  list_price     NUMERIC(10,2),
  is_active      BOOLEAN DEFAULT true,
  synced_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_pbe_product_idx      ON sf.pricebook_entries(product_sf_id);
CREATE INDEX IF NOT EXISTS sf_pbe_pricebook_idx    ON sf.pricebook_entries(pricebook_name) WHERE pricebook_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_pbe_active_idx       ON sf.pricebook_entries(is_active) WHERE is_active = true;


-- ── sf.orders — Order object ──────────────────────────────────────────────────
-- Actual orders (separate from Opportunity/Quote when the org uses Order flow).
-- Links Opportunity → Order for quote-to-order traceability.
-- May be empty if client uses Opportunity as the primary order record (common in NDT).
CREATE TABLE IF NOT EXISTS sf.orders (
  sf_id              TEXT PRIMARY KEY,
  account_sf_id      TEXT REFERENCES sf.accounts(sf_id),
  opportunity_sf_id  TEXT REFERENCES sf.jobs(sf_id),
  order_number       TEXT,
  status             TEXT,          -- Draft, Activated, Completed, Cancelled
  order_start_date   DATE,          -- EffectiveDate in Salesforce
  total_amount       NUMERIC(12,2),
  po_number          TEXT,
  description        TEXT,
  owner_name         TEXT,
  synced_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_orders_account_idx  ON sf.orders(account_sf_id);
CREATE INDEX IF NOT EXISTS sf_orders_opp_idx      ON sf.orders(opportunity_sf_id) WHERE opportunity_sf_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_orders_status_idx   ON sf.orders(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_orders_date_idx     ON sf.orders(order_start_date) WHERE order_start_date IS NOT NULL;


-- ── sf.order_items — OrderItem object ────────────────────────────────────────
-- Line items on an Order. Enables actual-ordered vs quoted-items comparison
-- and revenue-by-product analysis.
CREATE TABLE IF NOT EXISTS sf.order_items (
  sf_id          TEXT PRIMARY KEY,
  order_sf_id    TEXT REFERENCES sf.orders(sf_id),
  product_sf_id  TEXT REFERENCES sf.products(sf_id),
  product_code   TEXT,              -- denormalized
  product_name   TEXT,
  quantity       NUMERIC(10,2),
  unit_price     NUMERIC(12,2),
  total_price    NUMERIC(12,2),
  description    TEXT,
  synced_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_order_items_order_idx   ON sf.order_items(order_sf_id);
CREATE INDEX IF NOT EXISTS sf_order_items_product_idx ON sf.order_items(product_sf_id) WHERE product_sf_id IS NOT NULL;
