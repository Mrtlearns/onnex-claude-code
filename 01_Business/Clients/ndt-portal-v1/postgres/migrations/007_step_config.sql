-- Migration 007: Add config JSONB to inspection steps + seed proper RT/UT analysis steps

-- 1. Add config column
ALTER TABLE app.inspection_steps
  ADD COLUMN IF NOT EXISTS config JSONB;

-- 2. Delete placeholder steps for RT and UT (the seeded demo steps)
DELETE FROM app.inspection_steps
WHERE inspection_type_id IN (
  SELECT id FROM app.inspection_types WHERE code IN ('RT', 'UT')
);

-- 3. Seed proper RT analysis steps
WITH rt AS (SELECT id FROM app.inspection_types WHERE code = 'RT')
INSERT INTO app.inspection_steps
  (inspection_type_id, name, action_type, instruction, sort_order, is_active, config)
VALUES
(
  (SELECT id FROM rt),
  'RT — Extract Quote Parameters',
  'llm',
  'You are an NDT quoting specialist reviewing a Radiographic Testing (RT) request.
Extract all relevant parameters needed to price this job. Return ONLY valid JSON with these fields:
{
  "customer_name": "string or null",
  "part_number": "string or null",
  "material": "string (e.g. carbon steel, stainless, aluminum)",
  "geometry": "string (plate/pipe/weld/casting)",
  "thickness_mm": number or null,
  "weld_class": "string or null (e.g. Class A, B, C)",
  "film_size": "string or null (e.g. 4x10, 5x12 inches)",
  "technique": "string or null (SWSI/DWSI/panoramic)",
  "source_type": "string or null (Ir192/Se75/Co60/X-ray)",
  "coverage_percent": number or null,
  "quantity": number or null,
  "special_requirements": "string or null",
  "estimated_items": []
}
Do not include explanation. Return only the JSON object.',
  0,
  true,
  '{"output_schema": "rt_quote_params", "required_fields": ["material", "geometry"], "fallback_on_empty": true}'::jsonb
);

-- 4. Seed proper UT analysis steps
WITH ut AS (SELECT id FROM app.inspection_types WHERE code = 'UT')
INSERT INTO app.inspection_steps
  (inspection_type_id, name, action_type, instruction, sort_order, is_active, config)
VALUES
(
  (SELECT id FROM ut),
  'UT — Extract Quote Parameters',
  'llm',
  'You are an NDT quoting specialist reviewing an Ultrasonic Testing (UT) request.
Extract all relevant parameters needed to price this job. Return ONLY valid JSON with these fields:
{
  "customer_name": "string or null",
  "part_number": "string or null",
  "material": "string (e.g. carbon steel, stainless, aluminum)",
  "geometry": "string (flat_bar/round_bar/ring/tubing/plate)",
  "thickness_mm": number or null,
  "width_mm": number or null,
  "length_mm": number or null,
  "diameter_mm": number or null,
  "outer_diameter_mm": number or null,
  "inner_diameter_mm": number or null,
  "scan_coverage": "string or null (full/partial/spot)",
  "refraction_angle_deg": number or null,
  "search_unit": "string or null (e.g. 2.25MHz 1in dia)",
  "scan_index_mm": number or null,
  "quantity": number or null,
  "special_requirements": "string or null",
  "estimated_items": []
}
Do not include explanation. Return only the JSON object.',
  0,
  true,
  '{"output_schema": "ut_quote_params", "required_fields": ["material", "geometry"], "fallback_on_empty": true}'::jsonb
);
