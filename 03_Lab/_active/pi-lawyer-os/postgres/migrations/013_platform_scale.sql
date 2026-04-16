-- Migration 013: Platform Scale (Phase 12)
-- White-label branding, email integration, document templates, Stripe billing

-- ── Firm branding ─────────────────────────────────────────────────────────────
ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS logo_url        TEXT,
  ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT '#0ea5e9',
  ADD COLUMN IF NOT EXISTS sms_signature   TEXT DEFAULT '— Your Legal Team';

-- ── SMTP config per firm ──────────────────────────────────────────────────────
ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS smtp_host     TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port     INTEGER DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_user     TEXT,
  ADD COLUMN IF NOT EXISTS smtp_password TEXT;

-- ── Email channel for communications ─────────────────────────────────────────
-- Add 'email' to the channel check if it doesn't already exist
DO $$
BEGIN
  -- Drop and recreate check constraint to add 'email' channel
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'communications' AND constraint_name = 'communications_channel_check'
  ) THEN
    ALTER TABLE communications DROP CONSTRAINT communications_channel_check;
  END IF;
  ALTER TABLE communications
    ADD CONSTRAINT communications_channel_check
    CHECK (channel IN ('call', 'sms', 'email', 'portal', 'voicemail', 'note'));
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- ── Document templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,  -- 'retainer', 'engagement_letter', 'loi', 'demand'
  name          TEXT NOT NULL,
  content       TEXT NOT NULL,  -- HTML/Markdown with {{variable}} placeholders
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doc_templates_firm_idx ON document_templates(firm_id);
CREATE INDEX IF NOT EXISTS doc_templates_type_idx ON document_templates(firm_id, template_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON document_templates TO web_user;

-- ── Stripe billing on firms ───────────────────────────────────────────────────
ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT DEFAULT 'active';

-- ── Seed default document templates ──────────────────────────────────────────
DO $$
DECLARE
  v_firm_id UUID;
BEGIN
  SELECT id INTO v_firm_id FROM firms LIMIT 1;
  IF v_firm_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM document_templates WHERE firm_id = v_firm_id LIMIT 1) THEN RETURN; END IF;

  INSERT INTO document_templates (firm_id, template_type, name, content) VALUES
  (v_firm_id, 'retainer', 'Contingency Fee Retainer Agreement',
'# CONTINGENCY FEE RETAINER AGREEMENT

**Date:** {{date}}

**Client:** {{client_name}}
**Address:** {{client_address}}

**Attorney/Firm:** {{firm_name}}

## Representation

The client hereby retains {{firm_name}} to represent them in connection with personal injury claims arising from the incident occurring on {{date_of_loss}}.

## Contingency Fee

The client agrees to pay as attorney fees **one-third (33.33%)** of any recovery obtained by settlement, or **forty percent (40%)** if the matter proceeds to trial, plus costs advanced.

## Costs

Client authorizes the firm to advance costs of litigation. Costs advanced shall be deducted from any recovery.

## Client Obligations

Client agrees to: (1) cooperate fully with the firm; (2) appear for all medical appointments; (3) notify the firm of any address or phone changes; (4) not discuss the case with anyone other than the firm without prior approval.

## Signature

Client: _________________________ Date: __________

{{firm_name}}: _________________________ Date: __________'),

  (v_firm_id, 'engagement_letter', 'Engagement Letter',
'# ENGAGEMENT LETTER

**Date:** {{date}}

**{{client_name}}**
{{client_address}}

Dear {{client_first_name}},

Thank you for choosing {{firm_name}} to represent you. This letter confirms the terms of our engagement.

We will represent you regarding your personal injury claim arising from the incident on {{date_of_loss}}.

## Our Commitment

We will diligently pursue your claim, keep you informed of all material developments, and work to achieve the best possible outcome.

## Next Steps

1. Complete intake paperwork
2. Authorize release of medical records
3. Provide all documentation related to the incident

Please contact our office at any time with questions.

Sincerely,

{{attorney_name}}
{{firm_name}}'),

  (v_firm_id, 'loi', 'Letter of Intent to Assert Lien',
'# NOTICE OF ATTORNEY''S LIEN

**Date:** {{date}}

**To:** {{provider_name}}
**Re:** Patient: {{client_name}} | Date of Injury: {{date_of_loss}}

Dear Sir/Madam:

Please be advised that this office represents {{client_name}} for injuries sustained on {{date_of_loss}}.

This letter serves as notice that {{firm_name}} claims a lien upon any and all claims, demands, and causes of action of our client for the amount of your charges for services rendered in connection with the above-referenced matter.

Please do not release our client''s records or settle any balance owed without prior written authorization from this office.

We appreciate your cooperation.

Sincerely,

{{attorney_name}}
{{firm_name}}');

END;
$$;
