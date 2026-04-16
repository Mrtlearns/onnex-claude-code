-- Migration 034: Seed "default" rule set v1 with all current hardcoded UT formulas
-- Every JSONB definition exactly matches the logic in api/src/calculations/ut.ts
-- Created: 2026-04-09

-- ── 1. Create the "default" rule set ─────────────────────────────
INSERT INTO ut_rules.rule_sets (id, name, description, created_by)
VALUES (
    '00000000-0000-0000-0001-000000000001',
    'default',
    'NDT Testing default UT calculation rules — seeded from hardcoded formulas',
    'system'
);

-- ── 2. Create version 1 ─────────────────────────────────────────
INSERT INTO ut_rules.rule_set_versions (id, rule_set_id, version, is_latest, notes, created_by)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000001',
    1,
    true,
    'Initial seed from hardcoded formulas in api/src/calculations/ut.ts',
    'system'
);

-- ── 3. RATE rule — geometry → hourly rate lookup ─────────────────
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'rate',
    NULL,
    0,
    'Geometry rate lookup',
    'Determines hourly rate based on geometry type. CSCAN types use cScanRate, TUBING uses fixed 250, all others use standard hourlyRate.',
    '{
        "type": "lookup",
        "key": "geometry_type",
        "table": {
            "CSCAN_FLAT":  { "source": "customer.cscan_rate" },
            "CSCAN_ROUND": { "source": "customer.cscan_rate" },
            "TUBING":      { "value": 250 },
            "*":           { "source": "customer.hourly_rate" }
        }
    }'::jsonb
);

-- ── 4. LOAD_TIME rule — geometry → default load time ─────────────
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'load_time',
    NULL,
    0,
    'Default load/unload time',
    'Default load time in minutes by geometry type.',
    '{
        "type": "lookup",
        "key": "geometry_type",
        "table": {
            "RING": 5,
            "TUBING": 2,
            "*": 3
        }
    }'::jsonb
);

-- ── 5. SCAN_FORMULA rules — one per geometry type ────────────────

-- FLAT_BAR: indexes = (width + thickness) / scanIndex (no ceil — matches Excel)
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'scan_formula',
    'FLAT_BAR',
    0,
    'Flat Bar scan formula',
    'Scan all 4 sides. indexes = (width + thickness) / scanIndex without ceiling — matches Excel behavior.',
    '{
        "type": "formula",
        "geometry": "FLAT_BAR",
        "steps": [
            { "name": "indexes",        "expr": "(dims.width + dims.thickness) / scanIndex" },
            { "name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor" },
            { "name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60" },
            { "name": "scanTimeFaceMin","expr": "0" },
            { "name": "totalTimeMin",   "expr": "scanTimeMin + loadTime" }
        ]
    }'::jsonb
);

-- CSCAN_FLAT
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'scan_formula',
    'CSCAN_FLAT',
    1,
    'C-Scan Flat scan formula',
    'indexes = ceil(width / scanIndex)',
    '{
        "type": "formula",
        "geometry": "CSCAN_FLAT",
        "steps": [
            { "name": "indexes",        "expr": "CEIL(dims.width / scanIndex)" },
            { "name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor" },
            { "name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60" },
            { "name": "scanTimeFaceMin","expr": "0" },
            { "name": "totalTimeMin",   "expr": "scanTimeMin + loadTime" }
        ]
    }'::jsonb
);

-- THIN_SHEET (same scan formula as CSCAN_FLAT, price modifier differs)
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'scan_formula',
    'THIN_SHEET',
    2,
    'Thin Sheet scan formula',
    'indexes = ceil(width / scanIndex). Same as CSCAN_FLAT scan, but price is doubled via price_modifier.',
    '{
        "type": "formula",
        "geometry": "THIN_SHEET",
        "steps": [
            { "name": "indexes",        "expr": "CEIL(dims.width / scanIndex)" },
            { "name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor" },
            { "name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60" },
            { "name": "scanTimeFaceMin","expr": "0" },
            { "name": "totalTimeMin",   "expr": "scanTimeMin + loadTime" }
        ]
    }'::jsonb
);

-- ROUND_BAR
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'scan_formula',
    'ROUND_BAR',
    3,
    'Round Bar scan formula',
    'Circumference-based index calculation: indexes = ceil(PI * diameter / scanIndex)',
    '{
        "type": "formula",
        "geometry": "ROUND_BAR",
        "steps": [
            { "name": "circ",           "expr": "PI * dims.diameter" },
            { "name": "indexes",        "expr": "CEIL(circ / scanIndex)" },
            { "name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor" },
            { "name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60" },
            { "name": "scanTimeFaceMin","expr": "0" },
            { "name": "totalTimeMin",   "expr": "scanTimeMin + loadTime" }
        ]
    }'::jsonb
);

-- CSCAN_ROUND (same scan formula as ROUND_BAR)
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'scan_formula',
    'CSCAN_ROUND',
    4,
    'C-Scan Round scan formula',
    'Circumference-based: indexes = ceil(PI * diameter / scanIndex). Uses cScanRate via rate lookup.',
    '{
        "type": "formula",
        "geometry": "CSCAN_ROUND",
        "steps": [
            { "name": "circ",           "expr": "PI * dims.diameter" },
            { "name": "indexes",        "expr": "CEIL(circ / scanIndex)" },
            { "name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor" },
            { "name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60" },
            { "name": "scanTimeFaceMin","expr": "0" },
            { "name": "totalTimeMin",   "expr": "scanTimeMin + loadTime" }
        ]
    }'::jsonb
);

-- RING (has face scan)
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'scan_formula',
    'RING',
    5,
    'Ring scan formula',
    'Circumference scan + face scan. Wall thickness = (OD - ID) / 2. Face scan indexes by circumference, scanline by wall thickness.',
    '{
        "type": "formula",
        "geometry": "RING",
        "steps": [
            { "name": "wallThickness",  "expr": "(dims.od - dims.id_) / 2" },
            { "name": "circ",           "expr": "PI * dims.od" },
            { "name": "indexes",        "expr": "CEIL(circ / scanIndex)" },
            { "name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor" },
            { "name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60" },
            { "name": "faceIndexes",    "expr": "CEIL(circ / scanIndex)" },
            { "name": "faceSecPerLine", "expr": "wallThickness / scanSpeedDivisor" },
            { "name": "scanTimeFaceMin","expr": "(faceIndexes * faceSecPerLine) / 60" },
            { "name": "totalTimeMin",   "expr": "scanTimeMin + loadTime + scanTimeFaceMin" }
        ]
    }'::jsonb
);

-- TUBING
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'scan_formula',
    'TUBING',
    6,
    'Tubing scan formula',
    'Circumference-based: indexes = ceil(PI * diameter / scanIndex). Price multiplied by numberOfScans via price_modifier.',
    '{
        "type": "formula",
        "geometry": "TUBING",
        "steps": [
            { "name": "circ",           "expr": "PI * dims.diameter" },
            { "name": "indexes",        "expr": "CEIL(circ / scanIndex)" },
            { "name": "secPerScanline", "expr": "dims.length / scanSpeedDivisor" },
            { "name": "scanTimeMin",    "expr": "(indexes * secPerScanline) / 60" },
            { "name": "scanTimeFaceMin","expr": "0" },
            { "name": "totalTimeMin",   "expr": "scanTimeMin + loadTime" }
        ]
    }'::jsonb
);

-- ── 6. PRICE_MODIFIER rules — per-geometry price calculation ─────

-- Default (most geometries): pricePart = ROUNDUP1((totalTimeMin / 60) * hourlyRate)
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'price_modifier',
    '*',
    0,
    'Default price calculation',
    'Standard price per part: ROUNDUP1((totalTimeMin / 60) * hourlyRate)',
    '{
        "type": "formula",
        "geometry": "*",
        "steps": [
            { "name": "pricePart", "expr": "ROUNDUP1((totalTimeMin / 60) * hourlyRate)" }
        ]
    }'::jsonb
);

-- THIN_SHEET: 2x multiplier
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'price_modifier',
    'THIN_SHEET',
    1,
    'Thin Sheet price (2x multiplier)',
    'Thin sheet pricing: ROUNDUP1((totalTimeMin / 60) * hourlyRate * 2)',
    '{
        "type": "formula",
        "geometry": "THIN_SHEET",
        "steps": [
            { "name": "pricePart", "expr": "ROUNDUP1((totalTimeMin / 60) * hourlyRate * 2)" }
        ]
    }'::jsonb
);

-- TUBING: multiply by numberOfScans
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'price_modifier',
    'TUBING',
    2,
    'Tubing price (per-scan multiply)',
    'Tubing pricing: ROUNDUP1((totalTimeMin / 60) * hourlyRate) * numScans',
    '{
        "type": "formula",
        "geometry": "TUBING",
        "steps": [
            { "name": "pricePerScan", "expr": "ROUNDUP1((totalTimeMin / 60) * hourlyRate)" },
            { "name": "pricePart",    "expr": "pricePerScan * dims.numScans" }
        ]
    }'::jsonb
);

-- ── 7. WEIGHT_FORMULA rule ───────────────────────────────────────
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'weight_formula',
    NULL,
    0,
    'Weight-based pricing',
    'Calculates cubic inches by geometry, then weight, then weight price. Used when useWeightPricing is enabled — effective price = MAX(timePricePart, weightPrice).',
    '{
        "type": "formula",
        "steps": [
            { "name": "cubicInches_flat",  "condition": "geo_in_flat", "expr": "dims.thickness * dims.width * dims.length" },
            { "name": "cubicInches_round", "condition": "geo_in_round", "expr": "PI * POW(dims.diameter / 2, 2) * dims.length" },
            { "name": "cubicInches",       "expr": "cubicInches_flat + cubicInches_round" },
            { "name": "weight",            "expr": "cubicInches * material.density_lb_per_cu_in" },
            { "name": "rate",              "expr": "inspClass == AA ? material.class_aa_rate_per_lb ?? material.class_a_rate_per_lb ?? 0 : material.class_a_rate_per_lb ?? 0" },
            { "name": "weightPrice",       "expr": "ROUNDUP1(weight * rate)" }
        ],
        "geometry_groups": {
            "flat":  ["FLAT_BAR", "CSCAN_FLAT", "THIN_SHEET"],
            "round": ["ROUND_BAR", "CSCAN_ROUND"]
        }
    }'::jsonb
);

-- ── 8. LOT_CALCULATION rule ──────────────────────────────────────
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'lot_calculation',
    NULL,
    0,
    'Lot pricing calculation',
    'Calculates extended price, applies min charge enforcement, technique fee, environmental fee, and grand total.',
    '{
        "type": "formula",
        "steps": [
            { "name": "extPrice",   "expr": "ROUNDUP1(pricePart * qty)" },
            { "name": "minCharge",  "expr": "isCScan ? customer.cscan_min_charge : customer.min_charge" },
            { "name": "lotCharge",  "expr": "lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice" },
            { "name": "techFee",    "expr": "has_tech_fee ? customer.technique_fee : 0" },
            { "name": "subTotal",   "expr": "lotCharge + techFee" },
            { "name": "envFee",     "expr": "has_env_fee ? ROUNDUP1(subTotal * customer.env_fee_rate) : 0" },
            { "name": "grandTotal", "expr": "subTotal + envFee" }
        ]
    }'::jsonb
);

-- ── 9. ROUNDING rule ─────────────────────────────────────────────
INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    'rounding',
    NULL,
    0,
    'ROUNDUP1 rounding function',
    'Round up to 1 decimal place: CEIL(n * 10) / 10. Used throughout all price calculations.',
    '{
        "type": "function",
        "name": "ROUNDUP1",
        "expr": "CEIL(n * 10) / 10"
    }'::jsonb
);

-- ── 10. Change log entry ─────────────────────────────────────────
INSERT INTO ut_rules.change_log (rule_set_id, version_from, version_to, change_type, diff, changed_by)
VALUES (
    '00000000-0000-0000-0001-000000000001',
    NULL,
    1,
    'create',
    '{"action": "Initial seed from hardcoded formulas", "rules_count": 15}'::jsonb,
    'system'
);
