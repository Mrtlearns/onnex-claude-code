-- Migration 047: UT Price Calculator 2026 update
-- Changes:
--   1. Add misc_fee column to ut.customers
--   2. Fix existing customer rate discrepancies (3 customers)
--   3. Insert 40 new customers from updated Excel
--   4. Add BRALCO with versioned rate-change rule set
--   5. Create default rule set v2 (misc_fee support, SQUARE_RECT_TUBE, RING multi-scan)
--   6. Create PREMCO v2 and ACTION INDUSTRIES v2 (same additions)
-- Created: 2026-04-17

-- ── 1. Schema: misc_fee column ───────────────────────────────────────────────

ALTER TABLE ut.customers ADD COLUMN IF NOT EXISTS misc_fee NUMERIC(10,2) NULL;
COMMENT ON COLUMN ut.customers.misc_fee IS
  'One-off customer surcharge stacked before env fee (e.g. COULTER FORGE GSI FEE $450, BLUE ORIGIN C-SCAN FEE $125)';

-- ── 2. Fix existing customer rates ──────────────────────────────────────────

-- MCNEELEY MFG: min_charge 225 → 275 (matches Excel cell Y col)
UPDATE ut.customers SET min_charge = 275 WHERE UPPER(name) = 'MCNEELEY MFG';

-- ACUTEK US: cscan_rate 250 → 275, cscan_min_charge 250 → 275 (Premium C-scan tier)
UPDATE ut.customers SET cscan_rate = 275, cscan_min_charge = 275 WHERE UPPER(name) = 'ACUTEK US';

-- BLUELINE INDUSTRIES: min_charge 225 → 250, technique_fee 100 → 75
UPDATE ut.customers SET min_charge = 250, technique_fee = 75 WHERE UPPER(name) = 'BLUELINE INDUSTRIES';

-- ── 3. Insert new customers — $225/hr standard tier ─────────────────────────
-- Standard: hourly=225, cscan=250, min=225, cscan_min=250, tech=125, env=YES (0.02), min_enforced

INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge, technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee)
VALUES
  ('ABSOLUTE TECHNOLOGIES', 225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('AERONOVA',              225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('COAST MANUFACTURING',  225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('CONNELLY MACHINE',     225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('HURLEN',               225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('PNEUDRALICS',          225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('TACKETT MACHINE',      225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('TURBOTECH',            225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', 'N/A'),
  ('CASTLE METALS',        225, 250, 225, 250, 125, 0.02, true,  true,  'min_enforced', '100');

-- $225/hr variants
INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge, technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee)
VALUES
  -- AEROFAB CORP: min=$250 (above standard), no tech fee
  ('AEROFAB CORP',              225, 250, 250, 250, 0,   0.02, false, true,  'min_enforced', '75'),
  -- ADVANCED STRUCTURAL TECH: ring-focused, no tech fee, simple pattern
  ('ADVANCED STRUCTURAL TECH',  225, 250, 225, 250, 0,   0.02, false, true,  'simple',       'N/A'),
  -- FRY STEEL: no tech fee, simple (no minimum floor)
  ('FRY STEEL',                 225, 250, 225, 250, 0,   0.02, false, true,  'simple',       'N/A'),
  -- SPACE-LOK: no tech fee, simple
  ('SPACE-LOK',                 225, 250, 225, 250, 0,   0.02, false, true,  'simple',       'N/A');

-- ── 4. Insert new customers — $250/hr standard tier ─────────────────────────
-- Standard: hourly=250, cscan=275, min=250, cscan_min=275, tech=125, env=YES (0.02), min_enforced

INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge, technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee)
VALUES
  ('AIRCRAFT EXTRUSION',    250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('BEL-AIR MACHINE',       250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('CENTURY PRECISION',     250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('CONTINOUS IMPROVEMENT', 250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('CUTTER INNOVATIONS',    250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('FALCON AEROSPACE',      250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('FLIGHT METALS',         250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('JOHNSON PRECISION',     250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('KREMIN',                250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('LNP MACHINE',           250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('LNT MACHINE',           250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('MICHLIN METALS',        250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('MILLER CNC',            250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('MINDRUM PRECISION',     250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('NYTRON',                250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('PRECISION FLUID CONTROL',250,275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('PROTOTEK',              250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('RBC BEARING',           250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('SIGMA AEROSPACE',       250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('SLICE OF STAINLESS',    250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('TNT MACHINE',           250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('TRABUCO PRECISION',     250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('TRI-TECH METALS',       250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A'),
  ('UREMET CORP',           250, 275, 250, 275, 125, 0.02, true, true, 'min_enforced', 'N/A');

-- ── 5. Insert special customers ──────────────────────────────────────────────

-- JACQUET WEST: $275/hr flat rate, min $250, tech $75 (non-standard), env YES
INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge, technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee)
VALUES ('JACQUET WEST', 275, 275, 250, 275, 75, 0.02, true, true, 'min_enforced', 'N/A');

-- COULTER FORGE: $250/hr ring + round bar, tech $150, GSI FEE $450 (misc_fee), min_enforced
INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge, technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee, misc_fee)
VALUES ('COULTER FORGE', 250, 275, 250, 275, 150, 0.02, true, true, 'min_enforced', 'N/A', 450.00);

-- ── 6. BRALCO: customer record + versioned rule set ──────────────────────────
-- Customer stored with OLD rates (pre-rate-change baseline).
-- v1 rule set = reads from customer record (old rates in effect).
-- v2 rule set = overrides minCharge=250, techFee=125 in lot_calculation (new rates in effect).
-- is_latest=true on v2 means new quotes use new rates; historical v1 quotes preserved.

DO $$
DECLARE
  bralco_id          uuid;
  bralco_rs_id       uuid := '00000000-0000-0000-0003-000000000001';
  bralco_v1_id       uuid := '00000000-0000-0000-0004-000000000001';
  bralco_v2_id       uuid := '00000000-0000-0000-0004-000000000002';
  default_v1_id      uuid := '00000000-0000-0000-0002-000000000001';
BEGIN
  -- Insert BRALCO customer with old rates
  INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge,
    technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee)
  VALUES ('BRALCO', 225, 250, 225, 250, 0, 0.02, false, true, 'min_enforced', 'N/A')
  RETURNING id INTO bralco_id;

  -- Create BRALCO rule set
  INSERT INTO ut_rules.rule_sets (id, name, description, created_by)
  VALUES (bralco_rs_id, 'BRALCO', 'BRALCO versioned rate history', 'system');

  -- v1: copy all default rules (reads from customer record = old rates)
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (bralco_v1_id, bralco_rs_id, 1, false,
    'v1: pre-rate-change — min=$225/no tech (reads from customer record)', 'system');

  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT bralco_v1_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules WHERE version_id = default_v1_id;

  -- v2: copy all default rules except lot_calculation, then add custom lot_calculation
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (bralco_v2_id, bralco_rs_id, 2, true,
    'v2: rate change — min=$250, tech=$125 (hardcoded in lot_calculation rule)', 'system');

  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT bralco_v2_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules
  WHERE version_id = default_v1_id AND category != 'lot_calculation';

  -- BRALCO v2 lot_calculation: hardcoded rate overrides
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (bralco_v2_id, 'lot_calculation', NULL, 0,
    'BRALCO lot pricing (v2 rate change)',
    'min=$250 and tech=$125 hardcoded — overrides customer record old rates (v2 rate change 2026-04)',
    '{
      "type": "formula",
      "steps": [
        {"name": "extPrice",   "expr": "ROUNDUP1(pricePart * qty)"},
        {"name": "minCharge",  "expr": "isCScan ? customer.cscan_min_charge : 250"},
        {"name": "lotCharge",  "expr": "MAX(extPrice, minCharge)"},
        {"name": "techFee",    "expr": "125"},
        {"name": "miscFee",    "expr": "customer.misc_fee ?? 0"},
        {"name": "subTotal",   "expr": "lotCharge + techFee + miscFee"},
        {"name": "envFee",     "expr": "has_env_fee ? CEIL(subTotal * customer.env_fee_rate) : 0"},
        {"name": "grandTotal", "expr": "subTotal + envFee"}
      ]
    }'::jsonb);

  -- Link BRALCO customer to its rule set (no pin = uses is_latest = v2)
  UPDATE ut.customers SET rule_set_id = bralco_rs_id WHERE id = bralco_id;
END $$;

-- ── 7. Default rule set v2 ───────────────────────────────────────────────────
-- Adds: misc_fee in lot_calculation, RING multi-scan, SQUARE_RECT_TUBE geometry

DO $$
DECLARE
  default_rs_id uuid := '00000000-0000-0000-0001-000000000001';
  default_v1_id uuid := '00000000-0000-0000-0002-000000000001';
  default_v2_id uuid := '00000000-0000-0000-0002-000000000002';
BEGIN
  -- Create v2
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (default_v2_id, default_rs_id, 2, true,
    'v2: misc_fee in lot_calculation, RING multi-scan (numODScans/numFaceScans), SQUARE_RECT_TUBE geometry', 'system');

  -- Mark v1 as no longer latest
  UPDATE ut_rules.rule_set_versions SET is_latest = false WHERE id = default_v1_id;

  -- Copy all v1 rules except: lot_calculation and RING scan_formula (both get updated versions below)
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT default_v2_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules
  WHERE version_id = default_v1_id
    AND NOT (category = 'lot_calculation')
    AND NOT (category = 'scan_formula' AND geometry_type = 'RING');

  -- Updated lot_calculation: adds miscFee step
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (default_v2_id, 'lot_calculation', NULL, 0,
    'Lot pricing calculation (v2)',
    'Adds misc_fee (customer-specific one-off surcharge) to subTotal before env fee calculation.',
    '{
      "type": "formula",
      "steps": [
        {"name": "extPrice",   "expr": "ROUNDUP1(pricePart * qty)"},
        {"name": "minCharge",  "expr": "isCScan ? customer.cscan_min_charge : customer.min_charge"},
        {"name": "lotCharge",  "expr": "lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice"},
        {"name": "techFee",    "expr": "has_tech_fee ? customer.technique_fee : 0"},
        {"name": "miscFee",    "expr": "customer.misc_fee ?? 0"},
        {"name": "subTotal",   "expr": "lotCharge + techFee + miscFee"},
        {"name": "envFee",     "expr": "has_env_fee ? CEIL(subTotal * customer.env_fee_rate) : 0"},
        {"name": "grandTotal", "expr": "subTotal + envFee"}
      ]
    }'::jsonb);

  -- Updated RING scan_formula: supports numODScans and numFaceScans (default 1)
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (default_v2_id, 'scan_formula', 'RING', 0,
    'Ring scan formula (v2 multi-scan)',
    'Extends RING to support numODScans and numFaceScans multipliers (COULTER FORGE variant). Default 1 for backward compatibility.',
    '{
      "type": "formula",
      "geometry": "RING",
      "steps": [
        {"name": "circ",            "expr": "dims.od * PI"},
        {"name": "indexes",         "expr": "dims.length / scanIndex"},
        {"name": "secPerScanline",  "expr": "circ / scanSpeedDivisor"},
        {"name": "scanTimeMin",     "expr": "(indexes * secPerScanline * (dims.numODScans ?? 1)) / 60"},
        {"name": "wall",            "expr": "(dims.od - dims.id_) / 2"},
        {"name": "faceIndexes",     "expr": "wall / scanIndex"},
        {"name": "faceSecPerLine",  "expr": "circ / scanSpeedDivisor"},
        {"name": "scanTimeFaceMin", "expr": "(faceIndexes * faceSecPerLine * (dims.numFaceScans ?? 1)) / 60"},
        {"name": "totalTimeMin",    "expr": "scanTimeMin + loadTime + scanTimeFaceMin"}
      ]
    }'::jsonb);

  -- SQUARE_RECT_TUBE scan_formula: flat-bar index formula, price × numScans
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (default_v2_id, 'scan_formula', 'SQUARE_RECT_TUBE', 0,
    'Square/Rect Tube scan formula',
    'Uses flat-bar index formula (thickness+width)/scanIndex. Price multiplied by numScans. Rate = hourly_rate (not hardcoded like TUBING).',
    '{
      "type": "formula",
      "geometry": "SQUARE_RECT_TUBE",
      "steps": [
        {"name": "indexes",        "expr": "(dims.width + dims.thickness) / scanIndex"},
        {"name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor"},
        {"name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60"},
        {"name": "scanTimeFaceMin","expr": "0"},
        {"name": "totalTimeMin",   "expr": "scanTimeMin + loadTime"}
      ]
    }'::jsonb);

  -- SQUARE_RECT_TUBE price_modifier: per-scan multiply (same as TUBING)
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (default_v2_id, 'price_modifier', 'SQUARE_RECT_TUBE', 0,
    'Square/Rect Tube price (per-scan multiply)',
    'Price per scan × numScans. Uses customer hourly_rate (not $250 hardcode).',
    '{
      "type": "formula",
      "geometry": "SQUARE_RECT_TUBE",
      "steps": [
        {"name": "pricePerScan", "expr": "ROUNDUP1((totalTimeMin / 60) * hourlyRate)"},
        {"name": "pricePart",    "expr": "pricePerScan * dims.numScans"}
      ]
    }'::jsonb);

END $$;

-- ── 8. PREMCO rule set v2 ────────────────────────────────────────────────────

DO $$
DECLARE
  premco_rs_id  uuid := '9f7a7d43-e68e-460f-8560-dba0f7138a3f';
  premco_v1_id  uuid := '9c7165af-7d43-410d-8acf-42cbba8c641a';
  premco_v2_id  uuid := '9c7165af-7d43-410d-8acf-42cbba8c6419';
BEGIN
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (premco_v2_id, premco_rs_id, 2, true,
    'v2: misc_fee support, RING multi-scan, SQUARE_RECT_TUBE', 'system');

  UPDATE ut_rules.rule_set_versions SET is_latest = false WHERE id = premco_v1_id;

  -- Copy all v1 except updated rules
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT premco_v2_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules
  WHERE version_id = premco_v1_id
    AND NOT (category = 'lot_calculation')
    AND NOT (category = 'scan_formula' AND geometry_type = 'RING');

  -- Same updated rules as default v2
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT premco_v2_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules
  WHERE version_id = '00000000-0000-0000-0002-000000000002'
    AND (
      (category = 'lot_calculation') OR
      (category = 'scan_formula' AND geometry_type = 'RING') OR
      (category = 'scan_formula' AND geometry_type = 'SQUARE_RECT_TUBE') OR
      (category = 'price_modifier' AND geometry_type = 'SQUARE_RECT_TUBE')
    );
END $$;

-- ── 9. ACTION INDUSTRIES rule set v2 ────────────────────────────────────────

DO $$
DECLARE
  ai_rs_id  uuid := 'f99b2726-91ad-4244-afe5-42ad00fab6ba';
  ai_v1_id  uuid := 'ffb59379-3668-4f26-a460-9d0626b43056';
  ai_v2_id  uuid := 'ffb59379-3668-4f26-a460-9d0626b43057';
BEGIN
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (ai_v2_id, ai_rs_id, 2, true,
    'v2: misc_fee support, RING multi-scan, SQUARE_RECT_TUBE', 'system');

  UPDATE ut_rules.rule_set_versions SET is_latest = false WHERE id = ai_v1_id;

  -- Copy all v1 except updated rules
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT ai_v2_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules
  WHERE version_id = ai_v1_id
    AND NOT (category = 'lot_calculation')
    AND NOT (category = 'scan_formula' AND geometry_type = 'RING');

  -- Same updated rules as default v2
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT ai_v2_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules
  WHERE version_id = '00000000-0000-0000-0002-000000000002'
    AND (
      (category = 'lot_calculation') OR
      (category = 'scan_formula' AND geometry_type = 'RING') OR
      (category = 'scan_formula' AND geometry_type = 'SQUARE_RECT_TUBE') OR
      (category = 'price_modifier' AND geometry_type = 'SQUARE_RECT_TUBE')
    );
END $$;
