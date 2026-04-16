-- Migration 037: Named Variables
-- Adds custom_variables JSONB to global_settings and customers
-- so rule expressions can reference user-defined variables as customer.varName

ALTER TABLE ut.global_settings
  ADD COLUMN IF NOT EXISTS custom_variables JSONB NOT NULL DEFAULT '{}';

ALTER TABLE ut.customers
  ADD COLUMN IF NOT EXISTS custom_variables JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN ut.global_settings.custom_variables IS
  'Global named variables available in all rule expressions. Merged into customer namespace — accessible as customer.varName.';
COMMENT ON COLUMN ut.customers.custom_variables IS
  'Customer-specific named variables. Override global custom_variables. Accessible in rule expressions as customer.varName.';
