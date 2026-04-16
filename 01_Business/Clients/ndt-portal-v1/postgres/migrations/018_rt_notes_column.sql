-- Migration 018: Add notes column to rt.incoming_quotes (parity with ut schema)
ALTER TABLE rt.incoming_quotes
    ADD COLUMN IF NOT EXISTS notes TEXT;
