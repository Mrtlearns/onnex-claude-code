-- Migration 012: Advanced AI (Phase 11)
-- document_chunks for RAG, objection_library for Wyatt context

-- ── Document chunks (RAG) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doc_chunks_document_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS doc_chunks_firm_idx     ON document_chunks(firm_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks TO web_user;

-- ── Objection library ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS objection_library (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id   UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  category  TEXT NOT NULL DEFAULT 'general',
  objection TEXT NOT NULL,
  response  TEXT NOT NULL,
  active    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS objection_firm_idx ON objection_library(firm_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON objection_library TO web_user;

-- ── Seed objection library with 20 common PI intake objections ────────────
-- Insert only if table is empty for the demo firm
DO $$
DECLARE
  v_firm_id UUID;
BEGIN
  SELECT id INTO v_firm_id FROM firms LIMIT 1;
  IF v_firm_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM objection_library WHERE firm_id = v_firm_id LIMIT 1) THEN RETURN; END IF;

  INSERT INTO objection_library (firm_id, category, objection, response) VALUES
    (v_firm_id, 'time', 'I don''t have time to deal with a lawsuit right now.',
     'We handle everything — you just answer a few questions. Most clients spend less than 2 hours total over the entire case. We work around your schedule, including evenings and weekends.'),
    (v_firm_id, 'money', 'I can''t afford a lawyer.',
     'We work on a contingency fee basis — you pay nothing unless we win. No upfront costs, no hourly fees. If we don''t win, you owe us nothing.'),
    (v_firm_id, 'fault', 'I''m not sure if the accident was my fault.',
     'That''s exactly what we investigate. Nevada is a comparative negligence state — even if you were partially at fault, you may still recover compensation. Let us review the facts before making any assumptions.'),
    (v_firm_id, 'medical', 'I didn''t go to the doctor right away.',
     'That''s common after an accident. Adrenaline can mask pain. We work with medical professionals who understand delayed-onset injuries. Going now is what matters — your health and your claim.'),
    (v_firm_id, 'severity', 'My injuries aren''t that bad.',
     'Even minor injuries can have lasting effects and unexpected medical costs. A free evaluation costs you nothing and ensures you''re protected. Many clients discover later that injuries were more serious than they initially appeared.'),
    (v_firm_id, 'lawsuit', 'I don''t want to sue anyone.',
     'Most cases settle without ever going to court. We negotiate directly with the insurance company to get you fair compensation — no trial necessary in the vast majority of cases.'),
    (v_firm_id, 'insurance', 'The other driver''s insurance already contacted me.',
     'Do not give them a recorded statement without speaking to us first. Insurance adjusters are trained to minimize payouts. Let us handle all communication — it''s what we''re here for.'),
    (v_firm_id, 'worth', 'I don''t think my case is worth much.',
     'Medical bills, lost wages, pain and suffering, future care — the total is almost always higher than people expect. We''ll give you a realistic estimate after reviewing your situation at no charge.'),
    (v_firm_id, 'time', 'It''s been several months since my accident.',
     'Nevada''s statute of limitations is 2 years for personal injury. You still have time, but the sooner we start, the better — evidence and witness memories fade. Call us today.'),
    (v_firm_id, 'trust', 'I had a bad experience with a lawyer before.',
     'We understand that frustration. We operate differently — direct communication, regular updates, and a contingency fee so our interests are perfectly aligned with yours. We only win when you win.'),
    (v_firm_id, 'complexity', 'This seems too complicated.',
     'That''s our job — not yours. You tell us what happened. We handle the investigation, the paperwork, the negotiations, and if necessary, the courtroom. You focus on recovering.'),
    (v_firm_id, 'settlement', 'The insurance company already offered me a settlement.',
     'Do not sign anything. First offers are almost always far below fair value. Let us review the offer — this review is free and takes less than 24 hours. You can still accept any offer after we evaluate it.'),
    (v_firm_id, 'uninsured', 'The other driver didn''t have insurance.',
     'You may still have options through your own uninsured motorist coverage, or through other liable parties. We''ll investigate all possible avenues of recovery at no cost to you.'),
    (v_firm_id, 'employment', 'I can''t miss work for doctor appointments or meetings.',
     'Telemedicine, evening appointments, and virtual consultations make this much easier than it used to be. We also work to recover your lost wages as part of your claim.'),
    (v_firm_id, 'witnesses', 'I don''t have any witnesses.',
     'Witness testimony is just one piece of evidence. Surveillance video, traffic camera footage, cell phone records, accident reconstruction, and medical records all build a strong case. We know how to find evidence.'),
    (v_firm_id, 'preexisting', 'I have a pre-existing condition in the same area.',
     'The law protects you even with pre-existing conditions. If the accident aggravated or worsened your condition — which it very likely did — you are entitled to compensation for that worsening.'),
    (v_firm_id, 'privacy', 'I don''t want my personal life under a microscope.',
     'Legitimate personal injury cases focus on your medical treatment and the impact on your daily life — not on unrelated personal matters. We protect your privacy throughout the process.'),
    (v_firm_id, 'family', 'My family thinks I should just let it go.',
     'We understand that perspective. But your family''s future financial security matters too. Medical bills can accumulate for years. A quick, free consultation lets everyone make an informed decision together.'),
    (v_firm_id, 'minor', 'It was just a fender bender / minor accident.',
     'Vehicle damage does not predict injury severity. Whiplash and soft tissue injuries often result from low-speed impacts. Get checked out medically — and let us evaluate your legal options at no charge.'),
    (v_firm_id, 'time', 'I need to think about it.',
     'Absolutely — take the time you need. Just keep in mind that evidence disappears quickly and the statute of limitations applies. We''re happy to call you back at any time that works for you. Is there a specific concern I can address right now?');
END;
$$;
