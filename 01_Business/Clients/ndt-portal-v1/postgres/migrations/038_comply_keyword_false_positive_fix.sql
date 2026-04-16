-- Migration 038: Fix ITAR false-positive keywords in comply_keyword_library
--
-- Root cause: Four keywords were incorrectly categorized as MIL_SPEC that
-- appear in standard commercial NDT drawings:
--
--   CLASS D   (weight 5) → matches "CLASS D5" film type (ASTM E94 RT film class)
--   CLASS C   (weight 3) → matches "CLASS C" film type (same issue)
--   ASME SEC V (weight 3) → matches "ASME Sec V Art. 2" (the NDT standard, not ITAR)
--   AWS D1.1  (weight 3) → matches "AWS D1.1" (commercial structural welding code)
--
-- Effect: All commercial NDT drawings using standard ASME Sec V and D5 film were
-- scoring 8 baseline (CLASS D 5 + ASME SEC V 3), causing EAR_HIGH / LOCAL_ONLY
-- routing and blocking analysis (Ollama not available).
--
-- T-joint and flat-plate drawings additionally had AWS D1.1 references (+3),
-- scoring 11 total.
--
-- Fix: Remove these four keywords. They represent legitimate commercial NDT
-- references, not ITAR-controlled technology.
--
-- Applied manually on 2026-04-12. This migration documents the change for
-- future deployments (seeds and clean installs).

DELETE FROM pipeline.comply_keyword_library
WHERE keyword IN ('CLASS D', 'CLASS C', 'ASME SEC V', 'AWS D1.1');
