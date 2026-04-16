-- Sprint 7 post-deploy: Fix missing grants on organizations and org_members tables
-- Root cause: organizations + org_members were added in sprint5 migrations but
-- GRANT statements for authenticated/anon roles were never included.
-- All other poc_ragv1 tables have these grants; these two are missing them.
-- This causes "permission denied for table organizations" (code 42501) when
-- the frontend (using user JWT → authenticated role) tries to INSERT/SELECT.
--
-- NOTE: Tables are owned by supabase_admin, not postgres.
-- This migration must be run as supabase_admin:
--   docker exec supabase-db psql -U supabase_admin -d postgres < this_file.sql

-- Grant table-level permissions (RLS policies still enforce row-level security)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE poc_ragv1.organizations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE poc_ragv1.org_members TO anon, authenticated;

-- Note: id columns use IDENTITY (not sequence), no separate sequence grants needed

-- Ensure all org RLS policies exist (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'poc_ragv1' AND tablename = 'organizations'
    AND policyname = 'Users can create orgs'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can create orgs" ON poc_ragv1.organizations FOR INSERT WITH CHECK (auth.uid() = owner_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'poc_ragv1' AND tablename = 'organizations'
    AND policyname = 'Owners can update orgs'
  ) THEN
    EXECUTE 'CREATE POLICY "Owners can update orgs" ON poc_ragv1.organizations FOR UPDATE USING (auth.uid() = owner_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'poc_ragv1' AND tablename = 'organizations'
    AND policyname = 'Owners can delete orgs'
  ) THEN
    EXECUTE 'CREATE POLICY "Owners can delete orgs" ON poc_ragv1.organizations FOR DELETE USING (auth.uid() = owner_id)';
  END IF;
END $$;
