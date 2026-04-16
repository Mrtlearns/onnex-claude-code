-- Fix infinite recursion in org RLS policies
-- The old policies referenced each other, causing Postgres to recurse infinitely
-- Solution: use SECURITY DEFINER helper functions to break the recursion

-- Drop old recursive policies
DROP POLICY IF EXISTS "Users can view orgs they own or belong to" ON poc_ragv1.organizations;
DROP POLICY IF EXISTS "Members can view org membership" ON poc_ragv1.org_members;

-- Create helper functions (SECURITY DEFINER breaks recursion)
CREATE OR REPLACE FUNCTION poc_ragv1.user_is_org_owner(org_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, poc_ragv1
AS $$
  SELECT EXISTS(
    SELECT 1 FROM poc_ragv1.organizations
    WHERE id = org_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION poc_ragv1.user_is_org_member(org_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, poc_ragv1
AS $$
  SELECT EXISTS(
    SELECT 1 FROM poc_ragv1.org_members
    WHERE org_members.org_id = org_id AND user_id = auth.uid()
  );
$$;

-- Recreate non-recursive policies using the helper functions
CREATE POLICY "Users can view orgs they own or belong to"
  ON poc_ragv1.organizations FOR SELECT
  USING (
    auth.uid() = owner_id OR
    poc_ragv1.user_is_org_member(id)
  );

CREATE POLICY "Members can view org membership"
  ON poc_ragv1.org_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    poc_ragv1.user_is_org_owner(org_id)
  );
