-- Migration 048: Deferred customers from UT Price Calculator 2026
-- Covers: BLUE ORIGIN, 4 weight-based customers, 2 pre-quoted customers
-- Created: 2026-04-17
--
-- Weight-based customers: per-lb rates stored in custom_variables JSONB.
-- Customer-specific rule sets override weight_formula to read from customer.class_a/aa_rate_per_lb
-- instead of global ut.materials rates (which are per-material, not per-customer).
--
-- Pre-quoted customers (AMERICAN HANDFORGE, AXIAN TECHNOLOGY): inserted for customer lookup
-- (email pipeline, Salesforce) with price lists in custom_variables. Portal calculator will
-- use time-based pricing as a fallback; pre-quoted lookup UI is a future feature.

-- ── 1. BLUE ORIGIN ───────────────────────────────────────────────────────────
-- C-SCAN focused, $250/hr, tech=$150, C-SCAN FEE=$125 (misc_fee), min=$250, env YES

INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge,
  technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee, misc_fee,
  notes)
VALUES ('BLUE ORIGIN', 250, 250, 250, 250, 150, 0.02, true, true, 'min_enforced', 'N/A', 125.00,
  'C-SCAN focused — fracture-critical aerospace parts. misc_fee=$125 is the C-SCAN FEE per lot (stacks on technique fee).');

-- ── 2. Weight-based customers ────────────────────────────────────────────────
-- Per-lb rates stored in custom_variables; picked up by weight-based rule sets below.
-- Base rates = Class A flat bar rate (most common). Per-alloy premium rates (Al, Ti, Ni)
-- vary in Excel but are not supported per-material in current schema — use base rate.

INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge,
  technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee,
  custom_variables, notes)
VALUES
  -- EARLE M. JORGENSON: Class A=$0.12, Class AA=$0.14, delivery=$100
  ('EARLE M. JORGENSON', 225, 250, 250, 250, 125, 0.02, true, true, 'min_enforced', '100',
    '{"class_a_rate_per_lb": 0.12, "class_aa_rate_per_lb": 0.14, "weight_based": true}'::jsonb,
    'Weight-based pricing. Per-lb rates: Class A=$0.12, Class AA=$0.14. Per-alloy premiums (Al=$0.15, Ti=$0.20, Ni=$0.16) not yet modeled.'),

  -- ROLLED ALLOYS: Class A=$0.10, Class AA=$0.12, simple lot (no min enforcement)
  ('ROLLED ALLOYS', 225, 250, 225, 250, 125, 0.02, true, true, 'simple', 'N/A',
    '{"class_a_rate_per_lb": 0.10, "class_aa_rate_per_lb": 0.12, "weight_based": true}'::jsonb,
    'Weight-based pricing. Per-lb rates: Class A=$0.10, Class AA=$0.12.'),

  -- SPECIALITY METALS: Class A=$0.12, Class AA=$0.14, min=$250
  ('SPECIALITY METALS', 225, 250, 250, 250, 125, 0.02, true, true, 'min_enforced', 'N/A',
    '{"class_a_rate_per_lb": 0.12, "class_aa_rate_per_lb": 0.14, "weight_based": true}'::jsonb,
    'Weight-based pricing. Covers SS and Ti. Per-lb rates: Class A=$0.12, Class AA=$0.14.'),

  -- UNIVERSAL METALS: Class A=$0.14, Class AA=$0.16, min=$225 (lower than standard)
  -- Tech fee varies by material (SS=$0, Nickel=$125) — using no tech fee as conservative default
  ('UNIVERSAL METALS', 225, 250, 225, 250, 0, 0.02, false, true, 'simple', 'N/A',
    '{"class_a_rate_per_lb": 0.14, "class_aa_rate_per_lb": 0.16, "weight_based": true}'::jsonb,
    'Weight-based pricing. Per-lb rates: Class A=$0.14, Class AA=$0.16. Tech fee varies by material type (SS=$0, Nickel=$125) — not modeled; has_tech_fee=false conservative default.');

-- ── 3. Pre-quoted customers ──────────────────────────────────────────────────
-- Inserted for customer recognition (email/Salesforce pipeline).
-- pricing_model="pre_quoted" flags them; price_list stored for future lookup UI.

INSERT INTO ut.customers (name, hourly_rate, cscan_rate, min_charge, cscan_min_charge,
  technique_fee, env_fee_rate, has_tech_fee, has_env_fee, lot_pattern, delivery_fee,
  custom_variables, notes)
VALUES
  ('AMERICAN HANDFORGE', 225, 250, 225, 250, 0, 0.02, false, true, 'simple', 'N/A',
    '{
      "pricing_model": "pre_quoted",
      "price_list": [
        {"part_number": "359B11122FH1105-205", "spec": "BMS 7-348", "st_in": 7.25, "lt_in": 27,  "lg_in": 68,  "full_price": 493.95,  "half_price": 246.98},
        {"part_number": "359B11122FH1107-205", "spec": "AMS 4928", "st_in": 5.75, "lt_in": 25.5, "lg_in": 93,  "full_price": 506.05,  "half_price": 253.03},
        {"part_number": "359B11122FH1205-205", "spec": "AMS 4928", "st_in": 5.25, "lt_in": 26.5, "lg_in": 71,  "full_price": 366.55,  "half_price": 183.28},
        {"part_number": "359B11122FH1307-205", "spec": "BMS 7-348", "st_in": 6.75, "lt_in": 22.5, "lg_in": 67,  "full_price": 377.60,  "half_price": 188.80},
        {"part_number": "359B11122FH4115-203", "spec": "BMS 7-348", "st_in": 6.75, "lt_in": 32.5, "lg_in": 67,  "full_price": 545.45,  "half_price": 272.73},
        {"part_number": "359B11130FH1011-203", "spec": "AMS 4928", "st_in": 5.25, "lt_in": 39,   "lg_in": 98,  "full_price": 744.65,  "half_price": 372.33},
        {"part_number": "359B11130FH2101-205", "spec": "BMS 7-348", "st_in": 8.25, "lt_in": 51.5, "lg_in": 139, "full_price": 1163.50, "half_price": 581.75},
        {"part_number": "359B11130FH2107-205", "spec": "AMS 4928", "st_in": 5.75, "lt_in": 49,   "lg_in": 112, "full_price": 902.50,  "half_price": 451.25},
        {"part_number": "359B11130FH2201-203", "spec": "BMS 7-348", "st_in": 7.25, "lt_in": 27,   "lg_in": 108, "full_price": 784.55,  "half_price": 392.28},
        {"part_number": "359B11130FH2203-203", "spec": "BMS 7-348", "st_in": 7.25, "lt_in": 25.5, "lg_in": 81,  "full_price": 555.70,  "half_price": 277.85},
        {"part_number": "359B11130FH2205-203", "spec": "BMS 7-348", "st_in": 6.75, "lt_in": 22.5, "lg_in": 91,  "full_price": 512.90,  "half_price": 256.45},
        {"part_number": "359B11130FH6023-201", "spec": "AMS 4928", "st_in": 5.25, "lt_in": 37,   "lg_in": 62,  "full_price": 446.95,  "half_price": 223.48},
        {"part_number": "359B11200FH1710-205", "spec": "BMS 7-348", "st_in": 8.25, "lt_in": 46,   "lg_in": 152, "full_price": 1137.50, "half_price": 568.75}
      ]
    }'::jsonb,
    'Pre-quoted aerospace forgings (Ti/SS, BMS 7-348 / AMS 4928). 13 fixed-price part numbers stored in custom_variables.price_list. Portal calculator not applicable — use price_list lookup.'),

  ('AXIAN TECHNOLOGY', 225, 250, 250, 250, 150, 0.02, true, true, 'min_enforced', 'N/A',
    '{
      "pricing_model": "pre_quoted",
      "technique_fee_note": "Technique fee $150 applies per lot",
      "price_columns": ["lw_only_12in", "lw_sw_12in", "lw_sw_6in"],
      "price_list": [
        {"description": ".563 Dia x 144", "class": "AA", "material": "SS",     "lw_only_12in": 25.55, "lw_sw_12in": 70.50, "lw_sw_6in": 38.15},
        {"description": ".3175 Dia x 144","class": "B",  "material": "SS",     "lw_only_12in": 19.95, "lw_sw_12in": 59.85},
        {"description": ".500 Dia x 144", "class": "AA", "material": "SS",     "lw_only_12in": 29.50, "lw_sw_12in": 88.50, "lw_sw_6in": 55.30},
        {"description": ".531 Dia x 144", "class": "AA", "material": "SS",     "lw_only_12in": 30.35},
        {"description": ".625 Dia x 144", "class": "AA", "material": "SS",     "lw_only_12in": 33.05, "lw_sw_12in": 99.15, "lw_sw_6in": 61.95},
        {"description": ".260 Dia x 144", "class": "AA", "material": "SS",     "lw_only_12in": 27.25},
        {"description": ".635 Dia x 144", "class": "AA", "material": "SS",     "lw_only_12in": 33.30},
        {"description": ".375 Dia x 144", "class": "B",  "material": "SS",     "lw_only_12in": 23.15, "lw_sw_6in": 37.50},
        {"description": ".4375 DIA x 72", "class": "AA", "material": "SS",     "lw_only_12in": 22.55, "lw_sw_12in": 76.60, "lw_sw_6in": 48.65},
        {"description": ".375 Dia x 144", "class": "AA", "material": "SS",     "lw_only_12in": 25.95, "lw_sw_12in": 75.75, "lw_sw_6in": 47.35},
        {"description": ".495 Dia x 150", "class": "AA", "material": "SS",     "lw_only_12in": 23.35, "lw_sw_12in": 78.95},
        {"description": ".875 Dia",       "class": "",   "material": "SS",     "lw_sw_12in": 90.15,   "lw_sw_6in": 46.85},
        {"description": ".750 Dia x 144", "class": "",   "material": "SS",     "lw_only_12in": 25.85, "lw_sw_12in": 97.95, "lw_sw_6in": 47.25},
        {"description": ".619 Dia x 144", "class": "",   "material": "SS",     "lw_only_12in": 24.25, "lw_sw_12in": 89.85, "lw_sw_6in": 46.50},
        {"description": ".250 Dia x 144", "class": "B",  "material": "SS",     "lw_only_12in": 18.75, "lw_sw_12in": 77.55},
        {"description": ".214 DIA x 144", "class": "B",  "material": "SS",     "lw_only_12in": 18.50, "lw_sw_12in": 72.75, "lw_sw_6in": 38.25},
        {"description": ".508 x 144",     "class": "B",  "material": "SS",     "lw_only_12in": 22.50},
        {"description": "2.50 Dia x 4ft", "class": "AAA","material": "MP35N",  "lw_only_12in": 45.00},
        {"description": "8.0 SQ x 144",   "class": "B",  "material": "6061 Al","lw_only_12in": 69.00},
        {"description": "6.5 SQ x 144",   "class": "B",  "material": "6061 Al","lw_only_12in": 48.00},
        {"description": "7.0 SQ x 144",   "class": "B",  "material": "6061 Al","lw_only_12in": 50.00},
        {"description": "4.0 SQ x 144",   "class": "B",  "material": "6061 Al","lw_only_12in": 52.50},
        {"description": "7.0 DIA x 144",  "class": "B",  "material": "6061 Al","lw_only_12in": 50.00},
        {"description": "3.25 DIA x 144", "class": "AAA","material": "Steel",  "lw_only_12in": 117.38},
        {"description": "2.0 Dia x 144",  "class": "AA", "material": "Steel",  "lw_only_12in": 25.75},
        {"description": ".875 DIA x 12",  "class": "AA", "material": "347 SS", "lw_only_12in": 28.78}
      ]
    }'::jsonb,
    'Pre-quoted small-diameter SS/Al/specialty round bar. 3 test configurations (LW only, LW+SW@12", LW+SW@6"). 26 line items in custom_variables.price_list. Technique fee=$150, min=$250.');

-- ── 4. Weight-based rule sets ────────────────────────────────────────────────
-- Each weight-based customer gets a rule set that reads per-lb rates from
-- customer.custom_variables (class_a_rate_per_lb, class_aa_rate_per_lb)
-- instead of the global ut.materials table rates.
-- All other rules (rate, scan_formula, lot_calculation, etc.) are copied from default v2.

DO $$
DECLARE
  default_v2_id  uuid := '00000000-0000-0000-0002-000000000002';
  -- Rule set IDs
  emj_rs_id      uuid := '00000000-0000-0000-0005-000000000001';
  ra_rs_id       uuid := '00000000-0000-0000-0005-000000000002';
  sm_rs_id       uuid := '00000000-0000-0000-0005-000000000003';
  um_rs_id       uuid := '00000000-0000-0000-0005-000000000004';
  -- Version IDs (v1 = only version, is_latest=true)
  emj_v1_id      uuid := '00000000-0000-0000-0006-000000000001';
  ra_v1_id       uuid := '00000000-0000-0000-0006-000000000002';
  sm_v1_id       uuid := '00000000-0000-0000-0006-000000000003';
  um_v1_id       uuid := '00000000-0000-0000-0006-000000000004';
  -- Customer-rate-aware weight formula (same for all 4)
  weight_def     jsonb := '{
    "type": "formula",
    "steps": [
      {"name": "cubicInches_flat",  "expr": "dims.thickness * dims.width * dims.length",           "condition": "geo_in_flat"},
      {"name": "cubicInches_round", "expr": "PI * POW(dims.diameter / 2, 2) * dims.length",        "condition": "geo_in_round"},
      {"name": "cubicInches",       "expr": "cubicInches_flat + cubicInches_round"},
      {"name": "weight",            "expr": "cubicInches * material.density_lb_per_cu_in"},
      {"name": "rate",              "expr": "inspClass == AA ? (customer.class_aa_rate_per_lb ?? 0) : (customer.class_a_rate_per_lb ?? 0)"},
      {"name": "weightPrice",       "expr": "ROUNDUP1(weight * rate)"}
    ],
    "geometry_groups": {"flat": ["FLAT_BAR","CSCAN_FLAT","THIN_SHEET","SQUARE_RECT_TUBE"], "round": ["ROUND_BAR","CSCAN_ROUND"]}
  }'::jsonb;
BEGIN

  -- ── EARLE M. JORGENSON ──
  INSERT INTO ut_rules.rule_sets (id, name, description, created_by)
  VALUES (emj_rs_id, 'EARLE M. JORGENSON', 'Per-lb rates from customer.custom_variables', 'system');
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (emj_v1_id, emj_rs_id, 1, true, 'Customer-rate weight formula (class_a=$0.12, class_aa=$0.14)', 'system');
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT emj_v1_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules WHERE version_id = default_v2_id AND category != 'weight_formula';
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (emj_v1_id, 'weight_formula', NULL, 0,
    'Weight pricing (customer rates)', 'Reads per-lb rate from customer.class_a/aa_rate_per_lb in custom_variables.', weight_def);

  -- ── ROLLED ALLOYS ──
  INSERT INTO ut_rules.rule_sets (id, name, description, created_by)
  VALUES (ra_rs_id, 'ROLLED ALLOYS', 'Per-lb rates from customer.custom_variables', 'system');
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (ra_v1_id, ra_rs_id, 1, true, 'Customer-rate weight formula (class_a=$0.10, class_aa=$0.12)', 'system');
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT ra_v1_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules WHERE version_id = default_v2_id AND category != 'weight_formula';
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (ra_v1_id, 'weight_formula', NULL, 0,
    'Weight pricing (customer rates)', 'Reads per-lb rate from customer.class_a/aa_rate_per_lb in custom_variables.', weight_def);

  -- ── SPECIALITY METALS ──
  INSERT INTO ut_rules.rule_sets (id, name, description, created_by)
  VALUES (sm_rs_id, 'SPECIALITY METALS', 'Per-lb rates from customer.custom_variables', 'system');
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (sm_v1_id, sm_rs_id, 1, true, 'Customer-rate weight formula (class_a=$0.12, class_aa=$0.14)', 'system');
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT sm_v1_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules WHERE version_id = default_v2_id AND category != 'weight_formula';
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (sm_v1_id, 'weight_formula', NULL, 0,
    'Weight pricing (customer rates)', 'Reads per-lb rate from customer.class_a/aa_rate_per_lb in custom_variables.', weight_def);

  -- ── UNIVERSAL METALS ──
  INSERT INTO ut_rules.rule_sets (id, name, description, created_by)
  VALUES (um_rs_id, 'UNIVERSAL METALS', 'Per-lb rates from customer.custom_variables', 'system');
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
  VALUES (um_v1_id, um_rs_id, 1, true, 'Customer-rate weight formula (class_a=$0.14, class_aa=$0.16)', 'system');
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  SELECT um_v1_id, category, geometry_type, sort_order, label, description, definition
  FROM ut_rules.rules WHERE version_id = default_v2_id AND category != 'weight_formula';
  INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
  VALUES (um_v1_id, 'weight_formula', NULL, 0,
    'Weight pricing (customer rates)', 'Reads per-lb rate from customer.class_a/aa_rate_per_lb in custom_variables.', weight_def);

  -- Link customers to their weight-based rule sets
  UPDATE ut.customers SET rule_set_id = emj_rs_id WHERE UPPER(name) = 'EARLE M. JORGENSON';
  UPDATE ut.customers SET rule_set_id = ra_rs_id  WHERE UPPER(name) = 'ROLLED ALLOYS';
  UPDATE ut.customers SET rule_set_id = sm_rs_id  WHERE UPPER(name) = 'SPECIALITY METALS';
  UPDATE ut.customers SET rule_set_id = um_rs_id  WHERE UPPER(name) = 'UNIVERSAL METALS';

END $$;
