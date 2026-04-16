-- 021: RT machine catalog + planning sessions
-- Creates rt.machine_catalog (replaces localStorage in RtMachineProfilesTab)
-- Creates rt.planning_sessions (audit log for two-stage LLM planning)
-- Seeds 3 default machines matching DEFAULT_MACHINES in RtMachineProfilesTab.tsx
-- Seeds RT inspection type + planning step in app.inspection_types

CREATE TABLE IF NOT EXISTS rt.machine_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  TEXT UNIQUE NOT NULL,
  nickname    TEXT NOT NULL,
  make_model  TEXT,
  spec        JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rt.planning_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_input           TEXT NOT NULL,
  extraction          JSONB,
  plan                JSONB,
  selected_machine_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default machines (idempotent)
INSERT INTO rt.machine_catalog (machine_id, nickname, make_model, spec)
VALUES
  (
    'RT_01',
    'Cabinet_300KV_Compact',
    'Representative 300 kV compact industrial RT cabinet',
    '{
      "xray_source": {
        "type": "Industrial X-ray",
        "max_voltage_kv": 300,
        "recommended_operating_range_kv": [80, 300],
        "focal_spot_class": "standard_microfocus_hybrid",
        "modality": ["film_rt", "digital_rt"],
        "notes": "Best for smaller or less dense aerospace parts where finer detail or lower geometric unsharpness is desirable."
      },
      "inspection_envelope": {
        "shape": "cylindrical",
        "max_part_diameter_mm": 500,
        "max_part_height_mm": 700,
        "max_part_weight_kg": 75,
        "usable_clearance_note": "Part plus fixturing must fit fully within envelope with safety clearance."
      },
      "manipulation": {
        "axes": ["rotate", "vertical", "horizontal"],
        "tilt_available": true,
        "min_rotation_step_deg": 1.0,
        "notes": "Suitable for standard multi-view RT and limited sectional planning."
      },
      "detector_support": {
        "film_supported": true,
        "digital_detector_supported": true,
        "typical_film_classes": ["D4", "D5", "C4"],
        "image_quality_support": ["IQI_wire", "IQI_hole"]
      },
      "planning_rules": {
        "best_for": ["small_to_medium_parts", "tight_detail_requirements", "lower_to_medium_wall_thickness", "jobs_where_lower_energy_reduces_scatter"],
        "not_ideal_for": ["large_dense_castings", "very_thick_superalloy_sections", "parts_near_or_above_envelope_limits"]
      }
    }'::jsonb
  ),
  (
    'RT_02',
    'Cabinet_320KV_Mid',
    'Representative 320 kV universal industrial RT cabinet',
    '{
      "xray_source": {
        "type": "Industrial X-ray",
        "max_voltage_kv": 320,
        "recommended_operating_range_kv": [100, 320],
        "focal_spot_class": "standard_industrial",
        "modality": ["film_rt", "digital_rt"],
        "notes": "General-purpose aerospace NDT cabinet and the default choice unless geometry or spec indicates otherwise."
      },
      "inspection_envelope": {
        "shape": "cylindrical",
        "max_part_diameter_mm": 650,
        "max_part_height_mm": 900,
        "max_part_weight_kg": 120,
        "usable_clearance_note": "Keep at least 25 mm planning clearance on all sides unless actual fixture data says otherwise."
      },
      "manipulation": {
        "axes": ["rotate", "vertical", "horizontal"],
        "tilt_available": true,
        "min_rotation_step_deg": 0.5,
        "notes": "Good for multi-view setups, welds, castings, forgings, and most medium-size aerospace assemblies."
      },
      "detector_support": {
        "film_supported": true,
        "digital_detector_supported": true,
        "typical_film_classes": ["D4", "D5", "D7", "C4"],
        "image_quality_support": ["IQI_wire", "IQI_hole", "duplex_wire_if_required"]
      },
      "planning_rules": {
        "best_for": ["medium_parts", "mixed_geometry", "general_aerospace_rt", "default_machine_when_no_strong_constraints_exist"],
        "not_ideal_for": ["very_large_long_parts", "extreme_density_or_thickness_cases_if_350kv_machine_available"]
      }
    }'::jsonb
  ),
  (
    'RT_03',
    'Cabinet_350KV_Large',
    'Representative 350 kV large-capacity industrial RT cabinet',
    '{
      "xray_source": {
        "type": "Industrial X-ray",
        "max_voltage_kv": 350,
        "recommended_operating_range_kv": [120, 350],
        "focal_spot_class": "standard_high_energy",
        "modality": ["film_rt", "digital_rt"],
        "notes": "Preferred for larger, denser, or thicker aerospace components when penetration is the limiting factor."
      },
      "inspection_envelope": {
        "shape": "cylindrical",
        "max_part_diameter_mm": 800,
        "max_part_height_mm": 1500,
        "max_part_weight_kg": 250,
        "usable_clearance_note": "Use this machine when size, density, or required source-to-film geometry exceeds smaller cabinets."
      },
      "manipulation": {
        "axes": ["rotate", "vertical", "horizontal"],
        "tilt_available": true,
        "min_rotation_step_deg": 0.5,
        "notes": "Suitable for long parts, heavier fixtures, and higher-penetration jobs."
      },
      "detector_support": {
        "film_supported": true,
        "digital_detector_supported": true,
        "typical_film_classes": ["D5", "D7", "C5"],
        "image_quality_support": ["IQI_wire", "IQI_hole"]
      },
      "planning_rules": {
        "best_for": ["large_parts", "high_density_materials", "thick_sections", "longer_source_to_object_or_source_to_film_geometry_demands"],
        "not_ideal_for": ["very_small_high_detail_parts_if_lower_energy_machine_can_meet_spec_more_cleanly"]
      }
    }'::jsonb
  )
ON CONFLICT (machine_id) DO NOTHING;

-- Seed RT inspection type
INSERT INTO app.inspection_types (code, label, description, sort_order)
VALUES ('RT', 'Radiographic Testing', 'Film and digital RT inspection', 10)
ON CONFLICT (code) DO NOTHING;

-- Seed RT planning step
INSERT INTO app.inspection_steps
  (inspection_type_id, name, action_type, webhook_url, instruction, sort_order)
SELECT
  id,
  'RT Planning (Extract + Machine Select)',
  'webhook',
  'http://api:3100/rt/plan',
  'Two-stage LLM: extracts part geometry then selects machine and generates technique cards. Input: rawInput (email/notes text). Output: techniqueCards[] mapped to views[].',
  10
FROM app.inspection_types
WHERE code = 'RT'
ON CONFLICT DO NOTHING;
