import { useState } from "react";
import { Building2 } from "lucide-react";
import { useOrg } from "@/contexts/OrgContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CREATE_VALUE = "__create__";

export function OrgSelector() {
  const { organizations, selectedOrg, setSelectedOrg, loading, createOrg } = useOrg();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) return null;

  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        No organizations
      </div>
    );
  }

  const handleSelectChange = (val: string) => {
    if (val === CREATE_VALUE) {
      setOrgName("");
      setDialogOpen(true);
      return;
    }
    const org = organizations.find((o) => o.id.toString() === val) ?? null;
    setSelectedOrg(org);
  };

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    setSaving(true);
    try {
      const org = await createOrg(orgName.trim());
      setSelectedOrg(org);
      toast.success("Organization created");
      setDialogOpen(false);
      setOrgName("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create organization");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Select
        value={selectedOrg?.id.toString() ?? ""}
        onValueChange={handleSelectChange}
      >
        <SelectTrigger className="w-[220px] h-9">
          <SelectValue placeholder="No Organization" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((o) => (
            <SelectItem key={o.id} value={o.id.toString()}>
              {o.name}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_VALUE} className="text-primary font-medium">
            + Create Organization
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Corp"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !orgName.trim()}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
