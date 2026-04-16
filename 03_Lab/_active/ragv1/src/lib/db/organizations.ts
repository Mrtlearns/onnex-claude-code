import { supabase } from "@/integrations/supabase/client";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

export interface OrgMember {
  org_id: number;
  user_id: string;
  role: string;
  joined_at: string;
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

export async function getOrganizations(userId: string): Promise<Organization[]> {
  // Fetch orgs the user owns
  const { data: owned, error: ownedError } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (ownedError) throw ownedError;

  // Fetch orgs the user is a member of (but doesn't own)
  const { data: memberRows, error: memberError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId);
  if (memberError) throw memberError;

  const memberOrgIds = (memberRows ?? []).map((r) => r.org_id);
  const ownedIds = (owned ?? []).map((o) => o.id);
  const remainingIds = memberOrgIds.filter((id) => !ownedIds.includes(id));

  let memberOrgs: Organization[] = [];
  if (remainingIds.length > 0) {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .in("id", remainingIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    memberOrgs = (data as Organization[]) ?? [];
  }

  return [...((owned as Organization[]) ?? []), ...memberOrgs];
}

export async function createOrganization(name: string, ownerId: string): Promise<Organization> {
  const slug = generateSlug(name);
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, slug, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data as Organization;
}

export async function getOrgMembers(orgId: number): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("org_members")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw error;
  return (data as OrgMember[]) ?? [];
}

export async function inviteMember(orgId: number, userId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from("org_members")
    .insert({ org_id: orgId, user_id: userId, role });
  if (error) throw error;
}

export async function removeMember(orgId: number, userId: string): Promise<void> {
  const { error } = await supabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteOrganization(orgId: number): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", orgId);
  if (error) throw error;
}
