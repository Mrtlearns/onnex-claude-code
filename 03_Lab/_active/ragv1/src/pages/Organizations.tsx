import { useState, useEffect } from "react";
import { Building2, Plus, Users, Trash2 } from "lucide-react";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Organization,
  OrgMember,
  getOrgMembers,
  inviteMember,
  removeMember,
  deleteOrganization,
} from "@/lib/db/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AnimateIn } from "@/components/AnimateIn";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

export default function Organizations() {
  const { user } = useAuth();
  const { organizations, createOrg, refreshOrgs } = useOrg();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);

  const fetchMembers = async (org: Organization) => {
    setMembersLoading(true);
    try {
      const list = await getOrgMembers(org.id);
      setMembers(list);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) {
      fetchMembers(activeOrg);
    } else {
      setMembers([]);
    }
  }, [activeOrg]);

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      await createOrg(orgName.trim());
      toast.success("Organization created");
      setCreateDialogOpen(false);
      setOrgName("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!activeOrg || !inviteUserId.trim()) return;
    setInviting(true);
    try {
      await inviteMember(activeOrg.id, inviteUserId.trim(), inviteRole);
      toast.success("Member invited");
      setInviteDialogOpen(false);
      setInviteUserId("");
      setInviteRole("member");
      await fetchMembers(activeOrg);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to invite member");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!activeOrg) return;
    if (!confirm("Remove this member from the organization?")) return;
    try {
      await removeMember(activeOrg.id, userId);
      toast.success("Member removed");
      await fetchMembers(activeOrg);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove member");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOrganization(deleteTarget.id);
      toast.success("Organization deleted");
      if (activeOrg?.id === deleteTarget.id) setActiveOrg(null);
      setDeleteTarget(null);
      await refreshOrgs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete organization");
    }
  };

  const openCreate = () => {
    setOrgName("");
    setCreateDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <AnimateIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight leading-tight">Organizations</h1>
              <p className="text-sm text-muted-foreground">
                {organizations.length} organization{organizations.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button onClick={openCreate} size="sm" className="active:scale-[0.97] transition-transform">
            <Plus className="h-4 w-4 mr-2" /> New Organization
          </Button>
        </div>
      </AnimateIn>

      <AnimateIn delay={80}>
        {organizations.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={Building2}
              title="No organizations yet"
              description="Create an organization to group projects and collaborate with your team."
              action={{ label: "Create your first organization", onClick: openCreate, icon: Plus }}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org, i) => (
              <AnimateIn key={org.id} delay={i * 60} animation="scale-in">
                <Card
                  className={`group relative hover:shadow-md transition-[box-shadow] cursor-pointer active:scale-[0.98] ${
                    activeOrg?.id === org.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setActiveOrg(activeOrg?.id === org.id ? null : org)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base truncate">{org.name}</CardTitle>
                        <CardDescription className="text-xs font-mono">{org.slug}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {org.owner_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(org); }}
                            title="Delete organization"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(org.created_at).toLocaleDateString()}</span>
                      {org.owner_id === user?.id && (
                        <Badge variant="outline" className="text-[10px]">Owner</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </AnimateIn>
            ))}
          </div>
        )}
      </AnimateIn>

      {activeOrg && (
        <AnimateIn delay={120}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    Members — {activeOrg.name}
                  </CardTitle>
                </div>
                {activeOrg.owner_id === user?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setInviteUserId(""); setInviteRole("member"); setInviteDialogOpen(true); }}
                    className="active:scale-[0.97] transition-transform"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Invite Member
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading members...</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No additional members.</p>
              ) : (
                <div className="divide-y divide-border rounded-md border">
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-mono truncate max-w-[280px]">{m.user_id}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(m.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                          {m.role}
                        </Badge>
                        {activeOrg.owner_id === user?.id && m.user_id !== user?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemove(m.user_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimateIn>
      )}

      {/* Create organization dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Corp"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !orgName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite member dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>User ID (UUID)</Label>
              <Input
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                placeholder="member"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteUserId.trim()}>
              {inviting ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete organization confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently remove the organization and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
