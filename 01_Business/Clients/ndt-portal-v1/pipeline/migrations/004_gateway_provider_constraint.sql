-- Migration 004: Expand gateway_requests.provider_used check constraint
-- to include openrouter, openai, gemini in addition to anthropic/ollama.
-- Safe to run multiple times.

ALTER TABLE pipeline.gateway_requests
  DROP CONSTRAINT IF EXISTS gateway_requests_provider_used_check;

ALTER TABLE pipeline.gateway_requests
  ADD CONSTRAINT gateway_requests_provider_used_check
  CHECK (provider_used IN ('anthropic', 'ollama', 'openrouter', 'openai', 'gemini'));
