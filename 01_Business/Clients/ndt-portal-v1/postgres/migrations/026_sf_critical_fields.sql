-- Migration 026: Critical custom fields discovered via sf_discover.py
--
-- Discovery (2026-04-03) found 0 custom objects but 192 useful field gaps.
-- Key finding: NO separate BOM custom object exists in this SF org.
-- The "BOM" data lives as custom fields on Account (Techniques_Criterias__c)
-- and on Opportunity (Specification__c, NDT_Procedure__c — already synced).
--
-- This migration adds the highest-value custom fields for NDT business analysis.

-- ── sf.accounts — critical custom fields ─────────────────────────────────────

-- THE BOM FIELD: per-account standard techniques and acceptance criteria
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS techniques_criterias  TEXT;   -- Techniques_Criterias__c

-- Work order notes (pre-filled on jobs for this account)
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS wo_notes              TEXT;   -- WO_Notes__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS add_wo_notes          TEXT;   -- Add_WO_Notes__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS add_wo_notes_2        TEXT;   -- Add_WO_Notes_2__c

-- Account classification
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS region                TEXT;   -- Region__c (delivery region)
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS client_types          TEXT[]; -- Type_Of_Client__c (multipicklist)
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS faa_account           BOOLEAN; -- FAA_Account__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS top_10_account        BOOLEAN; -- Top_10_Account__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS credit_hold           BOOLEAN; -- Credit_Hold__c

-- Logistics
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS courier               TEXT;   -- Courier__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS courier_acct          TEXT;   -- Courier_Acct__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS delivery_methods      TEXT;   -- Delivery_Method_s__c

-- Revenue (lab vs field split)
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS ytd_lab_revenue       NUMERIC(12,2); -- YTD_Lab_Revenue__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS ytd_field_revenue     NUMERIC(12,2); -- YTD_Field_Revenue__c

-- Pricing
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS lab_pricing_direction TEXT;   -- Lab_Pricing_Direction__c
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS admin_fee_pct         NUMERIC(5,2); -- Admin_Fee__c (percent)
ALTER TABLE sf.accounts ADD COLUMN IF NOT EXISTS competitors           TEXT[]; -- Competitors_Used__c (multipicklist)


-- ── sf.jobs — critical custom fields ─────────────────────────────────────────

-- Job lifecycle tracking (VERY important for operations)
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS lab_status        TEXT;          -- Lab_Status__c (picklist)
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS billing_status    TEXT;          -- Billing_Status__c (picklist)
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS date_due          DATE;          -- Date_Due_Lab__c

-- Contact who submitted the job
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS contact_sf_id     TEXT;          -- ContactId

-- Job details
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS qty_received      NUMERIC(10,2); -- No_Parts_Received__c
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS lab_notes         TEXT;          -- Lab_Notes__c
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS billing_notes     TEXT;          -- Billing_Notes__c
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS faa_job           BOOLEAN;       -- FAA__c
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS expedite          BOOLEAN;       -- Expedite__c
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS expedite_type     TEXT;          -- Expedite_Type__c (picklist)
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS expedite_fee      NUMERIC(10,2); -- Expedite_Fee__c

-- NDT measurement details
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS inspection_time_min NUMERIC(10,2); -- Inspection_time__c
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS film_sq_in          NUMERIC(10,2); -- Film_sq_in__c

-- Calculated totals
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS subtotal          NUMERIC(12,2); -- Subtotal__c
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS total             NUMERIC(12,2); -- Total__c (formula)
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS admin_fee_amount  NUMERIC(10,2); -- Admin_Fee__c (currency)
ALTER TABLE sf.jobs ADD COLUMN IF NOT EXISTS pricing_details   TEXT;          -- Pricing_Details__c (written back by portal)

-- Indexes for new operational columns
CREATE INDEX IF NOT EXISTS sf_jobs_lab_status_idx     ON sf.jobs(lab_status)     WHERE lab_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_jobs_billing_status_idx ON sf.jobs(billing_status) WHERE billing_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_jobs_due_idx            ON sf.jobs(date_due)       WHERE date_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_jobs_contact_idx        ON sf.jobs(contact_sf_id)  WHERE contact_sf_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_jobs_faa_idx            ON sf.jobs(faa_job)        WHERE faa_job = true;
CREATE INDEX IF NOT EXISTS sf_jobs_expedite_idx       ON sf.jobs(expedite)       WHERE expedite = true;
CREATE INDEX IF NOT EXISTS sf_accounts_region_idx     ON sf.accounts(region)     WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_accounts_faa_idx        ON sf.accounts(faa_account) WHERE faa_account = true;
CREATE INDEX IF NOT EXISTS sf_accounts_credit_idx     ON sf.accounts(credit_hold) WHERE credit_hold = true;
