-- Migration 024: Custom Salesforce objects — sf.bom_items and others
--
-- STATUS: TEMPLATE — field names must be confirmed from sf_discover.py output.
--
-- BEFORE APPLYING:
--   1. Run: python3 scripts/sf_discover.py
--   2. Check outputs/sf_discovery_YYYY-MM-DD.json → unmapped_custom_objects
--   3. Run: python3 scripts/sf_discover.py --object <BOM_OBJECT_API_NAME>
--   4. Update the SOQL field names below to match actual SF field API names
--   5. Update sf_sync.py sync_bom_items() SOQL to match
--
-- Likely BOM object API names (in order of probability for NDT orgs):
--   BOM__c, Bill_of_Materials__c, Part_BOM__c, NDT_BOM__c, Customer_BOM__c
--
-- KEY DISTINCTION:
--   sf.bom_parts  (materialized view) = derived intelligence from Opportunity history
--   sf.bom_items  (this table)        = authoritative master BOM from Salesforce
--   Both coexist. bom_items = what SHOULD be used. bom_parts = what WAS used.

-- ── sf.bom_items — BOM master records from custom SF object ──────────────────
-- Replace <BOM_OBJECT__c> field names with confirmed API names after discovery.
CREATE TABLE IF NOT EXISTS sf.bom_items (
  sf_id               TEXT PRIMARY KEY,
  account_sf_id       TEXT REFERENCES sf.accounts(sf_id),

  -- Core part identification (confirm field names via sf_discover.py)
  part_number         TEXT NOT NULL,    -- Part_No__c or Part_Number__c
  part_rev            TEXT,             -- Rev__c or Revision__c
  drawing_number      TEXT,             -- Drawing_No__c or Drawing_Number__c

  -- NDT process data (these are the critical fields for analysis)
  service             TEXT,             -- Service__c (RT, UT, MT, PT, ET, VT)
  specification       TEXT,             -- Specification__c
  technique           TEXT,             -- Technique__c or NDT_Technique__c
  ndt_procedure       TEXT,             -- NDT_Procedure__c or Procedure__c
  acceptance_criteria TEXT,             -- Acceptance_Criteria__c

  -- Additional BOM metadata
  material            TEXT,             -- Material__c or Material_Spec__c
  notes               TEXT,             -- Notes__c or Description
  is_active           BOOLEAN DEFAULT true,  -- Active__c or IsActive
  effective_date      DATE,             -- Effective_Date__c or Date__c

  synced_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_bom_items_account_idx  ON sf.bom_items(account_sf_id);
CREATE INDEX IF NOT EXISTS sf_bom_items_part_idx     ON sf.bom_items(part_number);
CREATE INDEX IF NOT EXISTS sf_bom_items_part_acct_idx ON sf.bom_items(part_number, account_sf_id);
CREATE INDEX IF NOT EXISTS sf_bom_items_active_idx   ON sf.bom_items(is_active) WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- ADDITIONAL CUSTOM OBJECTS (add blocks below after discovery run)
-- ─────────────────────────────────────────────────────────────────────────────

-- Example: if a Procedure__c master object exists
-- CREATE TABLE IF NOT EXISTS sf.procedure_masters (
--   sf_id            TEXT PRIMARY KEY,
--   procedure_code   TEXT,
--   procedure_name   TEXT,
--   revision         TEXT,
--   service          TEXT,
--   specification    TEXT,
--   is_active        BOOLEAN DEFAULT true,
--   synced_at        TIMESTAMPTZ DEFAULT now()
-- );

-- Example: if a Technique__c object exists
-- CREATE TABLE IF NOT EXISTS sf.technique_masters (
--   sf_id         TEXT PRIMARY KEY,
--   technique_code TEXT,
--   technique_name TEXT,
--   service        TEXT,
--   description    TEXT,
--   is_active      BOOLEAN DEFAULT true,
--   synced_at      TIMESTAMPTZ DEFAULT now()
-- );
