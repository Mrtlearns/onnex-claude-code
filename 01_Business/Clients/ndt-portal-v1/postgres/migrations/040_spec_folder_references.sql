-- Migration 040: Spec folder references for LLM pipeline injection
--
-- Registers Nextcloud paths for LLM-optimised spec markdown files produced by
-- tools/pdf_to_markdown/convert.py.  Used by api/src/lib/spec-fetcher.ts.
--
-- IMPORTANT: is_active = FALSE initially — the converter must be run first to
-- produce the actual _llm_md/ files.  After running the converter and verifying
-- the output, update the nextcloud_path to the exact filename and set
-- is_active = TRUE to enable live spec injection into Stage 2 prompts.
--
-- Activation steps:
--   1. Run: python3 tools/pdf_to_markdown/convert.py "/mnt/nextcloud-data/.../ASME Specifications/"
--   2. Check _llm_md/ for actual filenames (e.g. ASME-BPVC-VIII-1-2023.md)
--   3. UPDATE app.folder_references SET nextcloud_path = '<actual path>', is_active = TRUE
--      WHERE alias = 'spec_asme_viii_vessel';
--   4. Repeat for other specs as converted.

INSERT INTO app.folder_references (alias, display_name, nextcloud_path, description, is_active) VALUES

  -- ASME BPVC Section VIII Division 1 (pressure vessels — most common RT code)
  ('spec_asme_viii_vessel',
   'ASME BPVC VIII-1 — LLM Rules',
   '90_NDT Governing Specifications/ASME Specifications/_llm_md/ASME-BPVC-Section-VIII-Division-1.md',
   'Clause-chunked normative rules from ASME BPVC Section VIII Div 1. ' ||
   'Injected into Stage 2 RT analysis prompt for asme_viii_vessel module. ' ||
   'Activate after running pdf_to_markdown converter and verifying output.',
   FALSE),

  -- ASME B31.3 Process Piping
  ('spec_asme_b31_piping',
   'ASME B31.3 — LLM Rules',
   '90_NDT Governing Specifications/ASME Specifications/_llm_md/ASME-B31-3-Process-Piping.md',
   'Clause-chunked normative rules from ASME B31.3 Process Piping. ' ||
   'Injected into Stage 2 prompt for asme_b31_piping module.',
   FALSE),

  -- AWS D1.1 Structural Welding
  ('spec_aws_d1_structural',
   'AWS D1.1 — LLM Rules',
   '90_NDT Governing Specifications/ASME Specifications/_llm_md/AWS-D1-1-Structural-Welding.md',
   'Clause-chunked normative rules from AWS D1.1 Structural Welding Steel. ' ||
   'Injected into Stage 2 prompt for aws_structural module.',
   FALSE),

  -- ASME Section V (NDE methods — shared across modules)
  ('spec_asme_v_nde',
   'ASME Section V — LLM Rules',
   '90_NDT Governing Specifications/ASME Specifications/_llm_md/ASME-Section-V-NDE.md',
   'Clause-chunked normative rules from ASME Section V (NDE methods). ' ||
   'Covers T-233 IQI, T-271 film, T-274 geometric unsharpness.',
   FALSE),

  -- ASTM E446 / E186 / E1030 — Castings radiography
  ('spec_astm_e446_castings',
   'ASTM E446/E186/E1030 — LLM Rules',
   '90_NDT Governing Specifications/ASME Specifications/_llm_md/ASTM-E446-Castings-Radiography.md',
   'Clause-chunked normative rules for casting radiography acceptance criteria.',
   FALSE),

  -- NAS 410 / Nadcap AC7114 — Aerospace
  ('spec_nas410_aerospace',
   'NAS 410 / AC7114 — LLM Rules',
   '90_NDT Governing Specifications/ASME Specifications/_llm_md/NAS-410-Aerospace-NDE.md',
   'Clause-chunked normative rules for aerospace NDE qualification (NAS 410, AC7114).',
   FALSE),

  -- API 650 — Storage tanks
  ('spec_api650_tank',
   'API 650 — LLM Rules',
   '90_NDT Governing Specifications/ASME Specifications/_llm_md/API-650-Storage-Tanks.md',
   'Clause-chunked normative rules from API 650 atmospheric storage tanks.',
   FALSE)

ON CONFLICT DO NOTHING;
