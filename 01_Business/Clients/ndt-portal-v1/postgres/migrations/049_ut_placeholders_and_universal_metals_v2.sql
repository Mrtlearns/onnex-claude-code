-- Migration 049: Placeholder customers + UNIVERSAL METALS per-material tech fee
-- Created: 2026-04-17
--
-- Part A: 5 placeholder customers from empty Excel tabs.
--   Rates are standard $225 defaults — update when actual pricing is confirmed.
--   custom_variables marks them as placeholders so the pipeline can flag them.
--
-- Part B: UNIVERSAL METALS v2 rule set.
--   v1 has has_tech_fee=false because tech fee is $0 for SS and $125 for Nickel.
--   v2 lot_calculation reads material.name and applies 125 only for Nickel alloys.
--   Requires api code change: DbMaterialForRules.name + EvalContext material.name
--   (implemented alongside this migration in rule-engine.ts and quote.ts).

-- ── Part A: Placeholder customers ────────────────────────────────────────────

INSERT INTO ut.customers (
  name, hourly_rate, cscan_rate, min_charge, cscan_min_charge,
  technique_fee, env_fee_rate, has_tech_fee, has_env_fee,
  lot_pattern, delivery_fee, custom_variables, notes
)
VALUES
  ('CALIFORNIA AMFORGE', 225, 250, 225, 250, 125, 0.02, true, true, 'min_enforced', 'N/A',
    '{"placeholder": true, "pricing_pending": true}'::jsonb,
    'Placeholder — no pricing data in 2026 Excel. Rates are $225 standard defaults pending customer confirmation.'),

  ('iLAM PRECISION', 225, 250, 225, 250, 125, 0.02, true, true, 'min_enforced', 'N/A',
    '{"placeholder": true, "pricing_pending": true}'::jsonb,
    'Placeholder — no pricing data in 2026 Excel. Rates are $225 standard defaults pending customer confirmation.'),

  ('SUNSHINE METALS', 225, 250, 225, 250, 125, 0.02, true, true, 'min_enforced', 'N/A',
    '{"placeholder": true, "pricing_pending": true}'::jsonb,
    'Placeholder — no pricing data in 2026 Excel. Rates are $225 standard defaults pending customer confirmation.'),

  ('TECTON', 225, 250, 225, 250, 125, 0.02, true, true, 'min_enforced', 'N/A',
    '{"placeholder": true, "pricing_pending": true}'::jsonb,
    'Placeholder — no pricing data in 2026 Excel. Rates are $225 standard defaults pending customer confirmation.'),

  ('VELOCITY PRECISION', 225, 250, 225, 250, 125, 0.02, true, true, 'min_enforced', 'N/A',
    '{"placeholder": true, "pricing_pending": true}'::jsonb,
    'Placeholder — no pricing data in 2026 Excel. Rates are $225 standard defaults pending customer confirmation.');

-- ── Part B: UNIVERSAL METALS v2 ──────────────────────────────────────────────
-- v2 changes only the techFee step in lot_calculation:
--   v1: "has_tech_fee ? customer.technique_fee : 0"  → always 0 (has_tech_fee=false)
--   v2: "material.name == 'Nickel alloys' ? 125 : 0"  → 0 for SS, 125 for Nickel
-- All other rules (scan formulas, price modifiers, weight formula) are identical to v1.
-- When material is null (non-weight job), material.name resolves to null → 0.

DO $$
DECLARE
  v_rs_id  uuid := '00000000-0000-0000-0005-000000000004';  -- UNIVERSAL METALS rule set
  v_v1_id  uuid := '00000000-0000-0000-0006-000000000004';  -- v1
  v_v2_id  uuid := '00000000-0000-0000-0006-000000000005';  -- v2 (new)
BEGIN

  -- Create v2 version row
  INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest)
  VALUES (v_v2_id, v_rs_id, 2, true);

  -- Demote v1
  UPDATE ut_rules.rule_set_versions SET is_latest = false WHERE id = v_v1_id;

  -- Copy all rules from v1 except lot_calculation
  INSERT INTO ut_rules.rules (id, version_id, category, geometry_type, sort_order, label, definition)
  SELECT gen_random_uuid(), v_v2_id, category, geometry_type, sort_order, label, definition
  FROM ut_rules.rules
  WHERE version_id = v_v1_id
    AND category != 'lot_calculation';

  -- Insert v2 lot_calculation with per-material techFee
  INSERT INTO ut_rules.rules (id, version_id, category, geometry_type, sort_order, label, definition)
  VALUES (
    gen_random_uuid(), v_v2_id, 'lot_calculation', NULL, 900,
    'Lot calculation — UNIVERSAL METALS (Nickel tech fee)',
    '{
      "type": "formula",
      "steps": [
        {"name": "extPrice",   "expr": "ROUNDUP1(pricePart * qty)"},
        {"name": "minCharge",  "expr": "isCScan ? customer.cscan_min_charge : customer.min_charge"},
        {"name": "lotCharge",  "expr": "lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice"},
        {"name": "techFee",    "expr": "material.name == ''Nickel alloys'' ? 125 : 0"},
        {"name": "miscFee",    "expr": "customer.misc_fee ?? 0"},
        {"name": "subTotal",   "expr": "lotCharge + techFee + miscFee"},
        {"name": "envFee",     "expr": "has_env_fee ? CEIL(subTotal * customer.env_fee_rate) : 0"},
        {"name": "grandTotal", "expr": "subTotal + envFee"}
      ]
    }'::jsonb
  );

  -- Link UNIVERSAL METALS customer to its rule set (already done in 048, but safe to re-assert)
  UPDATE ut.customers SET rule_set_id = v_rs_id
  WHERE name = 'UNIVERSAL METALS' AND rule_set_id IS NULL;

END $$;
