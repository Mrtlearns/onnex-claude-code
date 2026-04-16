-- 043: Fix UT calculation formulas to match Excel spreadsheet exactly
-- Fixes: Pi=3.14 for round/tubing, remove CEIL, CSCAN uses (w+t)/idx, RING scan structure, envFee rounds to integer
-- Updates ALL rule set versions (default + any customer versions)

BEGIN;

-- ── 1. ROUND_BAR: use 3.14, no CEIL ─────────────────────────────────────────
UPDATE ut_rules.rules
SET definition = jsonb_set(
  definition, '{steps}',
  '[
    {"name": "circ", "expr": "3.14 * dims.diameter"},
    {"name": "indexes", "expr": "circ / scanIndex"},
    {"name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor"},
    {"name": "scanTimeMin", "expr": "(indexes * secPerScanline) / 60"},
    {"name": "scanTimeFaceMin", "expr": "0"},
    {"name": "totalTimeMin", "expr": "scanTimeMin + loadTime"}
  ]'::jsonb
)
WHERE category = 'scan_formula' AND geometry_type = 'ROUND_BAR';

-- ── 2. CSCAN_ROUND: use 3.14, no CEIL ───────────────────────────────────────
UPDATE ut_rules.rules
SET definition = jsonb_set(
  definition, '{steps}',
  '[
    {"name": "circ", "expr": "3.14 * dims.diameter"},
    {"name": "indexes", "expr": "circ / scanIndex"},
    {"name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor"},
    {"name": "scanTimeMin", "expr": "(indexes * secPerScanline) / 60"},
    {"name": "scanTimeFaceMin", "expr": "0"},
    {"name": "totalTimeMin", "expr": "scanTimeMin + loadTime"}
  ]'::jsonb
)
WHERE category = 'scan_formula' AND geometry_type = 'CSCAN_ROUND';

-- ── 3. CSCAN_FLAT: indexes = (width+thickness)/scanIndex, no CEIL ────────────
UPDATE ut_rules.rules
SET definition = jsonb_set(
  definition, '{steps}',
  '[
    {"name": "indexes", "expr": "(dims.width + dims.thickness) / scanIndex"},
    {"name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor"},
    {"name": "scanTimeMin", "expr": "(indexes * secPerScanline) / 60"},
    {"name": "scanTimeFaceMin", "expr": "0"},
    {"name": "totalTimeMin", "expr": "scanTimeMin + loadTime"}
  ]'::jsonb
)
WHERE category = 'scan_formula' AND geometry_type = 'CSCAN_FLAT';

-- ── 4. THIN_SHEET: same scan formula as CSCAN_FLAT ───────────────────────────
UPDATE ut_rules.rules
SET definition = jsonb_set(
  definition, '{steps}',
  '[
    {"name": "indexes", "expr": "(dims.width + dims.thickness) / scanIndex"},
    {"name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor"},
    {"name": "scanTimeMin", "expr": "(indexes * secPerScanline) / 60"},
    {"name": "scanTimeFaceMin", "expr": "0"},
    {"name": "totalTimeMin", "expr": "scanTimeMin + loadTime"}
  ]'::jsonb
)
WHERE category = 'scan_formula' AND geometry_type = 'THIN_SHEET';

-- ── 5. RING: full pi, no CEIL, match Excel structure ─────────────────────────
UPDATE ut_rules.rules
SET definition = jsonb_set(
  definition, '{steps}',
  '[
    {"name": "wallThickness", "expr": "(dims.od - dims.id_) / 2"},
    {"name": "circ", "expr": "PI * dims.od"},
    {"name": "indexes", "expr": "dims.length / scanIndex"},
    {"name": "secPerScanline", "expr": "circ / scanSpeedDivisor"},
    {"name": "scanTimeMin", "expr": "(indexes * secPerScanline) / 60"},
    {"name": "faceIndexes", "expr": "wallThickness / scanIndex"},
    {"name": "faceSecPerLine", "expr": "circ / scanSpeedDivisor"},
    {"name": "scanTimeFaceMin", "expr": "(faceIndexes * faceSecPerLine) / 60"},
    {"name": "totalTimeMin", "expr": "scanTimeMin + loadTime + scanTimeFaceMin"}
  ]'::jsonb
)
WHERE category = 'scan_formula' AND geometry_type = 'RING';

-- ── 6. TUBING: use 3.14, no CEIL ────────────────────────────────────────────
UPDATE ut_rules.rules
SET definition = jsonb_set(
  definition, '{steps}',
  '[
    {"name": "circ", "expr": "3.14 * dims.diameter"},
    {"name": "indexes", "expr": "circ / scanIndex"},
    {"name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor"},
    {"name": "scanTimeMin", "expr": "(indexes * secPerScanline) / 60"},
    {"name": "scanTimeFaceMin", "expr": "0"},
    {"name": "totalTimeMin", "expr": "scanTimeMin + loadTime"}
  ]'::jsonb
)
WHERE category = 'scan_formula' AND geometry_type = 'TUBING';

-- ── 7. Lot calculation: envFee uses CEIL (integer) not ROUNDUP1 (0.1) ───────
UPDATE ut_rules.rules
SET definition = jsonb_set(
  definition, '{steps}',
  '[
    {"name": "extPrice", "expr": "ROUNDUP1(pricePart * qty)"},
    {"name": "minCharge", "expr": "isCScan ? customer.cscan_min_charge : customer.min_charge"},
    {"name": "lotCharge", "expr": "lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice"},
    {"name": "techFee", "expr": "has_tech_fee ? customer.technique_fee : 0"},
    {"name": "subTotal", "expr": "lotCharge + techFee"},
    {"name": "envFee", "expr": "has_env_fee ? CEIL(subTotal * customer.env_fee_rate) : 0"},
    {"name": "grandTotal", "expr": "subTotal + envFee"}
  ]'::jsonb
)
WHERE category = 'lot_calculation';

COMMIT;
