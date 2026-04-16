-- Seed: 00-Pre-Processing pseudo-inspection-type
-- Surfaces the 7 hardcoded WF-5 pre-processing stages as a visible, URL-configurable type.
-- sort_order=-1 ensures it appears at the top of Inspection Types list.

-- Delete existing steps for 00-PRE to make this seed idempotent
DELETE FROM app.inspection_steps
  WHERE inspection_type_id IN (
    SELECT id FROM app.inspection_types WHERE code = '00-PRE'
  );

WITH new_type AS (
  INSERT INTO app.inspection_types (code, label, description, is_active, sort_order)
  VALUES (
    '00-PRE',
    '00-Pre-Processing',
    'Hardcoded pipeline pre-processing stages — visible and URL-configurable here',
    true,
    -1
  )
  ON CONFLICT (code) DO UPDATE
    SET label       = EXCLUDED.label,
        description = EXCLUDED.description
  RETURNING id
)
INSERT INTO app.inspection_steps
  (inspection_type_id, name, action_type, sort_order, is_active, webhook_url, config)
SELECT
  new_type.id,
  step.name,
  step.action_type,
  step.sort_order,
  true,
  step.webhook_url,
  step.config::jsonb
FROM new_type, (VALUES
  ('00-PRE — Message Received',           'system',  0, NULL,                              '{"pipeline_key":"message_received","description":"Intake session created; pipeline initialized."}'),
  ('00-PRE — Email Sanitization',         'webhook', 1, 'http://sanitize:8011/sanitize',   '{"pipeline_key":"email_sanitization","description":"Tokenize PII entities in email body before LLM."}'),
  ('00-PRE — Email LLM Analysis',         'webhook', 2, 'http://gateway:8012/analyze',     '{"pipeline_key":"email_llm_analysis","description":"Extract quote parameters from sanitized email body via AI."}'),
  ('00-PRE — Compliance Classification',  'webhook', 3, 'http://comply:8010/classify',     '{"pipeline_key":"compliance_classification","description":"ITAR/EAR document screening via comply service."}'),
  ('00-PRE — Compliance Gate',            'system',  4, NULL,                              '{"pipeline_key":"compliance_gate","description":"Route on llm_routing: HOLD blocks LLM, proceed continues."}'),
  ('00-PRE — PII Sanitization',           'webhook', 5, 'http://sanitize:8011/sanitize',   '{"pipeline_key":"pii_sanitization","description":"Tokenize entities in attachment text before LLM."}'),
  ('00-PRE — Inspection Type Detection',  'system',  6, NULL,                              '{"pipeline_key":"inspection_type_detection","description":"Keyword-match sanitized text to RT/UT/MT/PT/VT/ET; fallback UT."}')
) AS step(name, action_type, sort_order, webhook_url, config);
